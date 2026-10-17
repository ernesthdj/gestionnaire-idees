import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { isValidTaskId } from '@shared/agents/documents'
import {
  DEFAULT_BASE_BRANCH,
  PASS_NATURE_LABELS,
  agentBranch,
  assemblyError,
  downstreamOf,
  parseDesignation,
  parseQaVerdict,
  permissionWarning,
  sinksOf,
  upstreamOf,
  UNCOMMITTED_MARK,
  zoneOverlapWarning,
  zoneOverlaps,
  type AgentProgress,
  type AgentRunResult,
  type AgentStopReason,
  type ApprovalResult,
  type Assembly,
  type AssemblyAgent,
  type AssemblyRunResult,
  type ChecksAsker,
  type CleanupResult,
  type PassIndex,
  type PassNature,
  type PassUsage,
  type ProgressListener
} from '@shared/agents/pipeline'
import { contractInstructions, parseContract } from '@shared/agents/contract'
import { AGENT_PERMISSION_LABELS, AGENT_ROLE_LABELS, type AgentProfileView } from '@shared/agents/profile'
import { lotInstructions, type LotPlan } from '@shared/agents/lotPlan'
import { SPEC_AGENTS_INSTRUCTIONS, profileCatalog } from '@shared/agents/recommendation'
import { checkTask } from '../../domain/workflow/parseTaskFile'
import type { TaskBox } from './workflowHost'
import { AppError } from '../../domain/errors'
import type { StreamEvent } from '../../domain/conversation/streamEvents'
import type { PipelineDocuments } from './PipelineDocuments'

/** Une session `claude -p` : une mission, un profil, un dossier ; rend le texte final de l'agent. */
export interface AgentSessionRequest {
  readonly profile: AgentProfileView
  readonly sessionId: string
  /** La session `sessionId` existe déjà (passe précédente du même agent) : elle est reprise (L2-pipeline-optimal D3). */
  readonly resume?: boolean
  /** Neurone de la visio de l'agent : son identité sur le pont du Brainstormer (L2-pipeline-optimal D11). */
  readonly bridgeNeuronId?: string
  readonly cwd: string
  readonly systemPrompt: string
  readonly prompt: string
  readonly signal?: AbortSignal
  /** Ce que fait l'agent au fil de l'eau (outils, fichiers touchés), lu dans le flux de la session (L1o D18). */
  readonly onEvent?: (event: StreamEvent) => void
}

/**
 * Journal du travail d'un agent (L1o D18) : le début d'une passe, chaque événement de sa session, puis sa fin (rapport
 * ou erreur). Inscrit dans sa conversation de visio : on voit ce qu'il fait comme dans le chat général.
 */
export type AgentWorkEvent =
  | {
      readonly kind: 'start'
      readonly pass: number
      readonly nature: PassNature
      readonly worktree: string
    }
  | { readonly kind: 'stream'; readonly event: StreamEvent; readonly worktree: string }
  | { readonly kind: 'end'; readonly ok: boolean; readonly text: string }
  /** Bilan de la passe, lu dans son commit : chaque fichier ajouté, modifié ou supprimé (chemin relatif au projet). */
  | { readonly kind: 'files'; readonly files: readonly WorkFile[]; readonly worktree: string }

export interface WorkFile {
  readonly path: string
  readonly status: 'added' | 'modified' | 'deleted'
}

/** Sortie de `git show --name-status -z --format=` : `M\0chemin\0A\0chemin\0…`. Pur. */
export function workFilesOf(output: string): WorkFile[] {
  const parts = output.split('\0').filter((part) => part !== '')
  const files: WorkFile[] = []
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const code = parts[i]?.charAt(0)
    const path = parts[i + 1] ?? ''
    files.push({ path, status: code === 'A' ? 'added' : code === 'D' ? 'deleted' : 'modified' })
  }
  return files
}

export type AgentWorkListener = (agentId: string, event: AgentWorkEvent) => void

export interface AgentSessionResult {
  readonly ok: boolean
  readonly text: string
  readonly error?: string
  /** Reprise demandée sur une session que Claude Code ne connaît pas (effacée, autre poste) : rien n'a tourné. */
  readonly missingSession?: boolean
}

export type AgentSessionRunner = (request: AgentSessionRequest) => Promise<AgentSessionResult>

/** Git, vu par le moteur, lancé dans le dossier du projet (`-C <worktree>` pour un agent) : `code` 0 = succès. */
export type GitPort = (args: readonly string[]) => Promise<{ readonly code: number | null; readonly output: string }>

export interface PipelineEngineDeps {
  readonly profiles: () => readonly AgentProfileView[]
  readonly runSession: AgentSessionRunner
  /** Neurone de la visio d'un agent sur un nœud : son identité sur le pont du Brainstormer (L2-pipeline-optimal D11). */
  readonly agentNeuron?: (hostId: string, agentId: string) => string | undefined
  readonly git: GitPort
  readonly projectDir: string
  /** Dossier des worktrees des agents, hors du projet (`<racine>/<tâche>/<agent>`). */
  readonly worktreeRoot: string
  /** Documents (spec, rapports) lus et écrits dans un dossier donné : le worktree d'un agent. */
  readonly documentsFor: (dir: string) => PipelineDocuments
  readonly newSessionId?: () => string
}

/**
 * `runGit` garde les 4 000 derniers caractères de la sortie : une liste de fichiers plus longue serait coupée, et un
 * ajout « par nom » incomplet. Au-delà, l'agent s'arrête plutôt que de commiter une partie de son travail.
 */
const FILE_LIST_MAX = 3_900

/**
 * Noms d'une liste `-z` : chaque nom finit par `\0`. `runGit` colle la sortie d'erreur après (avertissements CRLF de
 * git sous Windows…) : ce qui suit le dernier `\0` n'est jamais un nom.
 */
const zList = (output: string): string[] => output.split('\0').slice(0, -1)

/** Refus du CLI quand le mode de permission interdit l'outil (`claude -p` n'a personne à qui demander). */
const REFUSAL = /requested permissions|haven.t granted|permission (?:to|denied)|not allowed/i

/** Compte les outils refusés d'une session (L1o D20), une fois par outil. */
export function refusalsOf(): { see(event: StreamEvent): void; count(): number } {
  const ids = new Set<string>()
  return {
    see: (event) => {
      if (event.kind === 'permissionDenied') ids.add(event.id)
      if (event.kind === 'toolResult' && event.isError && REFUSAL.test(event.text)) ids.add(event.id)
    },
    count: () => ids.size
  }
}

/**
 * Consommation d'une passe (L2-pipeline-optimal D10, T015), lue dans le flux de sa session : outils appelés, jauge des
 * 5 h au premier et au dernier relevé, et le résultat final (tokens, coût, tours, durée). Sans résultat, rien.
 */
export function usageOf(): { see(event: StreamEvent): void; usage(): PassUsage | undefined } {
  let tools = 0
  let start: number | null = null
  let end: number | null = null
  let last: Extract<StreamEvent, { kind: 'result' }> | undefined
  return {
    see: (event) => {
      if (event.kind === 'tool') tools += 1
      if (event.kind === 'quota' && event.fiveHour !== null) {
        start ??= event.fiveHour.utilization
        end = event.fiveHour.utilization
      }
      if (event.kind === 'result') last = event
    },
    usage: () =>
      last === undefined
        ? undefined
        : {
            ...last.usage,
            costUsd: last.costUsd,
            turns: last.turns,
            tools,
            durationMs: last.durationMs,
            fiveHourStart: start,
            fiveHourEnd: end
          }
  }
}

/** Dossier du worktree temporaire de la fusion : `_` n'ouvre jamais un identifiant d'agent. */
const FUSION_DIR = '_fusion'

/** Ce qu'un tour d'agent rend au planificateur : son résultat, et son rapport s'il a fini. */
interface Outcome {
  readonly result: AgentRunResult
  readonly report?: string
}

/** Changement d'état que le planificateur annonce à la fin du tour d'un agent. */
const progressOf = (outcome: Outcome): AgentProgress => {
  const { result, report } = outcome
  return {
    agentId: result.agentId,
    state: result.status === 'done' ? 'done' : result.status === 'cancelled' ? 'cancelled' : 'failed',
    ...(result.index === undefined ? {} : { index: result.index }),
    ...(result.stopped === undefined ? {} : { message: result.stopped.message }),
    ...(report === undefined ? {} : { report })
  }
}

/** Qui renvoie au PO : le QA (L1o D8) ou l'Architecte qui a trouvé un trou dans la spec (L2-pipeline-optimal D1). */
type FeedbackSource = 'qa' | 'architecte'

/** Ce qu'il faut pour lancer un tour : l'assemblage, l'agent, sa passe, et les retours du QA pour le PO. */
interface Turn {
  readonly assembly: Assembly
  readonly agent: AssemblyAgent
  readonly profile: AgentProfileView
  /** Branches des agents attendus (vide : départ de la base). */
  readonly upstream: readonly string[]
  readonly baseBranch: string
  readonly pass: number
  readonly nature: PassNature
  readonly feedback?: string
  readonly feedbackFrom?: FeedbackSource
  /** Validation des commandes de vérification par mentalyas, après le contrat de l'Architecte (D2). */
  readonly askChecks?: ChecksAsker
  /** Session de la passe précédente de cet agent : reprise, il garde son raisonnement (L2-pipeline-optimal D3). */
  readonly previousSession?: string
  readonly signal: AbortSignal | undefined
  readonly work: AgentWorkListener
}

const missionFor = (turn: Turn, index: PassIndex): string => {
  const { agent, profile, assembly } = turn
  const alone = assembly.agents.length === 1
  const spec = index.specVersion === undefined ? '' : `, spec v${index.specVersion}`
  return [
    `Tu es l'agent « ${profile.name} » (${AGENT_ROLE_LABELS[profile.role]}, identifiant ${agent.id}), sur la tâche ${assembly.taskId}.`,
    `Passe ${index.pass} : ${PASS_NATURE_LABELS[index.nature]}${spec}.`,
    alone
      ? 'Tu travailles seul sur cette tâche, dans ton propre dossier (un worktree git), sur ta branche.'
      : 'Tu travailles dans ton propre dossier (un worktree git), sur ta branche ; d’autres agents peuvent travailler en même temps sur leur part.',
    'Ne fais aucun commit : l’app enregistre ton travail à la fin de ton tour.',
    'Les documents de la tâche sont dans docs/pipeline/ : tu les lis, tu ne modifies jamais spec.md ni contrat.md.',
    // Rangement que la vue Workflow sait lire (L1o D20) : sinon le document n'apparaît pas sur la carte.
    'Si tu écris un brainstorm : docs/brainstorm/L<niveau><lettre>-<sujet>.md (ex. L1d-code-local.md), avec sous le ' +
      'titre « **Parent** : <document> · **Maturité** : insuffisant | suffisant | complet · **Tâches** : ' +
      'docs/TACHES-<Sujet>.md » ; ses tâches dans docs/TACHES-<Sujet>.md (lots ##, cases « - [ ] T001 … »).',
    'Ta réponse finale est ton rapport (Markdown, court) : ce que tu as fait, ce qui reste, les points d’attention.'
  ].join('\n')
}

/**
 * Planificateur d'assemblage (L1o D2, D3, D5, D8, D9, D11 ; T011–T012, T016–T018). Un agent démarre dès que ceux qu'il
 * attend ont fini ; les agents prêts travaillent en même temps. Chacun a son worktree et sa branche
 * `agents/<tâche>/<agent>`. Si un QA renvoie le travail, le PO réécrit la spec et désigne les agents concernés, qui
 * repartent avec ceux qui dépendent d'eux, puis le QA revérifie : sans plafond, jusqu'à la validation ou l'annulation.
 * Les commandes git passent une à une ; les sessions tournent en parallèle. Rien ne va sur la base sans `approve`.
 */
export class PipelineEngine {
  private gitQueue: Promise<unknown> = Promise.resolve()
  /** Dernière spec de lot signée par le PO, par tâche (L1o D25) : rendue avec le résultat de l'assemblage. */
  private readonly plans = new Map<string, LotPlan>()

  constructor(private readonly deps: PipelineEngineDeps) {}

  /** Ce que les modes de permissions des agents empêcheront (signalé au moment d'assembler, L1o D11). */
  warnings(assembly: Assembly): string[] {
    const profiles = new Map(this.deps.profiles().map((profile) => [profile.id, profile]))
    const seen = new Set<string>()
    const warnings: string[] = []
    for (const agent of assembly.agents) {
      const profile = profiles.get(agent.profileId)
      if (profile === undefined || seen.has(profile.id)) continue
      seen.add(profile.id)
      const warning = permissionWarning(profile)
      if (warning !== undefined) warnings.push(warning)
    }
    for (const overlap of zoneOverlaps(assembly)) warnings.push(zoneOverlapWarning(overlap))
    return warnings
  }

  /**
   * Copie de travail de mentalyas (L1o D20) : les agents partent du dernier commit ; ce qui n'est pas commité, ils ne
   * le voient pas (documents, tâches, code en cours). Rend l'avertissement, ou `null` si tout est commité.
   */
  async uncommittedWarning(): Promise<string | null> {
    const status = await this.git(['status', '--porcelain', '-z'])
    if (status.code !== 0) return null
    const paths = zList(status.output)
      .filter((entry) => entry.length > 3)
      .map((entry) => entry.slice(3))
    if (paths.length === 0) return null
    const shown = paths.slice(0, 5).join(', ')
    return (
      `${UNCOMMITTED_MARK} : ${paths.length} fichier(s) non commité(s) (${shown}${paths.length > 5 ? '…' : ''}). Les ` +
      'agents partent du dernier commit et ne les verront pas : commite-les d’abord dans le Dépôt.'
    )
  }

  /** Refuse un assemblage invalide ou une branche de base introuvable, sans rien lancer. */
  async check(assembly: Assembly): Promise<void> {
    this.checked(assembly)
    await this.baseOf(assembly)
  }

  /** `onProgress` reçoit chaque changement d'état d'un agent au fil de l'eau (T006) ; son échec n'arrête jamais le travail. */
  async run(
    assembly: Assembly,
    signal?: AbortSignal,
    onProgress?: ProgressListener,
    onWork?: AgentWorkListener,
    /** Validation par mentalyas des commandes de vérification du contrat (L2-pipeline-optimal D2) ; absente : aucune. */
    askChecks?: ChecksAsker
  ): Promise<AssemblyRunResult> {
    const { taskId } = assembly
    const profileOf = this.checked(assembly)
    const baseBranch = await this.baseOf(assembly)
    const journal = (message: string): void =>
      this.deps.documentsFor(this.deps.projectDir).appendJournal({
        at: Date.now(),
        taskId,
        role: profileOf(assembly.agents[0]?.id ?? '').role,
        message
      })
    journal(`Assemblage lancé depuis ${baseBranch} : ${assembly.agents.length} agent(s).`)

    const progress: ProgressListener = (event) => {
      try {
        onProgress?.(event)
      } catch {
        // Un suivi défaillant (fenêtre fermée…) ne doit pas faire échouer l'assemblage.
      }
    }
    const work: AgentWorkListener = (agentId, event) => {
      try {
        onWork?.(agentId, event)
      } catch {
        // Le journal du travail ne doit jamais faire échouer l'assemblage.
      }
    }
    const latest = new Map<string, Outcome>()
    const passes = new Map<string, number>()
    const finish = (completed: boolean, rounds: number): AssemblyRunResult => {
      const agents = assembly.agents.map((agent) => latest.get(agent.id)?.result as AgentRunResult)
      journal(
        completed
          ? `Assemblage validé en ${rounds} tour(s) : les branches attendent l’accord de fusion de mentalyas.`
          : `Assemblage arrêté au tour ${rounds} : ${agents.filter((a) => a.status !== 'done').length} agent(s) sans résultat.`
      )
      const plan = assembly.lot === undefined ? undefined : this.plans.get(taskId)
      return { taskId, completed, rounds, agents, ...(plan === undefined ? {} : { plan }) }
    }
    const runPlan = async (
      plan: ReadonlyMap<string, PassNature>,
      feedback?: string,
      feedbackFrom?: FeedbackSource
    ): Promise<boolean> => {
      await this.schedule({
        assembly,
        plan,
        profileOf,
        baseBranch,
        signal,
        latest,
        passes,
        feedback,
        ...(feedbackFrom === undefined ? {} : { feedbackFrom }),
        ...(askChecks === undefined ? {} : { askChecks }),
        progress,
        work
      })
      return [...plan.keys()].every((id) => latest.get(id)?.result.status === 'done')
    }

    const qaIds = assembly.agents.filter((agent) => profileOf(agent.id).role === 'qa').map((agent) => agent.id)
    const po = assembly.agents.find((agent) => profileOf(agent.id).role === 'po')
    let plan = new Map<string, PassNature>(assembly.agents.map((agent) => [agent.id, 'initiale']))
    for (let round = 1; ; round++) {
      if (!(await runPlan(plan))) {
        // Trou dans la spec (L2-pipeline-optimal D1) : l'Architecte a posé ses questions, les développeurs attendent ;
        // le PO amende la spec, l'Architecte reprend, puis ceux qui en dépendent partent.
        const asking = [...plan.keys()].filter((id) => latest.get(id)?.result.stopped?.reason === 'spec-question')
        if (asking.length === 0 || po === undefined || asking.includes(po.id)) return finish(false, round)
        const questions = asking.flatMap((id) => parseContract(latest.get(id)?.report ?? '').questions)
        journal(`Tour ${round} : l’Architecte demande au PO (${questions.length} question(s)).`)
        const amended = await runPlan(
          new Map([[po.id, 'correction']]),
          questions.map((question) => `- ${question}`).join('\n'),
          'architecte'
        )
        if (!amended) return finish(false, round + 1)
        plan = new Map(asking.map((id) => [id, 'repasse'] as const))
        for (const id of [...downstreamOf(assembly, asking), ...qaIds]) {
          if (!plan.has(id)) plan.set(id, passes.has(id) ? 'repasse' : 'initiale')
        }
        continue
      }

      // Verdict de chaque QA (L1o D8) : tous valident, ou le travail repart par le PO.
      const renvois: string[] = []
      for (const id of qaIds) {
        const outcome = latest.get(id) as Outcome
        const verdict = parseQaVerdict(outcome.report ?? '')
        if (verdict === undefined) {
          latest.set(id, {
            result: this.stop(
              outcome.result,
              'qa-no-verdict',
              'le rapport ne finit pas par « VERDICT: VALIDE » ou « VERDICT: RENVOI ».'
            )
          })
          progress({
            agentId: id,
            state: 'failed',
            ...(outcome.result.index === undefined ? {} : { index: outcome.result.index }),
            message: 'le rapport ne finit pas par « VERDICT: VALIDE » ou « VERDICT: RENVOI ».'
          })
          return finish(false, round)
        }
        latest.set(id, { ...outcome, result: { ...outcome.result, verdict } })
        progress({
          agentId: id,
          state: 'done',
          verdict,
          ...(outcome.result.index === undefined ? {} : { index: outcome.result.index })
        })
        if (verdict === 'renvoi') renvois.push(`### ${id}\n${outcome.report ?? ''}`)
      }
      if (renvois.length === 0) return finish(true, round)
      journal(`Tour ${round} : renvoi du QA (${renvois.length}).`)
      if (po === undefined) return finish(false, round)

      // Le PO réécrit la spec et désigne les agents concernés ; eux et ceux qui dépendent d'eux repartent, le QA revérifie.
      if (!(await runPlan(new Map([[po.id, 'correction']]), renvois.join('\n\n')))) return finish(false, round + 1)
      const designated = parseDesignation(latest.get(po.id)?.report ?? '')
      const unknown = [...(designated?.keys() ?? [])].find(
        (id) => id === po.id || !assembly.agents.some((agent) => agent.id === id)
      )
      if (designated === undefined || designated.size === 0 || unknown !== undefined) {
        const outcome = latest.get(po.id) as Outcome
        const message =
          unknown === undefined
            ? 'la spec réécrite ne finit pas par « AGENTS: <agent>=correction|repasse, … ».'
            : `la spec désigne « ${unknown} », qui n’est pas un agent à relancer.`
        latest.set(po.id, { result: this.stop(outcome.result, 'po-no-designation', message) })
        progress({
          agentId: po.id,
          state: 'failed',
          ...(outcome.result.index === undefined ? {} : { index: outcome.result.index }),
          message
        })
        return finish(false, round + 1)
      }
      plan = new Map(designated)
      for (const id of [...downstreamOf(assembly, designated.keys()), ...qaIds]) {
        if (!plan.has(id)) plan.set(id, 'repasse')
      }
    }
  }

  /**
   * Accord unique de mentalyas (L1o D11) : les branches finales de l'assemblage (celles que personne n'attend) sont
   * fusionnées dans un worktree temporaire partant de la base, puis la base avance d'un seul coup. Un conflit, ou une
   * copie de travail modifiée sur la base, arrête tout sans rien changer. `boxes` : les tâches du nœud (la sienne, ou
   * celles d'un lot), cochées dans le même worktree (L1o D23, D25) ; la base avance d'un seul coup, cases comprises.
   */
  async approve(assembly: Assembly, boxes: readonly TaskBox[] = []): Promise<ApprovalResult> {
    const { taskId } = assembly
    this.checked(assembly)
    const baseBranch = await this.baseOf(assembly)
    const refused = (message: string): ApprovalResult => ({ merged: false, baseBranch, message })
    const sinks = sinksOf(assembly).map((id) => agentBranch(taskId, id))
    for (const branch of sinks) {
      const exists = await this.git(['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`])
      if (exists.code !== 0) return refused(`la branche ${branch} n’existe pas : l’assemblage n’a pas tourné.`)
    }
    const before = await this.git(['rev-parse', '--verify', `${baseBranch}^{commit}`])
    const head = await this.git(['rev-parse', '--abbrev-ref', 'HEAD'])
    if (before.code !== 0 || head.code !== 0) return refused('état du dépôt illisible.')
    const onBase = head.output.trim() === baseBranch
    if (onBase) {
      const status = await this.git(['status', '--porcelain', '-z'])
      if (status.code !== 0 || zList(status.output).length > 0) {
        return refused(`ta copie de travail a des modifications sur ${baseBranch} : enregistre-les avant la fusion.`)
      }
    }

    const fusion = join(this.deps.worktreeRoot, taskId, FUSION_DIR)
    const added = await this.git(['worktree', 'add', '--detach', fusion, before.output.trim()])
    if (added.code !== 0) return refused(`worktree de fusion impossible : ${added.output}`)
    const drop = async (): Promise<void> => {
      await this.git(['worktree', 'remove', '--force', fusion])
    }
    for (const branch of sinks) {
      const message = `chore(agents): ${taskId} · fusion de ${branch} (accord de mentalyas)`
      const merged = await this.git(['-C', fusion, 'merge', '--no-ff', '-m', message, branch])
      if (merged.code !== 0) {
        await this.git(['-C', fusion, 'merge', '--abort'])
        await drop()
        return refused(`la fusion de ${branch} est en conflit : ${merged.output}`)
      }
    }
    const checked = boxes.length === 0 ? 0 : await this.checkBoxes(fusion, boxes, taskId)
    const sha = (await this.git(['-C', fusion, 'rev-parse', 'HEAD'])).output.trim()
    await drop()
    // La base avance : par la copie de travail si elle y est (avance rapide seulement), sinon par sa référence.
    const moved = onBase
      ? await this.git(['merge', '--ff-only', sha])
      : await this.git(['update-ref', `refs/heads/${baseBranch}`, sha, before.output.trim()])
    if (moved.code !== 0) return refused(`${baseBranch} a bougé pendant la fusion : ${moved.output}`)
    this.deps.documentsFor(this.deps.projectDir).appendJournal({
      at: Date.now(),
      taskId,
      role: 'po',
      message: `Fusion acceptée par mentalyas sur ${baseBranch} (${sha.slice(0, 7)}).`
    })
    return { merged: true, baseBranch, commit: sha, checked }
  }

  /**
   * Coche les cases des tâches dans le worktree de fusion, en un commit (L1o D23, D25) ; rend le nombre de cases
   * cochées. Une tâche introuvable ou déjà cochée (par un agent) est passée ; un commit refusé (hook) remet les fichiers
   * tels quels et rend 0.
   */
  private async checkBoxes(fusion: string, boxes: readonly TaskBox[], taskId: string): Promise<number> {
    const texts = new Map<string, { readonly inside: string; text: string }>()
    let count = 0
    for (const box of boxes) {
      const file = resolve(fusion, box.path)
      const inside = relative(fusion, file)
      if (inside === '' || inside.startsWith('..') || isAbsolute(inside) || !existsSync(file)) continue
      const entry = texts.get(file) ?? { inside, text: readFileSync(file, 'utf8') }
      const next = checkTask(box.path, entry.text, box.key)
      if (next === null) continue
      entry.text = next
      texts.set(file, entry)
      count += 1
    }
    if (count === 0) return 0
    for (const [file, entry] of texts) writeFileSync(file, entry.text)
    const paths = [...texts.values()].map((entry) => entry.inside)
    const added = await this.git(['-C', fusion, 'add', '--', ...paths])
    const message =
      count === 1
        ? `docs(agents): ${taskId} faite (accord de mentalyas)`
        : `docs(agents): ${taskId} · ${count} tâches faites (accord de mentalyas)`
    const committed = added.code === 0 ? await this.git(['-C', fusion, 'commit', '-m', message]) : added
    if (committed.code === 0) return count
    await this.git(['-C', fusion, 'reset', '--quiet', '--', ...paths])
    await this.git(['-C', fusion, 'checkout', '--', ...paths])
    return 0
  }

  /**
   * Range les branches des agents après la fusion (L1o D23) : celles que la base contient sont supprimées (et leur
   * worktree s'il est resté), les autres gardées.
   */
  async cleanup(assembly: Assembly): Promise<CleanupResult> {
    const { taskId } = assembly
    if (!isValidTaskId(taskId)) throw new AppError('VALIDATION', 'Identifiant de tâche invalide.')
    const baseBranch = await this.baseOf(assembly)
    const removed: string[] = []
    const kept: string[] = []
    for (const agent of assembly.agents) {
      const branch = agentBranch(taskId, agent.id)
      const exists = await this.git(['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`])
      if (exists.code !== 0) continue
      const worktree = join(this.deps.worktreeRoot, taskId, agent.id)
      if (existsSync(worktree)) await this.git(['worktree', 'remove', '--force', worktree])
      const merged = await this.git(['merge-base', '--is-ancestor', branch, baseBranch])
      const deleted = merged.code === 0 ? await this.git(['branch', '-D', branch]) : merged
      ;(deleted.code === 0 ? removed : kept).push(branch)
    }
    return { removed, kept }
  }

  /** Assemblage valide et profils trouvés, ou une erreur de validation ; rend le profil de chaque agent. */
  private checked(assembly: Assembly): (agentId: string) => AgentProfileView {
    if (!isValidTaskId(assembly.taskId)) throw new AppError('VALIDATION', 'Identifiant de tâche invalide.')
    const profiles = new Map(this.deps.profiles().map((profile) => [profile.id, profile]))
    const find = (agentId: string): AgentProfileView | undefined => {
      const agent = assembly.agents.find((a) => a.id === agentId)
      return agent === undefined ? undefined : profiles.get(agent.profileId)
    }
    const error = assemblyError(assembly, (id) => find(id)?.role)
    if (error !== null) throw new AppError('VALIDATION', error)
    return (agentId) => find(agentId) as AgentProfileView
  }

  private async baseOf(assembly: Assembly): Promise<string> {
    const baseBranch = assembly.baseBranch ?? DEFAULT_BASE_BRANCH
    const base = await this.git(['rev-parse', '--verify', '--quiet', `${baseBranch}^{commit}`])
    if (base.code !== 0) throw new AppError('VALIDATION', `Branche de base « ${baseBranch} » introuvable.`)
    return baseBranch
  }

  private stop(result: AgentRunResult, reason: AgentStopReason, message: string): AgentRunResult {
    return { ...result, status: 'failed', stopped: { reason, message } }
  }

  /**
   * Lance les agents du plan dès que ceux qu'ils attendent ont fini (un agent hors du plan compte comme fini, sur son
   * résultat précédent) ; bloque ceux qui attendaient un agent arrêté, et n'en lance plus après une annulation.
   */
  private async schedule(input: {
    readonly assembly: Assembly
    readonly plan: ReadonlyMap<string, PassNature>
    readonly profileOf: (agentId: string) => AgentProfileView
    readonly baseBranch: string
    readonly signal: AbortSignal | undefined
    readonly latest: Map<string, Outcome>
    readonly passes: Map<string, number>
    readonly feedback: string | undefined
    /** Qui renvoie au PO : le QA (travail à reprendre) ou l'Architecte (trou dans la spec, L2-pipeline-optimal D1). */
    readonly feedbackFrom?: FeedbackSource
    readonly askChecks?: ChecksAsker
    readonly progress: ProgressListener
    readonly work: AgentWorkListener
  }): Promise<void> {
    const { assembly, plan, profileOf, latest, passes, signal, progress } = input
    const upstream = upstreamOf(assembly)
    const settled = new Set<string>()
    const running = new Map<string, Promise<void>>()
    const doneBefore = (id: string): boolean => !plan.has(id) && latest.get(id)?.result.status === 'done'
    const settle = (
      agent: AssemblyAgent,
      status: 'blocked' | 'cancelled',
      reason: AgentStopReason,
      message: string
    ) => {
      const profile = profileOf(agent.id)
      const previous = latest.get(agent.id)?.result
      latest.set(agent.id, {
        result: {
          agentId: agent.id,
          role: profile.role,
          profileName: profile.name,
          ...(previous?.index === undefined ? {} : { index: previous.index }),
          status,
          stopped: { reason, message }
        }
      })
      settled.add(agent.id)
      progress({
        agentId: agent.id,
        state: status,
        ...(previous?.index === undefined ? {} : { index: previous.index }),
        message
      })
    }
    // Les agents de ce tour attendent, sauf ceux qui démarrent aussitôt.
    for (const agent of assembly.agents) if (plan.has(agent.id)) progress({ agentId: agent.id, state: 'waiting' })
    const launchReady = (): void => {
      for (const agent of assembly.agents) {
        const nature = plan.get(agent.id)
        if (nature === undefined || settled.has(agent.id) || running.has(agent.id)) continue
        if (signal?.aborted === true) {
          settle(agent, 'cancelled', 'cancelled', 'annulé par mentalyas.')
          continue
        }
        const waits = upstream.get(agent.id) ?? []
        const failed = waits.find(
          (id) => (settled.has(id) && latest.get(id)?.result.status !== 'done') || (!plan.has(id) && !doneBefore(id))
        )
        if (failed !== undefined) {
          settle(agent, 'blocked', 'upstream-failed', `l’agent attendu « ${failed} » n’a pas abouti.`)
          continue
        }
        if (!waits.every((id) => doneBefore(id) || settled.has(id))) continue
        const pass = (passes.get(agent.id) ?? 0) + 1
        passes.set(agent.id, pass)
        // Une passe après la première reprend la session de la précédente (L2-pipeline-optimal D3).
        const previous = latest.get(agent.id)?.result.sessionId
        const turn: Turn = {
          assembly,
          agent,
          profile: profileOf(agent.id),
          upstream: waits.map((id) => agentBranch(assembly.taskId, id)),
          baseBranch: input.baseBranch,
          pass,
          nature,
          ...(input.feedback === undefined ? {} : { feedback: input.feedback }),
          ...(input.feedbackFrom === undefined ? {} : { feedbackFrom: input.feedbackFrom }),
          ...(input.askChecks === undefined ? {} : { askChecks: input.askChecks }),
          ...(previous === undefined ? {} : { previousSession: previous }),
          signal,
          work: input.work
        }
        progress({ agentId: agent.id, state: 'running', index: { pass, nature } })
        const task = this.execute(turn).then((outcome) => {
          latest.set(agent.id, outcome)
          progress(progressOf(outcome))
          settled.add(agent.id)
          running.delete(agent.id)
        })
        running.set(agent.id, task)
      }
    }

    // Un blocage peut en entraîner d'autres : on relance tant qu'un agent change d'état.
    for (;;) {
      let before: number
      do {
        before = settled.size + running.size
        launchReady()
      } while (settled.size + running.size !== before)
      if (running.size === 0) break
      await Promise.race(running.values())
    }
  }

  /** Une commande git à la fois : deux worktrees ajoutés ou deux commits en même temps se disputeraient les verrous. */
  private git(args: readonly string[]): ReturnType<GitPort> {
    const next = this.gitQueue.then(() => this.deps.git(args))
    this.gitQueue = next.catch(() => undefined)
    return next
  }

  /** Le tour d'un agent : son worktree, sa session, son commit ; rend son résultat (jamais d'exception). */
  private async execute(turn: Turn): Promise<Outcome> {
    const { assembly, agent, profile, upstream, signal } = turn
    const { taskId } = assembly
    const branch = agentBranch(taskId, agent.id)
    const worktree = join(this.deps.worktreeRoot, taskId, agent.id)
    let index: PassIndex = { pass: turn.pass, nature: turn.nature }
    // Consommation de la passe (L2-pipeline-optimal D10) : connue une fois la session finie, jointe au résultat.
    const measured: { usage?: PassUsage } = {}
    const head = (): AgentRunResult => ({
      agentId: agent.id,
      role: profile.role,
      profileName: profile.name,
      index,
      branch,
      status: 'done',
      ...(measured.usage === undefined ? {} : { usage: measured.usage })
    })
    // Le worktree d'un agent arrêté reste en place, pour voir où il en était.
    const fail = (reason: AgentStopReason, message: string, sessionId?: string, kept = true): Outcome => {
      this.deps.documentsFor(this.deps.projectDir).appendJournal({
        at: Date.now(),
        taskId,
        role: profile.role,
        message: `Arrêt de ${agent.id} (passe ${index.pass}) : ${message}`
      })
      return {
        result: {
          ...head(),
          status: reason === 'cancelled' ? 'cancelled' : 'failed',
          ...(kept ? { worktree } : {}),
          ...(sessionId === undefined ? {} : { sessionId }),
          stopped: { reason, message }
        }
      }
    }
    // Lu à chaque fois : l'annulation peut arriver pendant la session.
    const aborted = (): boolean => signal?.aborted === true
    const inTree = (args: readonly string[]): ReturnType<GitPort> => this.git(['-C', worktree, ...args])

    // Première passe : la branche part de la base ou du premier agent attendu. Passe suivante : elle reprend sa branche.
    const exists = await this.git(['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`])
    const added =
      exists.code === 0
        ? await this.git(['worktree', 'add', worktree, branch])
        : await this.git(['worktree', 'add', '-b', branch, worktree, upstream[0] ?? turn.baseBranch])
    if (added.code !== 0) return fail('git-failed', `worktree impossible : ${added.output}`, undefined, false)
    for (const other of exists.code === 0 ? upstream : upstream.slice(1)) {
      const merged = await inTree(['merge', '--no-ff', '--no-edit', other])
      if (merged.code !== 0) {
        await inTree(['merge', '--abort'])
        return fail('merge-conflict', `les résultats attendus ne se fusionnent pas (${other}) : ${merged.output}`)
      }
    }

    const documents = this.deps.documentsFor(worktree)
    const spec = documents.readSpec(taskId)
    if (assembly.agents.length > 1 && profile.role !== 'po' && spec === undefined) {
      return fail('missing-spec', 'aucune spec signée du Product Owner.')
    }
    // Le PO va signer la version suivante ; les autres appliquent celle qu'ils ont reçue.
    const specVersion = profile.role === 'po' ? (spec?.version ?? 0) + 1 : spec?.version
    index = { ...index, ...(specVersion === undefined ? {} : { specVersion }) }
    if (aborted()) return fail('cancelled', 'annulé par mentalyas.')

    turn.work(agent.id, { kind: 'start', pass: index.pass, nature: index.nature, worktree })
    // Écritures et commandes refusées pendant la session (mode de permission du profil, L1o D20).
    const refused = refusalsOf()
    const consumed = usageOf()
    // Identité de l'agent sur le pont (L2-pipeline-optimal D11) : la visio de l'agent sur le nœud de l'équipe.
    const bridgeNeuronId =
      assembly.hostId === undefined ? undefined : this.deps.agentNeuron?.(assembly.hostId, agent.id)
    const session = (id: string, resume: boolean): Promise<AgentSessionResult> =>
      this.deps.runSession({
        profile,
        sessionId: id,
        ...(resume ? { resume: true } : {}),
        ...(bridgeNeuronId === undefined ? {} : { bridgeNeuronId }),
        cwd: worktree,
        systemPrompt: [missionFor(turn, index), profile.instructions].filter((t) => t.trim() !== '').join('\n\n'),
        prompt: this.promptFor(turn, documents, spec),
        onEvent: (event) => {
          refused.see(event)
          consumed.see(event)
          turn.work(agent.id, { kind: 'stream', event, worktree })
        },
        ...(signal === undefined ? {} : { signal })
      })
    // Passe suivante : l'agent reprend sa session (L2-pipeline-optimal D3) ; si Claude Code ne la connaît plus (effacée,
    // autre poste), une session neuve prend le relais.
    let sessionId = turn.previousSession ?? (this.deps.newSessionId ?? randomUUID)()
    let result = await session(sessionId, turn.previousSession !== undefined)
    if (result.missingSession === true && !aborted()) {
      sessionId = (this.deps.newSessionId ?? randomUUID)()
      result = await session(sessionId, false)
    }
    const usage = consumed.usage()
    if (usage !== undefined) {
      measured.usage = usage
      documents.appendUsage({
        at: Date.now(),
        taskId,
        agentId: agent.id,
        role: profile.role,
        profileId: profile.id,
        pass: index.pass,
        nature: index.nature,
        ok: result.ok,
        usage
      })
    }
    turn.work(agent.id, {
      kind: 'end',
      ok: result.ok && result.text.trim() !== '',
      text: result.ok ? result.text : (result.error ?? 'La session a échoué.')
    })
    if (aborted()) return fail('cancelled', 'annulé par mentalyas.', sessionId)
    if (!result.ok || result.text.trim() === '') {
      return fail('agent-failed', result.error ?? 'l’agent n’a rendu aucun rapport.', sessionId)
    }
    // Écritures refusées et rien de changé : l'agent n'a pas travaillé, il ne compte pas comme fini (L1o D20).
    if (refused.count() > 0) {
      const status = await inTree(['status', '--porcelain', '-z'])
      if (status.code === 0 && zList(status.output).length === 0) {
        return fail(
          'permission-denied',
          `${refused.count()} écriture(s) ou commande(s) refusée(s) par le mode « ${
            AGENT_PERMISSION_LABELS[profile.permissionMode]
          } » de son profil, et rien n’a changé : passe-le en « Écrire sans demander » (ou « Libre » pour lancer les tests).`,
          sessionId
        )
      }
    }
    // Le PO signe la spec, l'Architecte le contrat (L2-pipeline-optimal D1) ; les autres rendent un rapport, dans le
    // worktree : ils voyagent avec la branche.
    let questions: readonly string[] = []
    let commands: readonly string[] = []
    if (profile.role === 'po') this.plans.set(taskId, documents.writeSpec(taskId, 'po', result.text).plan)
    else if (profile.role === 'architecte') {
      const contract = documents.writeContract(taskId, 'architecte', result.text)
      questions = contract.questions
      commands = contract.commands
    } else documents.writeReport(taskId, { id: agent.id, role: profile.role }, result.text, index)

    // Fichiers ajoutés par leur nom (jamais `git add -A`), hooks gardés (jamais `--no-verify`).
    const changed = await inTree(['diff', '--name-only', '-z', '--no-renames', 'HEAD'])
    const untracked = await inTree(['ls-files', '--others', '--exclude-standard', '-z'])
    if (changed.code !== 0 || untracked.code !== 0) return fail('git-failed', 'état du worktree illisible.', sessionId)
    if (changed.output.length >= FILE_LIST_MAX || untracked.output.length >= FILE_LIST_MAX) {
      return fail('git-failed', 'trop de fichiers modifiés pour les ajouter un par un : découper la tâche.', sessionId)
    }
    const files = [...new Set([...zList(changed.output), ...zList(untracked.output)])].filter((f) => f !== '')
    if (files.length > 0) {
      const staged = await inTree(['add', '--', ...files])
      if (staged.code !== 0) return fail('git-failed', `ajout impossible : ${staged.output}`, sessionId)
      const spec = index.specVersion === undefined ? '' : `, spec v${index.specVersion}`
      const message = `chore(agents): ${taskId} · ${agent.id} · passe ${index.pass} (${index.nature}${spec})`
      const committed = await inTree(['commit', '-m', message])
      if (committed.code !== 0) return fail('git-failed', `commit refusé : ${committed.output}`, sessionId)
      const touched = await inTree(['show', '--name-status', '--no-renames', '-z', '--format=', 'HEAD'])
      if (touched.code === 0) turn.work(agent.id, { kind: 'files', files: workFilesOf(touched.output), worktree })
    }
    const left = await inTree(['status', '--porcelain', '-z'])
    if (left.code !== 0 || zList(left.output).length > 0) {
      return fail('git-failed', `des fichiers sont restés hors du commit : ${zList(left.output).join(', ')}`, sessionId)
    }
    const sha = await inTree(['rev-parse', 'HEAD'])
    const removed = await this.git(['worktree', 'remove', worktree])
    // Questions au PO : le contrat attend une spec amendée ; ceux qui attendent l'Architecte ne partent pas (D1).
    // Sinon, mentalyas valide les commandes de vérification proposées avant le départ des développeurs (D2).
    const decision =
      questions.length === 0 && commands.length > 0 && turn.askChecks !== undefined && !aborted()
        ? await turn.askChecks(commands)
        : undefined
    const asked =
      questions.length > 0
        ? {
            status: 'failed' as const,
            stopped: {
              reason: 'spec-question' as const,
              message: `l’Architecte attend une réponse du PO (${questions.length} question(s)).`
            }
          }
        : decision?.approved === false
          ? {
              status: 'failed' as const,
              stopped: {
                reason: 'checks-refused' as const,
                message: 'commandes de vérification refusées par mentalyas : les développeurs ne partent pas.'
              }
            }
          : {}
    return {
      result: {
        ...head(),
        sessionId,
        ...(sha.code === 0 ? { commit: sha.output.trim() } : {}),
        ...(removed.code === 0 ? {} : { worktree }),
        ...asked
      },
      report: result.text
    }
  }

  private promptFor(
    turn: Turn,
    documents: PipelineDocuments,
    spec: { version: number; content: string } | undefined
  ): string {
    const { assembly, agent, profile } = turn
    const own = agent.task?.trim() ?? ''
    const parts: string[] = []
    const contract = documents.readContract(assembly.taskId)
    if (
      profile.role === 'po' &&
      turn.feedbackFrom === 'architecte' &&
      turn.feedback !== undefined &&
      spec !== undefined
    ) {
      // Trou dans la spec (L2-pipeline-optimal D1) : le PO amende, l'Architecte reprendra ; personne n'est désigné.
      parts.push(
        `Spec actuelle de la tâche ${assembly.taskId} (v${spec.version}) :`,
        spec.content,
        '',
        'L’Architecte a trouvé un trou dans la spec et ne peut pas décider sans ta réponse :',
        turn.feedback,
        '',
        `Amende la spec pour y répondre : elle remplace la v${spec.version} (garde tout ce qui ne change pas, et les lignes « RECOMMANDÉ: », « SUGGÉRÉ: », « AIGUILLAGE: », « RYTHME: » s’il y en a). Ta réponse EST la spec.`
      )
    } else if (profile.role === 'po' && turn.feedback !== undefined && spec !== undefined) {
      const others = assembly.agents
        .filter((a) => a.id !== agent.id)
        .map((a) => a.id)
        .join(', ')
      parts.push(
        `Spec actuelle de la tâche ${assembly.taskId} (v${spec.version}) :`,
        spec.content,
        '',
        'Le QA a renvoyé le travail :',
        turn.feedback,
        '',
        `Réécris la spec complète : elle remplace la v${spec.version}. Ta réponse EST la spec.`,
        `Termine-la par une dernière ligne « AGENTS: <agent>=correction, <agent>=repasse » qui désigne les agents à relancer (parmi : ${others}).`,
        'correction : l’agent doit reprendre une erreur dans sa partie ; repasse : il n’est pas en faute, mais la spec a changé là où il travaille.',
        assembly.lot === undefined
          ? 'Garde les lignes « RECOMMANDÉ: » et « SUGGÉRÉ: » de la spec (mises à jour si besoin) juste avant cette dernière ligne.'
          : 'Garde les lignes « RECOMMANDÉ: », « SUGGÉRÉ: », « AIGUILLAGE: » et « RYTHME: » de la spec (mises à jour si besoin) juste avant cette dernière ligne.'
      )
    } else if (profile.role === 'po') {
      parts.push(
        `Tâche ${assembly.taskId} :`,
        assembly.brief.trim(),
        '',
        assembly.lot === undefined
          ? 'Rédige la spec de cette tâche (objectif, critères d’acceptation, hors périmètre). Ta réponse EST la spec.'
          : lotInstructions(assembly.lot, assembly.lotFile),
        '',
        'Profils d’agents existants :',
        profileCatalog(this.deps.profiles()),
        '',
        SPEC_AGENTS_INSTRUCTIONS
      )
    } else if (profile.role === 'architecte' && spec !== undefined) {
      // L'Architecte décide le comment (L2-pipeline-optimal D1) : contrat figé avant le départ des développeurs.
      const roles = new Map(this.deps.profiles().map((p) => [p.id, p.role] as const))
      parts.push(`Spec signée de la tâche ${assembly.taskId} (v${spec.version}) :`, spec.content)
      if (contract !== undefined) {
        parts.push(
          '',
          `Ton contrat précédent (v${contract.version}) : reprends-le d’après cette spec.`,
          contract.content
        )
      }
      parts.push(
        '',
        contractInstructions(assembly.agents.map((a) => ({ id: a.id, role: roles.get(a.profileId) ?? 'autre' })))
      )
    } else if (spec === undefined) {
      parts.push(`Tâche ${assembly.taskId} :`, assembly.brief.trim())
    } else {
      parts.push(`Spec signée de la tâche ${assembly.taskId} (v${spec.version}) :`, spec.content)
      if (contract !== undefined) {
        parts.push('', `Contrat de l’Architecte (v${contract.version}) : tu t’y tiens.`, contract.content)
      }
      const reports = documents.listReports(assembly.taskId).filter((report) => report.agentId !== agent.id)
      if (reports.length > 0) {
        parts.push('', 'Rapports des agents dont tu reprends le travail :')
        for (const report of reports) {
          const head = `${report.agentId} (${AGENT_ROLE_LABELS[report.role]}, passe ${report.index.pass} ${report.index.nature})`
          parts.push(`\n### ${head}\n${report.content}`)
        }
      }
    }
    if (own !== '') parts.push('', 'Ta part :', own)
    // La zone fixée par l'Architecte remplace celle saisie à la main (L2-pipeline-optimal D1, CA2.3).
    const zone = contract?.zones.find((entry) => entry.agent === agent.id)?.paths ?? agent.zone
    if (zone !== undefined && zone.length > 0 && profile.role !== 'architecte') {
      parts.push('', `Ta zone de travail : ${zone.join(', ')}. Reste dedans : d’autres agents travaillent ailleurs.`)
    }
    if (profile.role === 'qa') {
      parts.push(
        '',
        `Vérifie le travail contre la spec${contract === undefined ? '' : ', le contrat'} et la branche « ${turn.baseBranch} » : critères d’acceptation, tests, régressions.`,
        'Si tu trouves des erreurs, documente-les : à qui elles reviennent, comment les reproduire.',
        'Termine ton rapport par UNE dernière ligne : « VERDICT: VALIDE » (prêt pour l’accord de mentalyas) ou « VERDICT: RENVOI » (le PO reprendra la spec).'
      )
    } else if (profile.role !== 'po' && profile.role !== 'architecte') {
      parts.push('', 'Fais ta part, puis rends ton rapport.')
    }
    return parts.join('\n')
  }
}
