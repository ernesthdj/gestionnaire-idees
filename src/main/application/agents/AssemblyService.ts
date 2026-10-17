import { lotGroups, lotLabel, routeLot, type LotPlan, type LotTask } from '@shared/agents/lotPlan'
import { isValidTaskId } from '@shared/agents/documents'
import type { AgentWorkEvent, AgentWorkListener } from './PipelineEngine'
import {
  structureError,
  type AgentProgress,
  type ApprovalResult,
  type Assembly,
  type AssemblyAgent,
  type AssemblyLink,
  type AssemblyRunResult,
  type CleanupResult,
  type ProgressListener
} from '@shared/agents/pipeline'
import { REPORT_MAX, type AgentLiveView, type AssemblyRunView, type AssemblySketchView } from '@shared/ipc/assemblies'
import { AppError } from '../../domain/errors'
import type { TaskBox } from './workflowHost'

/** Nœud de la carte auquel on connecte des agents : idée, tâche ou module d'un projet lié. */
export interface AssemblyNode {
  readonly genesisId: string
  readonly kind: string
  readonly title: string
  readonly content: string | null
  /** Fiche du nœud en Markdown. */
  readonly sheet: string
  /** Dossier du projet lié ; `null` : le nœud n'est pas dans un projet. */
  readonly projectDir: string | null
  readonly projectName: string
  /** Case de la tâche (nœud tâche d'un fichier de tâches) : cochée à la fusion (L1o D23). */
  readonly box?: TaskBox
  /** Tâches d'un lot ou d'un fichier de tâches (L1o D25). */
  readonly lotTasks?: readonly LotTask[]
  /** Fichier de ces tâches : la fusion y coche celles du plan. */
  readonly lotFile?: string
}

/** Le planificateur, vu par le service (`PipelineEngine` en vrai). */
export interface AssemblyEngine {
  check(assembly: Assembly): Promise<void>
  warnings(assembly: Assembly): string[]
  /** Fichiers non commités de la copie de travail (L1o D20) : l'avertissement, ou `null`. */
  uncommittedWarning?(): Promise<string | null>
  run(
    assembly: Assembly,
    signal?: AbortSignal,
    onProgress?: ProgressListener,
    onWork?: AgentWorkListener
  ): Promise<AssemblyRunResult>
  approve(assembly: Assembly, boxes?: readonly TaskBox[]): Promise<ApprovalResult>
  cleanup?(assembly: Assembly): Promise<CleanupResult>
}

/** Croquis gardés (un par nœud) : la base de données en vrai. */
export interface SketchStore {
  list(genesisId?: string): AssemblySketchView[]
  save(sketch: AssemblySketchView): void
  remove(nodeId: string): void
}

export interface AssemblyServiceDeps {
  readonly sketches: SketchStore
  readonly node: (nodeId: string) => AssemblyNode | undefined
  /** Raison pour laquelle on ne lance pas d'agent sur ce projet (« Local uniquement »…), ou `null`. */
  readonly refusal: (genesisId: string) => string | null
  /** Les conversations du nœud et de ses agents suivent une équipe rattachée (L1o D27). */
  readonly moveChats?: (genesisId: string, fromNodeId: string, toNodeId: string) => void
  readonly engineFor: (project: {
    readonly genesisId: string
    readonly projectDir: string
    readonly projectName: string
  }) => AssemblyEngine
  readonly emit: (genesisId: string, taskId: string) => void
  /** Ce que fait chaque agent au fil de l'eau (L1o D18) : inscrit dans sa conversation de visio. */
  readonly workLog?: (hostId: string, agentId: string, event: AgentWorkEvent) => void
  /** Travail livré (L1o D13) : crédite les profils des agents d'un assemblage validé, puis fusionné. */
  readonly credit?: (profileIds: readonly string[]) => void
  readonly now?: () => number
}

/** Ce que mentalyas demande : un nœud, une tâche, des agents et leurs liens (le contexte vient du nœud). */
export interface AssemblyRequest {
  readonly nodeId: string
  readonly taskId: string
  /** Ce qui est demandé en particulier (la tâche, en ses mots) ; s'ajoute au contexte du nœud. */
  readonly task?: string
  readonly agents: readonly AssemblyAgent[]
  readonly links: readonly AssemblyLink[]
  readonly baseBranch?: string
}

/** Au-delà, le contexte du nœud est coupé : il part dans la mission de chaque agent. */
const BRIEF_MAX = 20_000

interface Run {
  readonly node: AssemblyNode
  readonly nodeId: string
  readonly assembly: Assembly
  readonly engine: AssemblyEngine
  readonly warnings: readonly string[]
  readonly controller: AbortController
  readonly startedAt: number
  /** État en direct de chaque agent, dans l'ordre de l'assemblage. */
  readonly live: Map<string, AgentLiveView>
  state: AssemblyRunView['state']
  finishedAt?: number
  result?: AssemblyRunResult
  approval?: ApprovalResult
  error?: string
  approving: boolean
}

/** Mission écrite à partir du nœud (L1o D1 : le PO inspecte le contexte ; D12 : l'agent seul lit la tâche et le contexte). */
export function briefFor(node: AssemblyNode, task: string | undefined): string {
  const parts = [`Nœud « ${node.title} » (${node.kind}).`]
  if (node.content !== null && node.content.trim() !== '') parts.push(node.content.trim())
  parts.push('Fiche du nœud :', node.sheet)
  if (task !== undefined && task.trim() !== '') parts.push('', 'Tâche demandée :', task.trim())
  const brief = parts.join('\n')
  return brief.length > BRIEF_MAX ? `${brief.slice(0, BRIEF_MAX)}\n[contexte coupé]` : brief
}

/**
 * Cases cochées à la fusion (L1o D23, D25) : celle de la tâche du nœud ; pour un lot, celles des tâches à faire que le
 * plan du PO aiguille (toutes, s'il n'a pas aiguillé), dans le fichier du lot. Pur.
 */
export function boxesOf(node: AssemblyNode, plan: LotPlan | undefined): TaskBox[] {
  if (node.box !== undefined) return [node.box]
  const { lotFile, lotTasks } = node
  if (lotFile === undefined || lotTasks === undefined) return []
  const planned = new Set((plan?.steps ?? []).map((step) => step.task))
  return lotTasks
    .map((task, index) => ({ task, label: lotLabel(task, index) }))
    .filter(({ task, label }) => !task.done && task.key !== '' && (planned.size === 0 || planned.has(label)))
    .map(({ task }) => ({ path: lotFile, key: task.key }))
}

/**
 * Agents connectés à un nœud (T005, L1o D1 et D12) : un PO (ou un agent seul) reçoit le contexte du nœud, le planificateur
 * tourne en arrière-plan, mentalyas suit l'assemblage, l'arrête, puis donne l'accord de fusion. Les assemblages en cours
 * vivent en mémoire : leurs branches `agents/<tâche>/<agent>` restent dans le dépôt si l'app se ferme.
 */
export class AssemblyService {
  private readonly runs = new Map<string, Run>()
  private readonly engines = new Map<string, AssemblyEngine>()
  private readonly now: () => number

  constructor(private readonly deps: AssemblyServiceDeps) {
    this.now = deps.now ?? Date.now
  }

  /** Avertissements d'un assemblage (permissions, zones) sans rien lancer ; refuse un assemblage invalide. */
  async warnings(request: AssemblyRequest): Promise<string[]> {
    const { assembly, engine } = this.prepare(request)
    await engine.check(assembly)
    const uncommitted = (await engine.uncommittedWarning?.()) ?? null
    return [...(uncommitted === null ? [] : [uncommitted]), ...engine.warnings(assembly)]
  }

  async start(request: AssemblyRequest): Promise<AssemblyRunView> {
    const { node, assembly, engine } = this.prepare(request)
    const key = this.key(node.genesisId, assembly.taskId)
    if (this.runs.get(key)?.state === 'running') {
      throw new AppError('CONFLICT', `La tâche ${assembly.taskId} a déjà un assemblage en cours.`)
    }
    await engine.check(assembly)
    // Relu après l'attente : deux lancements simultanés de la même tâche ne passent pas tous les deux.
    if (this.runs.get(key)?.state === 'running') {
      throw new AppError('CONFLICT', `La tâche ${assembly.taskId} a déjà un assemblage en cours.`)
    }
    const run: Run = {
      node,
      nodeId: request.nodeId,
      assembly,
      engine,
      warnings: engine.warnings(assembly),
      live: new Map(assembly.agents.map((agent) => [agent.id, { agentId: agent.id, state: 'waiting' }])),
      controller: new AbortController(),
      startedAt: this.now(),
      state: 'running',
      approving: false
    }
    this.runs.set(key, run)
    engine
      .run(
        assembly,
        run.controller.signal,
        (event) => {
          this.apply(run, event)
          this.deps.emit(node.genesisId, assembly.taskId)
        },
        (agentId, event) => this.deps.workLog?.(request.nodeId, agentId, event)
      )
      .then((result) => {
        run.result = result
        run.state = 'finished'
        if (result.completed) this.credit(run)
        if (result.plan !== undefined) this.keepPlan(request.nodeId, result.plan)
      })
      .catch((error: unknown) => {
        run.state = 'failed'
        run.error = error instanceof AppError ? error.message : 'Le planificateur a échoué.'
      })
      .finally(() => {
        run.finishedAt = this.now()
        this.deps.emit(node.genesisId, assembly.taskId)
      })
    this.deps.emit(node.genesisId, assembly.taskId)
    return this.view(run)
  }

  /** Croquis des agents connectés aux nœuds d'un projet (ou de tous) : ce que la carte dessine avant le lancement. */
  sketches(genesisId?: string): AssemblySketchView[] {
    return this.deps.sketches.list(genesisId)
  }

  /** Enregistre le croquis d'un nœud (remplace le précédent) ; forme vérifiée, profils vérifiés au lancement. */
  saveSketch(request: Omit<AssemblyRequest, 'baseBranch'>): AssemblySketchView {
    if (!isValidTaskId(request.taskId)) throw new AppError('VALIDATION', 'Identifiant de tâche invalide.')
    const node = this.deps.node(request.nodeId)
    if (node === undefined) throw new AppError('NOT_FOUND', 'Nœud introuvable.')
    if (node.projectDir === null) {
      throw new AppError('VALIDATION', 'Les agents travaillent dans un projet : lie d’abord un dossier à ce genesis.')
    }
    const error = structureError({ taskId: request.taskId, brief: '', agents: request.agents, links: request.links })
    if (error !== null) throw new AppError('VALIDATION', error)
    // L'équipe d'un lot garde son plan et ses retouches d'aiguillage (L1o D25) : le croquis ne les porte pas.
    const lot = this.sketchOf(request.nodeId)?.lot
    const sketch: AssemblySketchView = {
      nodeId: request.nodeId,
      genesisId: node.genesisId,
      taskId: request.taskId,
      ...(request.task === undefined || request.task.trim() === '' ? {} : { task: request.task }),
      agents: request.agents,
      links: request.links,
      ...(lot === undefined ? {} : { lot })
    }
    this.deps.sketches.save(sketch)
    return sketch
  }

  /**
   * Déplace l'équipe d'un nœud vers une autre tâche du même projet (L1o D24) : agents (profils, places) et liens
   * suivent ; ce qui appartenait à l'ancienne tâche (demande, part et zone de chaque agent) reste derrière. Refusé
   * pendant le travail, ou si la tâche visée a déjà des agents.
   */
  moveSketch(fromNodeId: string, toNodeId: string, taskId: string): AssemblySketchView {
    if (!isValidTaskId(taskId)) throw new AppError('VALIDATION', 'Identifiant de tâche invalide.')
    if (fromNodeId === toNodeId) throw new AppError('VALIDATION', 'L’équipe est déjà sur cette tâche.')
    const from = this.deps.sketches.list().find((sketch) => sketch.nodeId === fromNodeId)
    if (from === undefined || from.agents.length === 0) throw new AppError('NOT_FOUND', 'Aucune équipe sur ce nœud.')
    if (this.runs.get(this.key(from.genesisId, from.taskId))?.state === 'running') {
      throw new AppError('CONFLICT', 'L’équipe travaille : arrête-la avant de la déplacer.')
    }
    const target = this.deps.node(toNodeId)
    if (target === undefined) throw new AppError('NOT_FOUND', 'Tâche introuvable.')
    if (target.genesisId !== from.genesisId) throw new AppError('VALIDATION', 'L’équipe reste dans son projet.')
    const taken = this.deps.sketches.list(target.genesisId).find((sketch) => sketch.nodeId === toNodeId)
    if (taken !== undefined && taken.agents.length > 0) {
      throw new AppError('CONFLICT', 'Cette tâche a déjà des agents.')
    }
    const moved = this.saveSketch({
      nodeId: toNodeId,
      taskId,
      agents: from.agents.map(({ id, profileId, place }) => ({
        id,
        profileId,
        ...(place === undefined ? {} : { place })
      })),
      links: from.links
    })
    this.deps.sketches.remove(fromNodeId)
    return moved
  }

  /**
   * Rattache une équipe dont le nœud a disparu à une tâche du Workflow (L1o D27) : c'est la même équipe, retrouvée ;
   * tout la suit (identifiant de tâche, demande, parts, zones, plan du lot) et ses conversations aussi. Refusé si le
   * nœud d'origine existe encore (c'est alors « Déplacer l'équipe », D24) ou si la tâche visée a déjà des agents.
   */
  relinkSketch(fromNodeId: string, toNodeId: string): AssemblySketchView {
    const from = this.sketchOf(fromNodeId)
    if (from === undefined || from.agents.length === 0) throw new AppError('NOT_FOUND', 'Aucune équipe à rattacher.')
    if (this.deps.node(fromNodeId) !== undefined) {
      throw new AppError('CONFLICT', 'Le nœud de cette équipe existe encore : déplace-la plutôt.')
    }
    const target = this.deps.node(toNodeId)
    if (target === undefined) throw new AppError('NOT_FOUND', 'Tâche introuvable.')
    if (target.genesisId !== from.genesisId) throw new AppError('VALIDATION', 'L’équipe reste dans son projet.')
    const taken = this.sketchOf(toNodeId)
    if (taken !== undefined && taken.agents.length > 0) throw new AppError('CONFLICT', 'Cette tâche a déjà des agents.')
    const relinked: AssemblySketchView = { ...from, nodeId: toNodeId }
    this.deps.sketches.save(relinked)
    this.deps.sketches.remove(fromNodeId)
    this.deps.moveChats?.(from.genesisId, fromNodeId, toNodeId)
    return relinked
  }

  /**
   * Retouche l'aiguillage d'une tâche du lot (L1o D25, T023) : les agents qui y interviennent et qui attend qui ; le
   * choix de mentalyas prime sur le plan du PO. `null` rend la tâche au plan du PO.
   */
  routeTask(
    nodeId: string,
    task: string,
    route: {
      readonly agents: readonly string[]
      readonly links: readonly AssemblyLink[]
      readonly after?: readonly string[]
    } | null
  ): AssemblySketchView {
    const sketch = this.sketchOf(nodeId)
    if (sketch?.lot === undefined) throw new AppError('NOT_FOUND', 'Ce nœud n’a pas de plan de lot.')
    if (!sketch.lot.plan.steps.some((step) => step.task === task)) {
      throw new AppError('NOT_FOUND', `La tâche ${task} n’est pas dans le plan du PO.`)
    }
    const others = sketch.lot.overrides.filter((entry) => entry.task !== task)
    let overrides = others
    if (route !== null) {
      const agents = sketch.agents.filter((agent) => route.agents.includes(agent.id))
      if (agents.length !== route.agents.length || agents.length === 0) {
        throw new AppError('VALIDATION', 'Choisis au moins un agent de l’équipe.')
      }
      const error = structureError({ taskId: sketch.taskId, brief: '', agents, links: route.links })
      if (error !== null) throw new AppError('VALIDATION', error)
      const after = route.after === undefined ? undefined : [...new Set(route.after)]
      if (after !== undefined) {
        const planned = new Set(sketch.lot.plan.steps.map((step) => step.task))
        const unknown = after.find((entry) => entry === task || !planned.has(entry))
        if (unknown !== undefined) throw new AppError('VALIDATION', `« ${unknown} » n’est pas une autre tâche du lot.`)
        const draft = { plan: sketch.lot.plan, overrides: [...others, { task, agents: [], links: [], after }] }
        if (lotGroups(routeLot(draft, [])).cycles.length > 0) {
          throw new AppError('VALIDATION', 'Ces dépendances forment une boucle : une tâche s’attendrait elle-même.')
        }
      }
      overrides = [
        ...others,
        { task, agents: agents.map((agent) => agent.id), links: route.links, ...(after === undefined ? {} : { after }) }
      ]
    }
    const next: AssemblySketchView = { ...sketch, lot: { plan: sketch.lot.plan, overrides } }
    this.deps.sketches.save(next)
    return next
  }

  /** Plan de lot signé par le PO (L1o D25) : gardé avec l'équipe, retouches des tâches toujours au plan comprises. */
  private keepPlan(nodeId: string, plan: LotPlan): void {
    const sketch = this.sketchOf(nodeId)
    if (sketch === undefined) return
    const tasks = new Set(plan.steps.map((step) => step.task))
    const overrides = (sketch.lot?.overrides ?? []).filter((entry) => tasks.has(entry.task))
    this.deps.sketches.save({ ...sketch, lot: { plan, overrides } })
  }

  private sketchOf(nodeId: string): AssemblySketchView | undefined {
    return this.deps.sketches.list().find((sketch) => sketch.nodeId === nodeId)
  }

  /** Retire le croquis d'un nœud : ses agents disparaissent de la carte. */
  clearSketch(nodeId: string): void {
    this.deps.sketches.remove(nodeId)
  }

  /** Arrête l'assemblage : les sessions en cours sont annulées, aucun agent ne démarre plus. */
  cancel(genesisId: string, taskId: string): void {
    const run = this.runs.get(this.key(genesisId, taskId))
    if (run === undefined || run.state !== 'running') {
      throw new AppError('NOT_FOUND', `Aucun assemblage en cours pour la tâche ${taskId}.`)
    }
    run.controller.abort()
  }

  /** Accord unique de mentalyas (L1o D11) : fusionne l'assemblage validé sur la branche de base. */
  async approve(genesisId: string, taskId: string): Promise<ApprovalResult> {
    const run = this.runs.get(this.key(genesisId, taskId))
    if (run === undefined) throw new AppError('NOT_FOUND', `Aucun assemblage pour la tâche ${taskId}.`)
    if (run.state !== 'finished' || run.result?.completed !== true) {
      throw new AppError('CONFLICT', 'L’assemblage n’est pas validé : rien à fusionner.')
    }
    if (run.approval?.merged === true) throw new AppError('CONFLICT', 'Cet assemblage est déjà fusionné.')
    if (run.approving) throw new AppError('CONFLICT', 'La fusion est déjà en cours.')
    run.approving = true
    try {
      const approval = await run.engine.approve(run.assembly, boxesOf(run.node, run.result?.plan))
      run.approval = approval
      if (approval.merged) this.credit(run)
      this.deps.emit(genesisId, taskId)
      return approval
    } finally {
      run.approving = false
    }
  }

  /** Range les branches des agents d'un assemblage fusionné (L1o D23). */
  async cleanup(genesisId: string, taskId: string): Promise<CleanupResult> {
    const run = this.runs.get(this.key(genesisId, taskId))
    if (run === undefined) throw new AppError('NOT_FOUND', `Aucun assemblage pour la tâche ${taskId}.`)
    if (run.approval?.merged !== true)
      throw new AppError('CONFLICT', 'L’assemblage n’est pas fusionné : rien à ranger.')
    if (run.engine.cleanup === undefined) throw new AppError('CONFLICT', 'Rangement indisponible.')
    return run.engine.cleanup(run.assembly)
  }

  private credit(run: Run): void {
    this.deps.credit?.(run.assembly.agents.map((agent) => agent.profileId))
  }

  list(genesisId?: string): AssemblyRunView[] {
    return [...this.runs.values()]
      .filter((run) => genesisId === undefined || run.node.genesisId === genesisId)
      .map((run) => this.view(run))
      .sort((a, b) => b.startedAt - a.startedAt)
  }

  /** Arrête tous les assemblages en cours (fermeture de l'app). */
  stopAll(): void {
    for (const run of this.runs.values()) if (run.state === 'running') run.controller.abort()
  }

  /**
   * Retient le changement d'état d'un agent pour que son nœud s'anime : passe, verdict du QA, rapport coupé. Un nouveau
   * tour efface le verdict et le motif d'arrêt de l'ancien ; le dernier rapport reste jusqu'au suivant.
   */
  private apply(run: Run, event: AgentProgress): void {
    const before = run.live.get(event.agentId)
    if (before === undefined) return
    const next: { -readonly [K in keyof AgentLiveView]: AgentLiveView[K] } = { ...before, state: event.state }
    if (event.state === 'waiting' || event.state === 'running') {
      delete next.verdict
      delete next.message
    }
    if (event.index !== undefined) {
      next.pass = event.index.pass
      next.nature = event.index.nature
      if (event.index.specVersion !== undefined) next.specVersion = event.index.specVersion
    }
    if (event.verdict !== undefined) next.verdict = event.verdict
    if (event.message !== undefined) next.message = event.message
    if (event.report !== undefined) next.report = event.report.slice(0, REPORT_MAX)
    run.live.set(event.agentId, next)
  }

  private key(genesisId: string, taskId: string): string {
    return `${genesisId}/${taskId}`
  }

  /** Nœud, projet et assemblage d'une demande, ou une erreur claire ; le contexte du nœud devient la mission. */
  private prepare(request: AssemblyRequest): { node: AssemblyNode; assembly: Assembly; engine: AssemblyEngine } {
    if (!isValidTaskId(request.taskId)) throw new AppError('VALIDATION', 'Identifiant de tâche invalide.')
    const node = this.deps.node(request.nodeId)
    if (node === undefined) throw new AppError('NOT_FOUND', 'Nœud introuvable.')
    if (node.projectDir === null) {
      throw new AppError('VALIDATION', 'Les agents travaillent dans un projet : lie d’abord un dossier à ce genesis.')
    }
    const refusal = this.deps.refusal(node.genesisId)
    if (refusal !== null) throw new AppError('FORBIDDEN', refusal)
    const assembly: Assembly = {
      taskId: request.taskId,
      brief: briefFor(node, request.task),
      agents: request.agents,
      links: request.links,
      ...(request.baseBranch === undefined ? {} : { baseBranch: request.baseBranch }),
      ...(node.lotTasks === undefined || node.lotTasks.length === 0 ? {} : { lot: node.lotTasks }),
      ...(node.lotFile === undefined ? {} : { lotFile: node.lotFile })
    }
    // Un moteur par projet : c'est lui qui fait passer les commandes git une à une ; deux tâches lancées en même temps
    // sur le même dépôt se disputeraient sinon ses verrous (worktrees, références).
    const engineKey = `${node.genesisId}\n${node.projectDir}`
    let engine = this.engines.get(engineKey)
    if (engine === undefined) {
      engine = this.deps.engineFor({
        genesisId: node.genesisId,
        projectDir: node.projectDir,
        projectName: node.projectName
      })
      this.engines.set(engineKey, engine)
    }
    return { node, assembly, engine }
  }

  private view(run: Run): AssemblyRunView {
    return {
      genesisId: run.node.genesisId,
      nodeId: run.nodeId,
      taskId: run.assembly.taskId,
      state: run.state,
      startedAt: run.startedAt,
      ...(run.finishedAt === undefined ? {} : { finishedAt: run.finishedAt }),
      warnings: run.warnings,
      agents: run.assembly.agents.map(
        (agent) => run.live.get(agent.id) ?? { agentId: agent.id, state: 'waiting' as const }
      ),
      ...(run.result === undefined ? {} : { result: run.result }),
      ...(run.approval === undefined ? {} : { approval: run.approval }),
      ...(run.error === undefined ? {} : { error: run.error })
    }
  }
}
