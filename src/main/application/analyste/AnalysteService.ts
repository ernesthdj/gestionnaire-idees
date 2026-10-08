import { randomUUID } from 'node:crypto'
import type { AnalysteOut } from '@shared/analyste/proposals'
import type { ObservationRecord } from '@shared/analyste/events'
import type { AnalysisProgressEvent, AnalysteSettingsView } from '@shared/ipc/analyste'
import type { AIError, Result } from '../../domain/ai/types'
import { aggregate, type AiCallFingerprint } from '../../domain/analyste/aggregate'
import { buildDossier, type CodeSummary, type MemoryItem } from '../../domain/analyste/dossier'
import { checkProposals, type ProposalMemory } from '../../domain/analyste/proposalCheck'
import { AppError } from '../../domain/errors'
import type { NewAnalysis, NewProposal } from '../../infrastructure/db/repositories/AnalysteRepository'
import type { RepoState } from './RepoGuard'

const DAY_MS = 86_400_000
/** Propositions antérieures transmises en mémoire (FR-018). */
export const MEMORY_LIMIT = 30

export interface AnalysteServiceDeps {
  readonly guard: { current(): RepoState }
  readonly observations: {
    between(from: number, to: number): ObservationRecord[]
    countBetween(from: number, to: number): number
  }
  readonly aiCalls: { fingerprints(from: number, to: number): AiCallFingerprint[] }
  readonly store: {
    startAnalysis(row: NewAnalysis): boolean
    lastDoneWindowTo(): number | null
    finishAnalysis(id: string, at: number, aiCallId: string | null, rows: readonly NewProposal[]): void
    endAnalysis(
      id: string,
      status: 'failed' | 'cancelled',
      errorCode: string,
      at: number,
      aiCallId: string | null
    ): void
    interruptRunning(at: number): number
    memory(limit: number): MemoryItem[]
    known(): ProposalMemory[]
  }
  readonly settings: () => AnalysteSettingsView
  /**
   * Analyse statique du dépôt (spec 017, research R4), `null` si aucun graphe n'existe. Un graphe périmé est d'abord
   * réanalysé : la promesse attend la fin de cette analyse.
   */
  readonly code: () => Promise<CodeSummary | null>
  /** La tâche `analyste` (passerelle IA). */
  readonly runTask: (
    dossier: string,
    options: { readonly repoPath: string; readonly requestId: string; readonly signal: AbortSignal }
  ) => Promise<Result<{ readonly data: AnalysteOut }, AIError>>
  /** Le chemin relatif désigne-t-il un fichier ou dossier existant, réellement situé dans le dépôt ? */
  readonly exists: (repoPath: string, relativePath: string) => boolean
  /** Une mise à jour est-elle en cours de codage (US4) ? Aucune analyse pendant un codage (FR-020). */
  readonly isCoding: () => boolean
  /** Écrit la file de la sonde avant de lire la fenêtre. */
  readonly flushProbe: () => void
  readonly emit: (event: AnalysisProgressEvent) => void
  readonly now?: () => number
  readonly newId?: () => string
}

interface Running {
  readonly id: string
  readonly controller: AbortController
  readonly done: Promise<void>
}

/**
 * Analyste interne (spec 019 US2, `L3-analyste-analyse.md` §7) : une analyse à la fois, sur les observations depuis la
 * dernière analyse réussie ; dossier balisé → tâche `analyste` (lecture seule) → contrôle de chaque proposition →
 * enregistrement en une transaction. Un échec ou une annulation n'écrit que le statut : la même période reste à
 * analyser.
 */
export class AnalysteService {
  private running: Running | null = null

  constructor(private readonly deps: AnalysteServiceDeps) {}

  /** Au démarrage : une analyse restée « en cours » (app fermée) est marquée interrompue. */
  recover(): void {
    this.deps.store.interruptRunning(this.now())
  }

  /**
   * Lance une analyse et rend aussitôt son identifiant ; la suite est annoncée par `analyste:progress`.
   * `force` passe outre le seuil d'observations nouvelles (manuel seulement, FR-012).
   */
  analyze(options: { readonly force?: boolean; readonly trigger?: 'manual' | 'auto' } = {}): { analysisId: string } {
    const state = this.deps.guard.current()
    if (!state.available) throw new AppError('PACKAGED_APP', "L'Analyste n'existe pas dans l'app installée")
    if (!state.active || state.repoPath === null) {
      throw new AppError('PROBE_INACTIVE', 'La sonde est inactive : désigne le dépôt dans Réglages › Analyste')
    }
    if (this.running !== null) throw new AppError('ANALYSIS_RUNNING', 'Une analyse est déjà en cours')
    if (this.deps.isCoding()) {
      throw new AppError('UPDATE_CODING', 'Une mise à jour est en cours de codage : l’analyse attendra sa fin')
    }
    const settings = this.deps.settings()
    this.safeFlush()
    const to = this.now()
    const from = Math.max(this.deps.store.lastDoneWindowTo() ?? 0, to - settings.retentionDays * DAY_MS)
    const events = this.deps.observations.countBetween(from, to)
    if (options.force !== true && events < settings.minEvents) {
      throw new AppError('NOT_ENOUGH_DATA', 'Peu d’observations nouvelles depuis la dernière analyse', {
        events,
        minEvents: settings.minEvents
      })
    }
    const id = (this.deps.newId ?? randomUUID)()
    const started = this.deps.store.startAnalysis({
      id,
      trigger: options.trigger ?? 'manual',
      windowFrom: from,
      windowTo: to,
      events,
      startedAt: to
    })
    if (!started) throw new AppError('ANALYSIS_RUNNING', 'Une analyse est déjà en cours')
    const controller = new AbortController()
    const done = this.pipeline(id, state.repoPath, from, to, settings, controller.signal).finally(() => {
      this.running = null
    })
    this.running = { id, controller, done }
    return { analysisId: id }
  }

  /** Annule l'analyse en cours : le processus de Claude est arrêté, l'analyse passe « annulée ». */
  cancel(analysisId: string): void {
    if (this.running === null || this.running.id !== analysisId) {
      throw new AppError('NOT_FOUND', 'Aucune analyse en cours avec cet identifiant')
    }
    this.running.controller.abort()
  }

  /** Arrêt de l'app : l'analyse en cours est annulée (son processus `claude` ne survit pas à l'app). */
  stop(): void {
    this.running?.controller.abort()
  }

  isRunning(): boolean {
    return this.running !== null
  }

  /** Attend la fin de l'analyse en cours (tests, arrêt de l'app). */
  async idle(): Promise<void> {
    await this.running?.done
  }

  private async pipeline(
    id: string,
    repoPath: string,
    from: number,
    to: number,
    settings: AnalysteSettingsView,
    signal: AbortSignal
  ): Promise<void> {
    const requestId = randomUUID()
    let aiCallId: string | null = null
    const fail = (errorCode: string): void => {
      const status = signal.aborted ? 'cancelled' : 'failed'
      const code = signal.aborted ? 'CANCELLED' : errorCode
      try {
        this.deps.store.endAnalysis(id, status, code, this.now(), aiCallId)
      } catch {
        // Base indisponible : l'analyse sera marquée interrompue au prochain démarrage.
      }
      this.deps.emit({ analysisId: id, step: 'echec', errorCode: code })
    }
    try {
      this.deps.emit({ analysisId: id, step: 'dossier' })
      // « Jamais utilisé » se juge sur toute la rétention, pas sur la fenêtre depuis la dernière analyse.
      const retained = this.deps.observations.between(to - settings.retentionDays * DAY_MS, to)
      const firstAt = retained.reduce((min, record) => Math.min(min, record.at), to)
      const entries = aggregate(this.deps.observations.between(from, to), this.deps.aiCalls.fingerprints(from, to), {
        repeatThreshold: settings.repeatThreshold,
        windowMs: to - from,
        history: { records: retained, spanMs: to - firstAt }
      })
      const code = await this.safeCode()
      if (signal.aborted) return fail('CANCELLED')
      const dossier = buildDossier({
        window: { from, to, events: this.deps.observations.countBetween(from, to) },
        entries,
        code,
        memory: this.deps.store.memory(MEMORY_LIMIT)
      })
      if (signal.aborted) return fail('CANCELLED')

      this.deps.emit({ analysisId: id, step: 'claude' })
      const result = await this.deps.runTask(dossier.text, { repoPath, requestId, signal })
      aiCallId = requestId
      if (signal.aborted) return fail('CANCELLED')
      if (!result.ok) return fail(result.error.code)

      this.deps.emit({ analysisId: id, step: 'controle' })
      const checked = checkProposals({
        proposals: result.value.data.propositions,
        entries: dossier.entries,
        exists: (path) => this.deps.exists(repoPath, path),
        memory: this.deps.store.known(),
        max: settings.maxProposals
      })
      if (signal.aborted) return fail('CANCELLED')
      const newId = this.deps.newId ?? randomUUID
      this.deps.store.finishAnalysis(
        id,
        this.now(),
        aiCallId,
        checked.kept.map((proposal) => ({ ...proposal, id: newId() }))
      )
      this.deps.emit({ analysisId: id, step: 'fini', proposals: checked.kept.length })
    } catch {
      fail('ANALYSIS_FAILED')
    }
  }

  private safeFlush(): void {
    try {
      this.deps.flushProbe()
    } catch {
      // La sonde ne bloque jamais l'analyse.
    }
  }

  /** Sans graphe lisible, l'analyse tourne quand même (section `<code>` vide, research R4). */
  private async safeCode(): Promise<CodeSummary | null> {
    try {
      return await this.deps.code()
    } catch {
      return null
    }
  }

  private now(): number {
    return (this.deps.now ?? Date.now)()
  }
}
