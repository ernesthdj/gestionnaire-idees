import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AnalysisDoneEvent, AnalysisProgressEvent, AnalysisStatsView, CodeCategory } from '@shared/ipc/reprise'
import type { FileExtraction } from '../../../analysis-worker/extract'
import { WorkerMessage, type ParseRequest } from '../../../analysis-worker/protocol'
import { AppError } from '../../domain/errors'
import { categorize, categorizeMember, type CategoryVerdict } from '../../domain/reprise/categories'
import { MANIFEST_NAMES, psr4Of, tsPathsOf } from '../../domain/reprise/manifests'
import { detectModules } from '../../domain/reprise/modules'
import { resolveGraph, type ResolveFile } from '../../domain/reprise/resolve'
import type {
  AnalyzedFile,
  CodeEdgeRow,
  CodeGraphRepository,
  CodeSymbolRow
} from '../../infrastructure/db/repositories/CodeGraphRepository'
import type { RepriseRepository } from '../../infrastructure/db/repositories/RepriseRepository'
import type { ProjectScan } from '../../infrastructure/reprise/ProjectScanner'

export type AnalysisEvent =
  | { readonly type: 'reprise:analysisProgress'; readonly payload: AnalysisProgressEvent }
  | { readonly type: 'reprise:analysisDone'; readonly payload: AnalysisDoneEvent }
  | { readonly type: 'reprise:changed'; readonly payload: { readonly genesisId: string } }

/** Lance le processus d'analyse sur un lot ; ses messages arrivent bruts (revalidés ici). */
export type RunWorker = (
  request: ParseRequest,
  onMessage: (message: unknown) => void,
  onExit: () => void
) => { readonly cancel: () => void }

export interface AnalysisDeps {
  readonly reprise: Pick<
    RepriseRepository,
    'project' | 'setAnalysisState' | 'startRun' | 'endRun' | 'overrides' | 'interruptRunning' | 'setOverride'
  >
  readonly graph: Pick<
    CodeGraphRepository,
    | 'files'
    | 'replaceModules'
    | 'writeFiles'
    | 'removeFiles'
    | 'replaceEdges'
    | 'symbol'
    | 'edge'
    | 'updateCategory'
    | 'updateEdge'
  >
  readonly scan: (root: string) => ProjectScan
  readonly runWorker: RunWorker
  readonly emit: (event: AnalysisEvent) => void
  readonly readText?: (path: string) => string
  readonly exists?: (path: string) => boolean
  readonly now?: () => Date
}

interface CachedFile {
  readonly hash: string
  readonly lines: number
  readonly extraction: FileExtraction
}

/** Nom du symbole « fichier » : il porte les appels de premier niveau et les imports. */
export const FILE_SYMBOL_NAME = '(fichier)'

const stableId = (...parts: readonly string[]): string =>
  createHash('sha256').update(parts.join('\u0000')).digest('hex').slice(0, 32)

/** Clé d'une correction de catégorie (spec 017 FR-018), stable d'une analyse à l'autre. */
export const categoryTarget = (path: string, qualifiedName: string): string => `category:${path}#${qualifiedName}`
/** Clé d'une correction de cible d'appel. */
export const edgeTarget = (path: string, qualifiedName: string, raw: string): string =>
  `edge:${path}#${qualifiedName}→${raw}`

const CATEGORIES = new Set<CodeCategory>(['domain', 'orchestration', 'infrastructure', 'plumbing'])

/**
 * Analyse d'un projet repris (spec 017 US3) : parcours, extraction dans le processus séparé, modules, catégories,
 * résolution, puis écriture d'un bloc. Rien n'est écrit avant la fin : une analyse annulée ou en échec laisse la
 * précédente intacte. Les extractions restent en mémoire le temps de la session (seuls les fichiers modifiés sont
 * relus) ; les corrections de mentalyas sont réappliquées à chaque analyse.
 */
export class AnalysisService {
  private readonly cache = new Map<string, Map<string, CachedFile>>()
  private readonly running = new Map<string, { readonly cancel: () => void }>()
  private queue: Promise<void> = Promise.resolve()

  constructor(private readonly deps: AnalysisDeps) {}

  /** Au démarrage : une analyse restée en cours a été interrompue par la fermeture de l'app. */
  recover(): void {
    this.deps.reprise.interruptRunning(this.now())
  }

  isRunning(genesisId: string): boolean {
    return this.running.has(genesisId)
  }

  /** Lance l'analyse (une lourde à la fois : les suivantes attendent leur tour). */
  analyze(genesisId: string): { readonly runId: string } {
    const project = this.deps.reprise.project(genesisId)
    if (project === undefined) throw new AppError('NOT_FOUND', 'Projet repris introuvable.')
    if (this.running.has(genesisId)) throw new AppError('BUSY', 'L’analyse de ce projet est déjà en cours.')
    if (!(this.deps.exists ?? existsSync)(project.rootDir)) {
      throw new AppError('FOLDER_MISSING', 'Le dossier du projet est introuvable (déplacé ou supprimé ?).')
    }
    const runId = randomUUID()
    let cancelled = false
    this.running.set(genesisId, { cancel: () => (cancelled = true) })
    this.deps.reprise.setAnalysisState(genesisId, 'running')
    this.deps.reprise.startRun({ id: runId, genesisId, kind: 'analysis', at: this.now() })
    this.deps.emit({ type: 'reprise:changed', payload: { genesisId } })
    this.queue = this.queue.then(() =>
      this.run(genesisId, runId, project.rootDir, () => cancelled).catch(() => this.end(genesisId, runId, 'failed'))
    )
    return { runId }
  }

  cancel(genesisId: string): void {
    this.running.get(genesisId)?.cancel()
  }

  /** Correction de la catégorie d'un élément par mentalyas (spec 017 FR-018) : elle prime et survit aux analyses. */
  setCategory(genesisId: string, symbolId: string, category: CodeCategory): void {
    const symbol = this.deps.graph.symbol(genesisId, symbolId)
    if (symbol === undefined) throw new AppError('NOT_FOUND', 'Élément introuvable dans ce projet.')
    this.deps.reprise.setOverride(genesisId, categoryTarget(symbol.path, symbol.qualifiedName), category)
    this.deps.graph.updateCategory(symbolId, { category, categorySource: 'user', categoryReason: null })
    this.deps.emit({ type: 'reprise:changed', payload: { genesisId } })
  }

  /** Correction de la cible d'un appel (`null` : aucune cible dans le projet). */
  setTarget(genesisId: string, edgeId: string, targetSymbolId: string | null): void {
    const edge = this.deps.graph.edge(genesisId, edgeId)
    const origin = edge === undefined ? undefined : this.deps.graph.symbol(genesisId, edge.fromSymbolId)
    if (edge === undefined || origin === undefined) throw new AppError('NOT_FOUND', 'Lien introuvable dans ce projet.')
    if (targetSymbolId !== null && this.deps.graph.symbol(genesisId, targetSymbolId) === undefined) {
      throw new AppError('NOT_FOUND', 'Cible introuvable dans ce projet.')
    }
    this.deps.reprise.setOverride(
      genesisId,
      edgeTarget(origin.path, origin.qualifiedName, edge.rawTarget),
      targetSymbolId
    )
    this.deps.graph.updateEdge(genesisId, edgeId, { toSymbolId: targetSymbolId, provenance: 'user', reason: null })
    this.deps.emit({ type: 'reprise:changed', payload: { genesisId } })
  }

  /** Attend la fin des analyses lancées (tests, fermeture de l'app). */
  idle(): Promise<void> {
    return this.queue
  }

  private async run(genesisId: string, runId: string, root: string, cancelled: () => boolean): Promise<void> {
    const started = Date.now()
    if (cancelled()) return this.end(genesisId, runId, 'cancelled')
    const scan = this.deps.scan(root)
    const progress = (phase: AnalysisProgressEvent['phase'], done: number, total: number): void =>
      this.deps.emit({ type: 'reprise:analysisProgress', payload: { genesisId, phase, done, total } })
    progress('files', scan.retained.length, scan.retained.length)
    const read = this.deps.readText ?? ((path: string) => readFileSync(path, 'utf8'))
    const manifests = scan.retained
      .filter((file) => MANIFEST_NAMES.test(file.path) && file.size <= 256 * 1024)
      .map((file) => ({ path: file.path, content: read(join(root, ...file.path.split('/'))) }))

    // Extraction dans le processus séparé ; inchangé → extraction gardée en mémoire.
    const cache = this.cache.get(genesisId) ?? new Map<string, CachedFile>()
    const code = scan.retained.filter((file) => file.lang !== 'other')
    const errors = new Map<
      string,
      { readonly status: 'parse_error' | 'too_large'; readonly reason: string; readonly lines: number }
    >()
    const byId = new Map(code.map((file, index) => [String(index), file] as const))
    const outcome = await new Promise<'done' | 'cancelled' | 'failed'>((settle) => {
      let done = 0
      let finished = false
      const finish = (result: 'done' | 'cancelled' | 'failed'): void => {
        if (finished) return
        finished = true
        settle(result)
      }
      const worker = this.deps.runWorker(
        {
          type: 'parse',
          root,
          files: code.map((file, index) => ({
            id: String(index),
            path: file.path,
            lang: file.lang as ParseRequest['files'][number]['lang'],
            knownHash: cache.get(file.path)?.hash ?? null
          }))
        },
        (raw) => {
          const message = WorkerMessage.safeParse(raw)
          if (!message.success) return
          const data = message.data
          if (data.type === 'done') return finish(data.cancelled ? 'cancelled' : 'done')
          if (data.type === 'ready' || data.type === 'initError')
            return data.type === 'initError' ? finish('failed') : undefined
          const file = byId.get(data.id)
          if (file === undefined) return
          if (data.type === 'file')
            cache.set(file.path, { hash: data.hash, lines: data.lines, extraction: data.extraction })
          if (data.type === 'fileError') {
            cache.delete(file.path)
            errors.set(file.path, { status: data.status, reason: data.reason, lines: data.lines })
          }
          done++
          if (done % 50 === 0 || done === code.length) progress('parse', done, code.length)
          if (cancelled()) worker.cancel()
        },
        () => finish('failed')
      )
      this.running.set(genesisId, {
        cancel: () => {
          worker.cancel()
          finish('cancelled')
        }
      })
    })
    if (outcome !== 'done') return this.end(genesisId, runId, outcome)
    this.cache.set(genesisId, cache)
    for (const path of [...cache.keys()]) if (!code.some((file) => file.path === path)) cache.delete(path)

    progress('resolve', 0, 1)
    const stats = this.write(genesisId, scan, manifests, cache, errors)
    this.end(genesisId, runId, 'done', { ...stats, durationMs: Date.now() - started })
  }

  /** Assemble le graphe en mémoire puis l'écrit d'un bloc. */
  private write(
    genesisId: string,
    scan: ProjectScan,
    manifests: readonly { readonly path: string; readonly content: string }[],
    cache: ReadonlyMap<string, CachedFile>,
    errors: ReadonlyMap<
      string,
      { readonly status: 'parse_error' | 'too_large'; readonly reason: string; readonly lines: number }
    >
  ): Omit<AnalysisStatsView, 'durationMs'> {
    const overrides = this.deps.reprise.overrides(genesisId)
    const { modules, moduleOf } = detectModules(
      scan.retained.map((file) => file.path),
      manifests
    )
    const moduleIds = new Map(modules.map((module) => [module.key, stableId(genesisId, 'module', module.key)] as const))
    this.deps.graph.replaceModules(
      genesisId,
      modules.map((module) => ({ id: moduleIds.get(module.key) ?? '', genesisId, ...module }))
    )

    const resolveFiles: ResolveFile[] = []
    const symbolsOf = new Map<string, CodeSymbolRow[]>()
    for (const file of scan.retained) {
      const cached = cache.get(file.path)
      if (cached === undefined || file.lang === 'other') continue
      const counts = new Map<string, number>()
      const ids = cached.extraction.symbols.map((symbol) => {
        const seen = counts.get(symbol.qualifiedName) ?? 0
        counts.set(symbol.qualifiedName, seen + 1)
        return stableId(genesisId, file.path, symbol.qualifiedName, String(seen))
      })
      const fileSymbolId = stableId(genesisId, file.path, FILE_SYMBOL_NAME)
      resolveFiles.push({
        path: file.path,
        lang: file.lang as ResolveFile['lang'],
        extraction: cached.extraction,
        symbolIds: ids,
        fileSymbolId
      })
    }
    const config = {
      tsPaths: tsPathsOf(manifests.find((manifest) => manifest.path === 'tsconfig.json')?.content),
      psr4: psr4Of(manifests.find((manifest) => manifest.path === 'composer.json')?.content)
    }
    const { edges, entries } = resolveGraph(resolveFiles, config)
    const entryIds = new Set(entries.map((entry) => entry.symbolId))

    // Symboles et catégories (règles, puis corrections de mentalyas).
    const pathOf = new Map<string, { readonly path: string; readonly qualifiedName: string }>()
    const analyzed: AnalyzedFile[] = []
    for (const resolved of resolveFiles) {
      const fileId = stableId(genesisId, 'file', resolved.path)
      const cached = cache.get(resolved.path) as CachedFile
      const verdicts = new Map<number, CategoryVerdict>()
      const category = (
        verdict: CategoryVerdict,
        path: string,
        qualifiedName: string
      ): Pick<CodeSymbolRow, 'category' | 'categorySource' | 'categoryReason'> => {
        const corrected = overrides.get(categoryTarget(path, qualifiedName))
        return corrected !== undefined && corrected !== null && CATEGORIES.has(corrected as CodeCategory)
          ? { category: corrected as CodeCategory, categorySource: 'user', categoryReason: null }
          : { category: verdict.category, categorySource: 'rules', categoryReason: verdict.reason }
      }
      const fileVerdict = categorize({
        path: resolved.path,
        kind: 'file',
        name: FILE_SYMBOL_NAME,
        bases: [],
        attributes: [],
        entry: entryIds.has(resolved.fileSymbolId)
      })
      const rows: CodeSymbolRow[] = [
        {
          id: resolved.fileSymbolId,
          fileId,
          parentId: null,
          kind: 'namespace',
          name: FILE_SYMBOL_NAME,
          qualifiedName: FILE_SYMBOL_NAME,
          startLine: 1,
          endLine: Math.max(1, cached.lines),
          complexity: 1,
          ...category(fileVerdict, resolved.path, FILE_SYMBOL_NAME)
        }
      ]
      pathOf.set(resolved.fileSymbolId, { path: resolved.path, qualifiedName: FILE_SYMBOL_NAME })
      for (const raw of cached.extraction.symbols) {
        const id = resolved.symbolIds[raw.key] ?? ''
        const input = {
          path: resolved.path,
          kind: raw.kind,
          name: raw.name,
          bases: raw.bases,
          attributes: raw.attributes,
          entry: entryIds.has(id)
        }
        const owner = raw.parent === null ? undefined : verdicts.get(raw.parent)
        const verdict = owner === undefined ? categorize(input) : categorizeMember(input, owner)
        verdicts.set(raw.key, verdict)
        pathOf.set(id, { path: resolved.path, qualifiedName: raw.qualifiedName })
        rows.push({
          id,
          fileId,
          parentId: raw.parent === null ? null : (resolved.symbolIds[raw.parent] ?? null),
          kind: raw.kind,
          name: raw.name.slice(0, 300),
          qualifiedName: raw.qualifiedName.slice(0, 1000),
          startLine: raw.startLine,
          endLine: raw.endLine,
          complexity: raw.complexity,
          ...category(verdict, resolved.path, raw.qualifiedName)
        })
      }
      symbolsOf.set(resolved.path, rows)
    }
    for (const file of scan.retained) {
      const fileId = stableId(genesisId, 'file', file.path)
      const cached = cache.get(file.path)
      const error = errors.get(file.path)
      analyzed.push({
        file: {
          id: fileId,
          genesisId,
          moduleId: moduleIds.get(moduleOf(file.path)) ?? null,
          path: file.path,
          lang: file.lang,
          hash: cached?.hash ?? '',
          lines: cached?.lines ?? error?.lines ?? 0,
          status:
            file.lang === 'other' ? 'unsupported' : (error?.status ?? (cached === undefined ? 'parse_error' : 'ok')),
          error: error?.reason ?? null
        },
        symbols: symbolsOf.get(file.path) ?? [],
        entries: entries
          .filter((entry) => pathOf.get(entry.symbolId)?.path === file.path)
          .map((entry) => ({ symbolId: entry.symbolId, kind: entry.kind, label: entry.label.slice(0, 200) }))
      })
    }

    // Liens, avec les corrections de mentalyas.
    const edgeRows: CodeEdgeRow[] = edges.map((edge) => {
      const origin = pathOf.get(edge.fromSymbolId)
      const corrected =
        origin === undefined ? undefined : overrides.get(edgeTarget(origin.path, origin.qualifiedName, edge.rawTarget))
      const base = {
        id: stableId(genesisId, 'edge', edge.fromSymbolId, edge.kind, edge.rawTarget, edge.toSymbolId ?? ''),
        genesisId,
        fromSymbolId: edge.fromSymbolId,
        rawTarget: edge.rawTarget.slice(0, 200),
        kind: edge.kind,
        count: edge.count
      }
      return corrected === undefined
        ? { ...base, toSymbolId: edge.toSymbolId, provenance: edge.provenance, reason: edge.reason }
        : { ...base, toSymbolId: corrected, provenance: 'user' as const, reason: null }
    })

    const current = new Set(scan.retained.map((file) => file.path))
    this.deps.graph.removeFiles(
      genesisId,
      this.deps.graph
        .files(genesisId)
        .map((file) => file.path)
        .filter((path) => !current.has(path))
    )
    this.deps.graph.writeFiles(genesisId, analyzed)
    this.deps.graph.replaceEdges(genesisId, edgeRows)

    const status = (value: string): number => analyzed.filter((entry) => entry.file.status === value).length
    return {
      files: analyzed.length,
      analyzed: status('ok'),
      failed: status('parse_error') + status('too_large'),
      unsupported: status('unsupported'),
      symbols: analyzed.reduce((sum, entry) => sum + entry.symbols.length, 0),
      edges: edgeRows.length,
      resolvedSyntax: edgeRows.filter((edge) => edge.provenance === 'syntax').length,
      deduced: edgeRows.filter((edge) => edge.provenance === 'deduced').length,
      uncertain: edgeRows.filter((edge) => edge.provenance === 'uncertain').length
    }
  }

  private end(
    genesisId: string,
    runId: string,
    state: 'done' | 'cancelled' | 'failed',
    stats?: AnalysisStatsView
  ): void {
    this.running.delete(genesisId)
    const at = this.now()
    this.deps.reprise.endRun(runId, state, at, stats === undefined ? undefined : { ...stats })
    this.deps.reprise.setAnalysisState(
      genesisId,
      state === 'failed' ? 'failed' : 'idle',
      state === 'done' ? at : undefined
    )
    if (stats !== undefined) this.deps.emit({ type: 'reprise:analysisDone', payload: { genesisId, stats } })
    this.deps.emit({ type: 'reprise:changed', payload: { genesisId } })
  }

  private now(): string {
    return (this.deps.now?.() ?? new Date()).toISOString()
  }
}
