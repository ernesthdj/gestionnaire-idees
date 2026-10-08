import { randomUUID } from 'node:crypto'
import { existsSync, lstatSync, readdirSync, realpathSync, rmSync, symlinkSync, unlinkSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import {
  UPDATE_CHECKS,
  type ProposalStatus,
  type ProposalView,
  type UpdateCheckName,
  type UpdateCheckStatus,
  type UpdateDiffView,
  type UpdateProgressEvent,
  type UpdateStatus,
  type UpdateView
} from '@shared/ipc/analyste'
import { branchName, isAnalystBranch, worktreeRelPath, WORKTREES_DIR } from '../../domain/analyste/branchName'
import { AppError } from '../../domain/errors'
import { updateView, type UpdateRow } from '../../infrastructure/db/repositories/AnalysteRepository'
import type { CheckRunner } from '../../infrastructure/analyste/NpmCli'

export interface GitOutcome {
  /** `null` : git introuvable, arrêté ou lancement impossible. */
  readonly code: number | null
  readonly output: string
}

export interface UpdateStore {
  proposal(id: string): ProposalView | undefined
  setStatus(id: string, status: ProposalStatus, refusalReason: string | null, at: number): void
  insertUpdate(row: UpdateRow): void
  updateRow(id: string): UpdateRow | undefined
  patchUpdate(id: string, patch: Partial<Omit<UpdateRow, 'id'>>): void
  updateOf(proposalId: string): UpdateRow | undefined
  updatesIn(statuses: readonly UpdateStatus[]): UpdateRow[]
  updateByConversation(neuronId: string): UpdateRow | undefined
  insertUpdateChat(input: { readonly id: string; readonly title: string; readonly dir: string }): void
}

export interface UpdateServiceDeps {
  readonly store: UpdateStore
  /** Dépôt désigné et actif (RepoGuard) ; `null` si l'Analyste est inactif. */
  readonly repoPath: () => string | null
  readonly git: (cwd: string, args: readonly string[], timeoutMs?: number) => Promise<GitOutcome>
  /** Vérifications npm ; `null` si node ou npm sont introuvables. */
  readonly checks: CheckRunner | null
  /** Premier message de la conversation de codage (la fiche, comme donnée). */
  readonly sendToConversation: (neuronId: string, text: string) => Promise<void>
  readonly emit: (event: UpdateProgressEvent) => void
  readonly now?: () => number
  readonly newId?: () => string
}

/** Mises à jour en cours : une seule en codage à la fois (FR-037). */
const ACTIVE: readonly UpdateStatus[] = ['coding', 'to_fix', 'ready', 'keeping']
const CODING: readonly UpdateStatus[] = ['coding', 'to_fix']
const DEPS_FILES = new Set(['package.json', 'package-lock.json'])
const PATCH_MAX = 500 * 1024

type Checks = Record<UpdateCheckName, { status: UpdateCheckStatus; tail?: string }>
const pendingChecks = (): Checks =>
  Object.fromEntries(UPDATE_CHECKS.map((name) => [name, { status: 'pending' }])) as Checks

/**
 * Mises à jour de l'Analyste (spec 019 US4, FR-027 à FR-039, research R5–R8, constitution I et II) : sur un clic de
 * mentalyas, une branche `analyste/*` et une copie de travail séparée du dépôt (l'app ouverte n'est jamais touchée),
 * une conversation Claude limitée à cette copie, l'enregistrement et les vérifications, puis Garder (fusion
 * `--no-ff`) ou Jeter (copie et branche retirées, et seulement elles). Jamais de push, de reset, de rebase ni de
 * forçage ; aucun co-auteur.
 */
export class UpdateService {
  private readonly running = new Map<string, AbortController>()

  constructor(private readonly deps: UpdateServiceDeps) {}

  view(updateId: string): UpdateView {
    return updateView(this.row(updateId))
  }

  /** Mise à jour de cette proposition, s'il y en a une. */
  ofProposal(proposalId: string): UpdateView | null {
    const row = this.deps.store.updateOf(proposalId)
    return row === undefined ? null : updateView(row)
  }

  /** « Coder avec Claude » : dépôt propre sur sa branche de base, branche + copie de travail, conversation. */
  async start(proposalId: string): Promise<UpdateView> {
    const { store } = this.deps
    const repo = this.repo()
    const proposal = store.proposal(proposalId)
    if (proposal === undefined) throw new AppError('NOT_FOUND', 'Proposition introuvable')
    if (!['new', 'postponed', 'accepted'].includes(proposal.status)) {
      throw new AppError('INVALID_TRANSITION', 'Cette proposition ne peut plus être codée')
    }
    if (store.updatesIn(ACTIVE).length > 0) {
      throw new AppError('UPDATE_CODING', 'Une autre mise à jour est déjà en cours : termine-la ou jette-la')
    }
    // Acceptée même si le dépôt n'est pas prêt : l'acceptation reste reprenable (FR-028).
    if (proposal.status !== 'accepted') store.setStatus(proposalId, 'accepted', null, this.now())
    const status = await this.git(repo, ['status', '--porcelain'])
    if (status.output.trim() !== '') {
      throw new AppError('REPO_DIRTY', 'Le dépôt a des changements non enregistrés : commite-les ou mets-les de côté')
    }
    const head = await this.deps.git(repo, ['symbolic-ref', '--short', '-q', 'HEAD'])
    const baseBranch = head.output.trim()
    if (head.code !== 0 || baseBranch === '' || baseBranch.startsWith('analyste/')) {
      throw new AppError(
        'NOT_ON_BASE',
        'Le dépôt doit être sur sa branche de base (pas une branche analyste ni détaché)'
      )
    }
    const baseSha = (await this.git(repo, ['rev-parse', 'HEAD'])).output.trim()
    const id = this.newId()
    const branch = branchName(id, proposal.title)
    const folder = join(repo, ...worktreeRelPath(id).split('/'))
    await this.git(repo, ['worktree', 'add', '-b', branch, folder, baseSha], 120_000)
    try {
      this.linkModules(repo, folder)
      const neuronId = this.newId()
      store.insertUpdateChat({ id: neuronId, title: `Mise à jour : ${proposal.title}`, dir: folder })
      const at = this.now()
      store.insertUpdate({
        id,
        proposalId,
        branch,
        worktreePath: folder,
        baseSha,
        baseBranch,
        headSha: null,
        mergeSha: null,
        revertSha: null,
        status: 'coding',
        checks: JSON.stringify(pendingChecks()),
        depsChanged: false,
        conversationNeuronId: neuronId,
        discardReason: null,
        createdAt: at,
        updatedAt: at
      })
      store.setStatus(proposalId, 'coding', null, at)
      void this.deps.sendToConversation(neuronId, codingBrief(proposal, branch)).catch(() => undefined)
      return this.view(id)
    } catch (error) {
      await this.removeCopy(repo, folder, branch)
      throw error
    }
  }

  /**
   * « Terminer le codage » : tout le travail de la copie est enregistré sur la branche (référence à la proposition,
   * sans co-auteur), puis les vérifications tournent en arrière-plan ; « Relancer » refait les vérifications.
   */
  async finish(updateId: string): Promise<UpdateView> {
    const row = this.row(updateId)
    if (!CODING.includes(row.status) && row.status !== 'ready') {
      throw new AppError('INVALID_TRANSITION', 'Cette mise à jour n’est plus en codage')
    }
    const proposal = this.deps.store.proposal(row.proposalId)
    this.deps.emit({ updateId, step: 'commit' })
    await this.git(row.worktreePath, ['add', '-A'])
    const staged = await this.deps.git(row.worktreePath, ['diff', '--cached', '--quiet'])
    if (staged.code === 1) {
      await this.git(row.worktreePath, [
        'commit',
        '-m',
        `Analyste : ${proposal?.title ?? 'mise à jour'}`,
        '--trailer',
        `Analyste-Proposal: ${row.proposalId}`
      ])
    } else if (staged.code !== 0) {
      throw new AppError('GIT_FAILED', 'git n’a pas pu lire les changements de la copie de travail')
    }
    const ahead = await this.git(row.worktreePath, ['rev-list', '--count', `${row.baseSha}..HEAD`])
    if (Number(ahead.output.trim()) === 0) {
      throw new AppError(
        'NOTHING_CHANGED',
        'Rien n’a changé dans la copie de travail : demande à Claude de coder d’abord'
      )
    }
    const headSha = (await this.git(row.worktreePath, ['rev-parse', 'HEAD'])).output.trim()
    const changed = await this.git(row.worktreePath, ['diff', '--name-only', row.baseSha, 'HEAD'])
    const depsChanged = changed.output.split(/\r?\n/).some((path) => DEPS_FILES.has(path.trim()))
    const repo = this.repo()
    if (depsChanged) this.unlinkModules(row.worktreePath)
    else this.linkModules(repo, row.worktreePath)
    this.deps.store.patchUpdate(updateId, {
      headSha,
      depsChanged,
      checks: JSON.stringify(pendingChecks()),
      status: 'coding',
      updatedAt: this.now()
    })
    void this.runChecks(updateId)
    return this.view(updateId)
  }

  /** Fichiers modifiés (lignes ajoutées et retirées) et patch borné (FR-032). */
  async diff(updateId: string): Promise<UpdateDiffView> {
    const row = this.row(updateId)
    const target = row.headSha ?? 'HEAD'
    const cwd = existsSync(row.worktreePath) ? row.worktreePath : this.repo()
    const numstat = await this.git(cwd, ['diff', '--numstat', row.baseSha, target])
    const files = numstat.output
      .split(/\r?\n/)
      .map((line) => line.split('\t'))
      .filter((parts) => parts.length === 3)
      .map(([added, removed, path]) => ({
        path: path ?? '',
        added: Number(added) || 0,
        removed: Number(removed) || 0
      }))
    const patch = (await this.deps.git(cwd, ['diff', row.baseSha, target], 60_000)).output
    return { files, patch: patch.slice(0, PATCH_MAX), truncated: patch.length > PATCH_MAX }
  }

  /** « Essayer » : la commande à lancer dans la copie de travail (profil d'essai, D13). */
  tryCommand(updateId: string): { command: string; folder: string } {
    const row = this.row(updateId)
    if (row.status !== 'ready' && row.status !== 'to_fix') throw new AppError('NOT_READY', 'Termine le codage d’abord')
    return { command: 'npm run essai', folder: row.worktreePath }
  }

  /** « Garder » : vérifications vertes, dépôt propre sur sa base, fusion `--no-ff`, copie et branche retirées. */
  async keep(updateId: string): Promise<UpdateView> {
    const row = this.row(updateId)
    const view = updateView(row)
    if (row.status !== 'ready' || UPDATE_CHECKS.some((name) => view.checks[name].status !== 'ok')) {
      throw new AppError('CHECKS_NOT_GREEN', 'Toutes les vérifications doivent être réussies avant de garder')
    }
    const repo = this.repo()
    if ((await this.git(repo, ['status', '--porcelain'])).output.trim() !== '') {
      throw new AppError('REPO_DIRTY', 'Le dépôt a des changements non enregistrés : impossible de fusionner')
    }
    const current = (await this.deps.git(repo, ['symbolic-ref', '--short', '-q', 'HEAD'])).output.trim()
    if (current !== row.baseBranch) {
      throw new AppError(
        'NOT_ON_BASE',
        `Le dépôt doit être sur ${row.baseBranch ?? 'sa branche de base'} pour fusionner`
      )
    }
    if (!isAnalystBranch(row.branch)) throw new AppError('GIT_FAILED', 'Branche inattendue')
    // État écrit avant la fusion : un rechargement de l'app pendant la fusion est réconcilié au démarrage (R8).
    this.setStatus(row, 'keeping')
    const proposal = this.deps.store.proposal(row.proposalId)
    const merge = await this.deps.git(
      repo,
      ['merge', '--no-ff', '-m', `Analyste : fusion de ${proposal?.title ?? row.branch}`, row.branch],
      120_000
    )
    if (merge.code !== 0) {
      await this.deps.git(repo, ['merge', '--abort'])
      this.setStatus(row, 'ready')
      throw new AppError(
        'MERGE_CONFLICT',
        'Conflit à la fusion : tout est remis en l’état ; continue la conversation ou jette'
      )
    }
    const mergeSha = (await this.git(repo, ['rev-parse', 'HEAD'])).output.trim()
    await this.removeCopy(repo, row.worktreePath, row.branch, false)
    this.deps.store.patchUpdate(row.id, { mergeSha, status: 'kept', updatedAt: this.now() })
    this.deps.store.setStatus(row.proposalId, 'kept', null, this.now())
    this.deps.emit({ updateId, step: 'kept' })
    return this.view(updateId)
  }

  /** « Jeter » : la copie de travail et la branche, et seulement elles (FR-035). */
  async discard(updateId: string, reason?: string): Promise<UpdateView> {
    const row = this.row(updateId)
    if (!ACTIVE.includes(row.status) || row.status === 'keeping') {
      throw new AppError('INVALID_TRANSITION', 'Cette mise à jour ne peut plus être jetée')
    }
    this.running.get(updateId)?.abort()
    await this.removeCopy(this.repo(), row.worktreePath, row.branch, true)
    this.deps.store.patchUpdate(row.id, { status: 'discarded', discardReason: reason ?? null, updatedAt: this.now() })
    this.deps.store.setStatus(row.proposalId, 'discarded', null, this.now())
    this.deps.emit({ updateId, step: 'discarded' })
    return this.view(updateId)
  }

  /**
   * Garde d'écriture de la conversation de codage (FR-030) : une écriture hors de la copie de travail, ou dans
   * `node_modules` (jonction vers le dépôt principal), est refusée. `null` = autorisée (ou pas une conversation de
   * mise à jour).
   */
  guardWrite(neuronId: string, filePath: string): string | null {
    const row = this.deps.store.updateByConversation(neuronId)
    if (row === undefined) return null
    if (!CODING.includes(row.status)) return 'Cette mise à jour n’est plus en codage : aucune écriture.'
    const root = realOrSelf(row.worktreePath)
    const target = realThroughAncestors(isAbsolute(filePath) ? filePath : join(row.worktreePath, filePath))
    const inside = target.toLowerCase().startsWith(root.toLowerCase() + sep)
    const rel = relative(root, target).split(sep)
    if (!inside || rel[0] === 'node_modules' || rel[0] === '.git') {
      return 'Écriture refusée : la mise à jour ne modifie que les fichiers de sa copie de travail (hors node_modules et .git).'
    }
    return null
  }

  /**
   * Démarrage (FR-039, R8) : une fusion interrompue est réconciliée avec git ; une copie disparue fait échouer sa mise
   * à jour ; une copie orpheline sans travail est retirée (une copie avec du travail reste, signalée au journal).
   */
  async reconcile(): Promise<{ readonly orphansKept: number }> {
    const repo = this.deps.repoPath()
    if (repo === null) return { orphansKept: 0 }
    for (const row of this.deps.store.updatesIn(['keeping'])) {
      const merged = await this.deps.git(repo, ['merge-base', '--is-ancestor', row.headSha ?? row.branch, 'HEAD'])
      if (merged.code === 0) {
        await this.removeCopy(repo, row.worktreePath, row.branch, false)
        this.deps.store.patchUpdate(row.id, { status: 'kept', updatedAt: this.now() })
        this.deps.store.setStatus(row.proposalId, 'kept', null, this.now())
      } else this.setStatus(row, 'ready')
    }
    const live = new Set<string>()
    for (const row of this.deps.store.updatesIn(['coding', 'to_fix', 'ready'])) {
      if (existsSync(row.worktreePath)) live.add(resolve(row.worktreePath).toLowerCase())
      else {
        this.deps.store.patchUpdate(row.id, { status: 'failed', updatedAt: this.now() })
        this.deps.store.setStatus(row.proposalId, 'accepted', null, this.now())
      }
    }
    let orphansKept = 0
    const dir = join(repo, ...WORKTREES_DIR.split('/'))
    for (const name of existsSync(dir) ? readdirSync(dir) : []) {
      const folder = join(dir, name)
      if (live.has(resolve(folder).toLowerCase())) continue
      const dirty = await this.deps.git(folder, ['status', '--porcelain'])
      if (dirty.code === 0 && dirty.output.trim() !== '') {
        orphansKept += 1
        continue
      }
      this.unlinkModules(folder)
      await this.deps.git(repo, ['worktree', 'remove', folder])
    }
    await this.deps.git(repo, ['worktree', 'prune'])
    return { orphansKept }
  }

  // --- Interne ---------------------------------------------------------------------------------------------------

  private async runChecks(updateId: string): Promise<void> {
    const controller = new AbortController()
    this.running.set(updateId, controller)
    const checks = pendingChecks()
    const save = (): void =>
      this.deps.store.patchUpdate(updateId, { checks: JSON.stringify(checks), updatedAt: this.now() })
    try {
      const row = this.row(updateId)
      if (this.deps.checks === null || row.depsChanged) {
        // npm introuvable, ou dépendances à installer à la main d'abord (D12) : rien n'est lancé.
        const tail = row.depsChanged
          ? 'Dépendances modifiées : lance « npm ci » dans la copie de travail, puis « Relancer les vérifications ».'
          : 'node ou npm introuvable dans le PATH.'
        checks.typecheck = { status: 'fail', tail }
        save()
        this.finishChecks(row, false)
        return
      }
      this.deps.emit({ updateId, step: 'checks' })
      let ok = true
      for (const name of UPDATE_CHECKS) {
        if (controller.signal.aborted) return
        checks[name] = { status: 'running' }
        save()
        this.deps.emit({ updateId, step: 'checks', check: { name, status: 'running' } })
        const result = await this.deps.checks(row.worktreePath, name, controller.signal)
        checks[name] = result.ok ? { status: 'ok' } : { status: 'fail', tail: result.tail }
        ok &&= result.ok
        save()
        this.deps.emit({ updateId, step: 'checks', check: { name, status: checks[name].status } })
      }
      if (!controller.signal.aborted) this.finishChecks(this.row(updateId), ok)
    } catch {
      this.deps.store.patchUpdate(updateId, { status: 'to_fix', updatedAt: this.now() })
      this.deps.emit({ updateId, step: 'failed' })
    } finally {
      this.running.delete(updateId)
    }
  }

  private finishChecks(row: UpdateRow, ok: boolean): void {
    this.setStatus(row, ok ? 'ready' : 'to_fix')
    this.deps.emit({ updateId: row.id, step: ok ? 'ready' : 'to_fix' })
  }

  /** Statut de la mise à jour et de sa proposition, ensemble. */
  private setStatus(row: UpdateRow, status: 'coding' | 'to_fix' | 'ready' | 'keeping'): void {
    this.deps.store.patchUpdate(row.id, { status, updatedAt: this.now() })
    const proposal: ProposalStatus = status === 'keeping' ? 'ready' : status
    this.deps.store.setStatus(row.proposalId, proposal, null, this.now())
  }

  /** Jonction `node_modules` vers le dépôt principal (R6) : vérifications en secondes, sans droits admin. */
  private linkModules(repo: string, folder: string): void {
    const link = join(folder, 'node_modules')
    const target = join(repo, 'node_modules')
    if (!existsSync(target) || pathPresent(link)) return
    symlinkSync(target, link, 'junction')
  }

  private unlinkModules(folder: string): void {
    const link = join(folder, 'node_modules')
    try {
      if (lstatSync(link).isSymbolicLink()) unlinkSync(link)
    } catch {
      // Absente : rien à retirer.
    }
  }

  /** Retire la copie de travail puis la branche `analyste/*` (jamais une autre). */
  private async removeCopy(repo: string, folder: string, branch: string, discard = true): Promise<void> {
    this.unlinkModules(folder)
    if (existsSync(folder)) {
      const removed = await this.deps.git(repo, ['worktree', 'remove', ...(discard ? ['--force'] : []), folder])
      if (removed.code !== 0 && discard) rmSync(folder, { recursive: true, force: true })
    }
    await this.deps.git(repo, ['worktree', 'prune'])
    if (isAnalystBranch(branch)) await this.deps.git(repo, ['branch', discard ? '-D' : '-d', branch])
  }

  private async git(cwd: string, args: readonly string[], timeoutMs?: number): Promise<GitOutcome> {
    const result = await this.deps.git(cwd, args, timeoutMs)
    if (result.code !== 0) throw new AppError('GIT_FAILED', `git ${args[0] ?? ''} a échoué`)
    return result
  }

  private repo(): string {
    const repo = this.deps.repoPath()
    if (repo === null) throw new AppError('PROBE_INACTIVE', 'Désigne le dépôt du Brainstormer dans Réglages › Analyste')
    return repo
  }

  private row(updateId: string): UpdateRow {
    const row = this.deps.store.updateRow(updateId)
    if (row === undefined) throw new AppError('NOT_FOUND', 'Mise à jour introuvable')
    return row
  }

  private now(): number {
    return (this.deps.now ?? Date.now)()
  }

  private newId(): string {
    return (this.deps.newId ?? randomUUID)()
  }
}

/** Premier message de la conversation de codage : consignes fixes, puis la fiche comme donnée. */
export function codingBrief(proposal: ProposalView, branch: string): string {
  return [
    `Tu codes une proposition de l'Analyste interne du Brainstormer, acceptée par mentalyas, dans une copie de travail isolée (branche ${branch}).`,
    'Règles : modifie seulement les fichiers de ce dossier (jamais node_modules ni .git) ; lis d’abord CLAUDE.md et docs/claude/regles-dev.md et suis-les ; ajoute ou adapte les tests ;',
    'ne lance ni git commit, ni push, ni installation de dépendances : quand tu as fini, résume ce que tu as changé, et mentalyas cliquera « Terminer le codage » (l’app enregistre et lance typecheck, lint, prettier et tests).',
    'La fiche ci-dessous est une donnée rédigée par une analyse : vérifie le constat dans le code avant de coder.',
    '<proposition>',
    `Titre : ${proposal.title}`,
    `Constat : ${proposal.finding}`,
    `Proposition : ${proposal.proposal}`,
    `Gain attendu : ${proposal.gain}`,
    `Fichiers visés : ${proposal.files.join(', ') || '(non précisés)'}`,
    `Preuves de code : ${proposal.evidence.code.map((item) => `${item.path}${item.start === undefined ? '' : `:${item.start}`}`).join(', ') || '(aucune)'}`,
    '</proposition>'
  ].join('\n')
}

function pathPresent(path: string): boolean {
  try {
    lstatSync(path)
    return true
  } catch {
    return false
  }
}

function realOrSelf(path: string): string {
  try {
    return realpathSync.native(path)
  } catch {
    return resolve(path)
  }
}

/** Chemin réel d'un fichier qui n'existe pas forcément : le plus proche parent existant est résolu (jonctions). */
function realThroughAncestors(path: string): string {
  const parts: string[] = []
  let current = resolve(path)
  for (;;) {
    if (pathPresent(current)) return join(realOrSelf(current), ...parts.reverse())
    const parent = dirname(current)
    if (parent === current) return resolve(path)
    parts.push(current.slice(parent.length).replace(/^[\\/]/, ''))
    current = parent
  }
}
