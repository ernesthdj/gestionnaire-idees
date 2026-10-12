import { randomUUID } from 'node:crypto'
import type { ResolutionOut } from '@shared/ai/schemas'
import type { AIError, Result } from '../../domain/ai/types'
import { AppError } from '../../domain/errors'
import { callContext, calleeOf } from '../../domain/reprise/callContext'
import { classifyFile } from '../../domain/reprise/fileFilter'
import type {
  CodeEdgeRow,
  CodeGraphRepository,
  CodeSymbolRow
} from '../../infrastructure/db/repositories/CodeGraphRepository'
import type { RepriseRepository } from '../../infrastructure/db/repositories/RepriseRepository'
import type { AIResult } from '../ai/AIGateway'
import { RESOLUTION_BATCH, RESOLUTION_CONTEXT_LINES, type ResolutionItem } from '../ai/RepriseResolutionTask'

/** Liens soumis à l'IA par passe : au-delà, mentalyas relance (chaque lot est un appel au modèle). */
export const RESOLUTION_MAX_LINKS = 500
const FILE_BYTES = 256 * 1024

export interface ResolutionDeps {
  readonly reprise: Pick<RepriseRepository, 'project' | 'startRun' | 'endRun'>
  readonly graph: Pick<CodeGraphRepository, 'edges' | 'symbols' | 'updateEdge'>
  /** Garde de confidentialité (spec 017 R5) : faux → le modèle local tranche, rien ne part vers Claude. */
  readonly claudeAllowed: (genesisId: string) => boolean
  readonly runResolution: (
    items: readonly ResolutionItem[],
    options: { readonly localOnly: boolean }
  ) => Promise<Result<AIResult<ResolutionOut>, AIError>>
  /** Texte d'un fichier du projet (chemin relatif), lu sous sa racine réelle, borné ; `null` si illisible. */
  readonly readText: (root: string, path: string, maxBytes: number) => string | null
  readonly emit: (event: { readonly type: 'reprise:changed'; readonly payload: { readonly genesisId: string } }) => void
  readonly now?: () => Date
}

export interface ResolutionSummary {
  readonly runId: string
  /** Liens passés à « déduit » (cible choisie parmi les candidats, avec sa raison). */
  readonly deduced: number
  /** Liens que le modèle n'a pas pu trancher : ils restent incertains, avec sa raison. */
  readonly undecided: number
  /** Liens non soumis (plafond d'une passe) ou laissés incertains parce que l'IA s'est arrêtée. */
  readonly remaining: number
  /** L'IA est devenue indisponible en cours de passe (abonnement épuisé, modèle arrêté) : le reste est inchangé. */
  readonly stopped: boolean
}

interface Pending {
  readonly edge: CodeEdgeRow
  readonly origin: CodeSymbolRow & { readonly path: string }
  readonly candidates: readonly (CodeSymbolRow & { readonly path: string })[]
}

const oneLine = (text: string): string =>
  [...text]
    .map((char) => (char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? ' ' : char))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)

/**
 * Levée des ambiguïtés d'un projet analysé (spec 017 US6) : les liens incertains qui ont des cibles possibles partent
 * par lots de 50 (appel, 8 lignes de contexte, candidats par identifiant), Claude ou le modèle local selon la
 * confidentialité. Une cible hors des candidats envoyés est rejetée ; un choix accepté devient « déduit » avec sa
 * raison, jamais « sûr ». Le run est journalisé sans contenu.
 */
export class ResolutionService {
  private readonly running = new Set<string>()

  constructor(private readonly deps: ResolutionDeps) {}

  isRunning(genesisId: string): boolean {
    return this.running.has(genesisId)
  }

  async resolve(genesisId: string): Promise<ResolutionSummary> {
    const project = this.deps.reprise.project(genesisId)
    if (project === undefined) throw new AppError('NOT_FOUND', 'Projet repris introuvable.')
    if (project.analyzedAt === null) throw new AppError('NOT_ANALYZED', 'Le projet doit d’abord être analysé.')
    if (this.running.has(genesisId))
      throw new AppError('BUSY', 'Les liens de ce projet sont déjà en cours de précision.')
    this.running.add(genesisId)
    const runId = randomUUID()
    const started = Date.now()
    this.deps.reprise.startRun({ id: runId, genesisId, kind: 'resolution', at: this.now() })
    this.deps.emit({ type: 'reprise:changed', payload: { genesisId } })
    const localOnly = !this.deps.claudeAllowed(genesisId)
    const counts = { asked: 0, deduced: 0, undecided: 0, rejected: 0, batches: 0 }
    try {
      const all = this.pending(genesisId)
      const todo = all.slice(0, RESOLUTION_MAX_LINKS)
      const lines = new Map<string, readonly string[] | null>()
      const linesOf = (path: string): readonly string[] | null => {
        if (!lines.has(path)) {
          const text =
            classifyFile(path, 0, () => false).kind === 'sensitive'
              ? null
              : this.deps.readText(project.rootDir, path, FILE_BYTES)
          lines.set(path, text === null ? null : text.split(/\r\n|\r|\n/))
        }
        return lines.get(path) ?? null
      }

      let failure: AIError | null = null
      for (let start = 0; start < todo.length && failure === null; start += RESOLUTION_BATCH) {
        const batch = todo.slice(start, start + RESOLUTION_BATCH)
        const items: ResolutionItem[] = batch.map(({ edge, origin, candidates }) => ({
          edgeId: edge.id,
          call: edge.rawTarget,
          context: callContext(
            linesOf(origin.path) ?? [],
            origin.startLine,
            origin.endLine,
            calleeOf(edge.rawTarget),
            RESOLUTION_CONTEXT_LINES
          ),
          candidates: candidates.map((candidate) => ({
            id: candidate.id,
            label: `${candidate.qualifiedName} — ${candidate.path}`
          }))
        }))
        const result = await this.deps.runResolution(items, { localOnly })
        if (!result.ok) {
          failure = result.error
          break
        }
        counts.batches++
        counts.asked += batch.length
        this.apply(genesisId, batch, result.value.data, counts)
      }

      if (failure !== null && counts.batches === 0) {
        throw new AppError(
          failure.code === 'AI_UNAVAILABLE' ? 'AI_UNAVAILABLE' : 'AI_FAILED',
          localOnly && failure.code === 'AI_UNAVAILABLE'
            ? 'Le modèle local (Ollama) est indisponible : les liens d’un projet « Local uniquement » ne partent jamais vers Claude.'
            : failure.message
        )
      }
      const remaining = all.length - counts.asked
      this.deps.reprise.endRun(runId, 'done', this.now(), {
        asked: counts.asked,
        deduced: counts.deduced,
        undecided: counts.undecided,
        rejected: counts.rejected,
        batches: counts.batches,
        remaining,
        stopped: failure === null ? 0 : 1,
        local: localOnly ? 1 : 0,
        durationMs: Date.now() - started
      })
      return {
        runId,
        deduced: counts.deduced,
        undecided: counts.undecided,
        remaining,
        stopped: failure !== null
      }
    } catch (error) {
      this.deps.reprise.endRun(runId, 'failed', this.now(), { ...counts, durationMs: Date.now() - started })
      throw error
    } finally {
      this.running.delete(genesisId)
      this.deps.emit({ type: 'reprise:changed', payload: { genesisId } })
    }
  }

  /** Liens incertains dont les cibles possibles existent encore, les plus appelés d'abord. */
  private pending(genesisId: string): Pending[] {
    const symbols = new Map(this.deps.graph.symbols(genesisId).map((symbol) => [symbol.id, symbol] as const))
    const found: Pending[] = []
    for (const edge of this.deps.graph.edges(genesisId)) {
      if (edge.provenance !== 'uncertain' || edge.candidatesJson === null) continue
      const origin = symbols.get(edge.fromSymbolId)
      if (origin === undefined) continue
      const candidates = parseIds(edge.candidatesJson).flatMap((id) => {
        const symbol = symbols.get(id)
        return symbol === undefined ? [] : [symbol]
      })
      if (candidates.length > 0) found.push({ edge, origin, candidates })
    }
    return found.sort((a, b) => b.edge.count - a.edge.count || a.edge.id.localeCompare(b.edge.id))
  }

  /** Écrit les verdicts d'un lot ; tout ce qui n'est pas dans le lot, en double ou hors des candidats est ignoré. */
  private apply(
    genesisId: string,
    batch: readonly Pending[],
    output: ResolutionOut,
    counts: { deduced: number; undecided: number; rejected: number }
  ): void {
    const byEdge = new Map(batch.map((entry) => [entry.edge.id, entry] as const))
    const seen = new Set<string>()
    for (const item of output.items) {
      const entry = byEdge.get(item.edgeId)
      if (entry === undefined || seen.has(item.edgeId)) {
        counts.rejected++
        continue
      }
      seen.add(item.edgeId)
      const reason = oneLine(item.reason)
      if (item.targetId === null) {
        // Aucun candidat ne convient : le lien reste incertain, sans cible, avec la raison ; plus reproposé.
        this.deps.graph.updateEdge(genesisId, item.edgeId, {
          toSymbolId: null,
          provenance: 'uncertain',
          reason: reason === '' ? null : reason,
          candidatesJson: null
        })
        counts.undecided++
      } else if (entry.candidates.some((candidate) => candidate.id === item.targetId)) {
        this.deps.graph.updateEdge(genesisId, item.edgeId, {
          toSymbolId: item.targetId,
          provenance: 'deduced',
          reason: reason === '' ? 'cible choisie par l’IA d’après le contexte' : reason
        })
        counts.deduced++
      } else {
        counts.rejected++
      }
    }
  }

  private now(): string {
    return (this.deps.now?.() ?? new Date()).toISOString()
  }
}

function parseIds(json: string): string[] {
  try {
    const value: unknown = JSON.parse(json)
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
  } catch {
    return []
  }
}
