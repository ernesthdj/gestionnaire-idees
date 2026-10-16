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
  type ProgressListener
} from '@shared/agents/pipeline'
import { REPORT_MAX, type AgentLiveView, type AssemblyRunView, type AssemblySketchView } from '@shared/ipc/assemblies'
import { AppError } from '../../domain/errors'

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
}

/** Le planificateur, vu par le service (`PipelineEngine` en vrai). */
export interface AssemblyEngine {
  check(assembly: Assembly): Promise<void>
  warnings(assembly: Assembly): string[]
  run(
    assembly: Assembly,
    signal?: AbortSignal,
    onProgress?: ProgressListener,
    onWork?: AgentWorkListener
  ): Promise<AssemblyRunResult>
  approve(assembly: Assembly): Promise<ApprovalResult>
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
    return engine.warnings(assembly)
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
    const sketch: AssemblySketchView = {
      nodeId: request.nodeId,
      genesisId: node.genesisId,
      taskId: request.taskId,
      ...(request.task === undefined || request.task.trim() === '' ? {} : { task: request.task }),
      agents: request.agents,
      links: request.links
    }
    this.deps.sketches.save(sketch)
    return sketch
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
      const approval = await run.engine.approve(run.assembly)
      run.approval = approval
      if (approval.merged) this.credit(run)
      this.deps.emit(genesisId, taskId)
      return approval
    } finally {
      run.approving = false
    }
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
      ...(request.baseBranch === undefined ? {} : { baseBranch: request.baseBranch })
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
