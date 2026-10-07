import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'
import type {
  CodeExcerptView,
  ExplorerFiltersView,
  ExplorerLinkView,
  ExplorerNodeDetailView,
  ExplorerView
} from '@shared/ipc/reprise'
import { EXPLORER_LIMITS } from '@shared/ipc/reprise'
import { AppError } from '../../domain/errors'
import {
  aggregateView,
  breadcrumbOf,
  buildIndex,
  FILE_SYMBOL,
  levelOf,
  ROOT_KEY,
  type ExplorerIndex,
  type IndexEdge
} from '../../domain/reprise/aggregate'
import { classifyFile } from '../../domain/reprise/fileFilter'
import { parseSource } from '../../domain/reprise/guideSources'
import { columnLayout } from '../../domain/reprise/layout'
import type {
  CodeEdgeRow,
  CodeFileRow,
  CodeGraphRepository,
  CodeModuleRow,
  CodeSymbolRow
} from '../../infrastructure/db/repositories/CodeGraphRepository'
import type { RepriseRepository } from '../../infrastructure/db/repositories/RepriseRepository'
import { fileCalls, type FileCall } from '../../domain/reprise/measured'

export interface ExplorerDeps {
  readonly reprise: Pick<
    RepriseRepository,
    'project' | 'positions' | 'savePosition' | 'explorerState' | 'saveExplorerState'
  >
  readonly graph: Pick<CodeGraphRepository, 'modules' | 'files' | 'symbols' | 'edges'>
  readonly readText?: (path: string) => string
  readonly exists?: (path: string) => boolean
}

interface Loaded {
  readonly index: ExplorerIndex
  readonly edges: readonly CodeEdgeRow[]
  readonly symbols: ReadonlyMap<string, CodeSymbolRow & { readonly path: string }>
  readonly files: ReadonlyMap<string, CodeFileRow>
  readonly modules: ReadonlyMap<string, CodeModuleRow>
}

export const DEFAULT_FILTERS: ExplorerFiltersView = {
  categories: ['domain', 'orchestration', 'infrastructure'],
  langs: [],
  hideUncertain: false
}

/**
 * Explorateur d'un projet repris (spec 017 US2) : le graphe est chargé une fois et gardé en cache jusqu'à la
 * prochaine analyse ou correction (`invalidate`). L'interface ne reçoit que des chemins relatifs ; un extrait de code
 * est lu sous la racine du projet, jamais dans un fichier sensible.
 */
export class ExplorerService {
  private readonly cache = new Map<string, Loaded>()
  private readonly calls = new Map<string, readonly FileCall[]>()

  constructor(private readonly deps: ExplorerDeps) {}

  invalidate(genesisId: string): void {
    this.cache.delete(genesisId)
    this.calls.delete(genesisId)
  }

  /** Appels résolus entre fichiers du projet (spec 017 US7) ; vide tant que le projet n'est pas analysé. */
  fileCalls(genesisId: string): readonly FileCall[] {
    const cached = this.calls.get(genesisId)
    if (cached !== undefined) return cached
    const loaded = this.load(genesisId)
    const calls = fileCalls(loaded.edges, (symbolId) => loaded.symbols.get(symbolId)?.path)
    this.calls.set(genesisId, calls)
    return calls
  }

  view(
    genesisId: string,
    input: {
      readonly parentKey: string
      readonly filters: ExplorerFiltersView
      readonly focusKey?: string | undefined
      readonly depth?: 1 | 2 | undefined
    }
  ): ExplorerView {
    const project = this.projectOrThrow(genesisId)
    const loaded = this.load(genesisId)
    if (input.parentKey !== ROOT_KEY && !loaded.index.nodes.has(input.parentKey)) {
      throw new AppError('NOT_FOUND', 'Élément introuvable : le projet a peut-être été réanalysé.')
    }
    const level = levelOf(loaded.index, input.parentKey)
    const aggregated = aggregateView(
      loaded.index,
      loaded.edges as readonly IndexEdge[],
      input.parentKey,
      input.filters,
      input.focusKey === undefined ? undefined : { key: input.focusKey, depth: input.depth ?? 1 }
    )
    const positions = columnLayout(
      aggregated.nodes,
      aggregated.edges,
      this.deps.reprise.positions(genesisId, level, input.parentKey)
    )
    return {
      level,
      breadcrumb: breadcrumbOf(loaded.index, input.parentKey),
      nodes: aggregated.nodes.map((node) => ({
        ...node,
        x: positions.get(node.key)?.x ?? null,
        y: positions.get(node.key)?.y ?? null
      })),
      edges: aggregated.edges,
      grouped: aggregated.grouped,
      hidden: aggregated.hidden,
      confidentiality: project.confidentiality,
      folderMissing: !(this.deps.exists ?? existsSync)(project.rootDir)
    }
  }

  /** Détail d'un élément : ce qu'il est, et qui l'appelle / qui il appelle hors de lui-même. */
  node(genesisId: string, key: string): ExplorerNodeDetailView {
    this.projectOrThrow(genesisId)
    const loaded = this.load(genesisId)
    const node = loaded.index.nodes.get(key)
    if (node === undefined) throw new AppError('NOT_FOUND', 'Élément introuvable.')
    const inside = (symbolId: string): boolean => loaded.index.chains.get(symbolId)?.includes(key) ?? false
    const linkOf = (symbolId: string, edge: CodeEdgeRow): ExplorerLinkView => {
      const symbol = loaded.symbols.get(symbolId)
      const isFile = symbol?.name === FILE_SYMBOL
      return {
        key: isFile ? `f:${symbol?.path ?? ''}` : `s:${symbolId}`,
        title: isFile ? (symbol?.path ?? '') : (symbol?.qualifiedName ?? symbolId),
        provenance: edge.provenance,
        reason: edge.reason
      }
    }
    const callers: ExplorerLinkView[] = []
    const callees: ExplorerLinkView[] = []
    for (const edge of loaded.edges) {
      if (edge.toSymbolId === null) continue
      const from = inside(edge.fromSymbolId)
      const to = inside(edge.toSymbolId)
      if (from && !to && callees.length < EXPLORER_LIMITS.callers) callees.push(linkOf(edge.toSymbolId, edge))
      if (to && !from && callers.length < EXPLORER_LIMITS.callers) callers.push(linkOf(edge.fromSymbolId, edge))
    }
    const symbol = key.startsWith('s:') ? loaded.symbols.get(key.slice(2)) : undefined
    const file = key.startsWith('f:') ? loaded.files.get(key.slice(2)) : undefined
    const module = key.startsWith('m:') ? loaded.modules.get(key.slice(2)) : undefined
    return {
      key,
      parentKey: node.parentKey ?? ROOT_KEY,
      kind: node.kind,
      title: node.title,
      path: symbol?.path ?? file?.path ?? module?.rootPath ?? (key.startsWith('d:') ? key.slice(2) : null),
      category: node.category,
      categorySource: symbol?.categorySource ?? 'rules',
      lang: node.lang,
      lines: symbol === undefined ? (file?.lines ?? null) : symbol.endLine - symbol.startLine + 1,
      summary: module?.summary ?? null,
      analogy: module?.analogy ?? null,
      callers,
      callees,
      error: file?.error ?? null
    }
  }

  /** Extrait du code d'un symbole (200 lignes au plus), lu sous la racine ; jamais un fichier sensible. */
  code(genesisId: string, symbolId: string): CodeExcerptView {
    const project = this.projectOrThrow(genesisId)
    const symbol = this.load(genesisId).symbols.get(symbolId)
    if (symbol === undefined) throw new AppError('NOT_FOUND', 'Élément introuvable.')
    if (classifyFile(symbol.path, 0, () => false).kind === 'sensitive') {
      throw new AppError('SECRET_FILE', 'Fichier sensible : jamais affiché.')
    }
    let text: string
    try {
      const root = realpathSync(project.rootDir)
      const target = realpathSync(join(root, ...symbol.path.split('/')))
      const inside = relative(root, target)
      if (inside === '' || inside.startsWith('..') || isAbsolute(inside)) throw new Error('hors du projet')
      text = (this.deps.readText ?? ((path: string) => readFileSync(path, 'utf8')))(target)
    } catch {
      throw new AppError('FOLDER_MISSING', 'Le fichier est introuvable dans le dossier du projet.')
    }
    const lines = text.split(/\r?\n/)
    const start = Math.max(1, symbol.startLine)
    const end = Math.min(lines.length, symbol.endLine, start + EXPLORER_LIMITS.excerptLines - 1)
    const lang = this.load(genesisId).files.get(symbol.path)?.lang ?? 'other'
    return { path: symbol.path, startLine: start, lines: lines.slice(start - 1, end), lang }
  }

  search(
    genesisId: string,
    query: string
  ): {
    readonly results: readonly {
      readonly key: string
      readonly parentKey: string
      readonly title: string
      readonly path: string
    }[]
  } {
    this.projectOrThrow(genesisId)
    const loaded = this.load(genesisId)
    const needle = query.trim().toLowerCase()
    const results: { key: string; parentKey: string; title: string; path: string }[] = []
    for (const node of loaded.index.nodes.values()) {
      if (results.length >= EXPLORER_LIMITS.search) break
      if (!node.title.toLowerCase().includes(needle)) continue
      results.push({
        key: node.key,
        parentKey: node.parentKey ?? ROOT_KEY,
        title: node.title,
        path: breadcrumbOf(loaded.index, node.parentKey ?? ROOT_KEY)
          .slice(1)
          .map((crumb) => crumb.title)
          .join(' › ')
      })
    }
    return { results }
  }

  /**
   * Éléments de l'explorateur désignés par des sources citées (guide de reprise, spec 017 US4) : module, dossier,
   * fichier, `fichier#symbole` ou nom de symbole. Une source inconnue est omise.
   */
  locate(
    genesisId: string,
    sources: readonly string[]
  ): { readonly results: readonly { readonly source: string; readonly key: string; readonly parentKey: string }[] } {
    this.projectOrThrow(genesisId)
    const loaded = this.load(genesisId)
    const symbols = [...loaded.symbols.values()].filter((symbol) => symbol.name !== FILE_SYMBOL)
    const moduleAt = new Map([...loaded.modules.values()].map((module) => [module.rootPath, module.key] as const))
    const results: { source: string; key: string; parentKey: string }[] = []
    for (const raw of sources) {
      const source = parseSource(raw)
      if (source === null) continue
      const { path, symbol } = source
      const named = (candidate: CodeSymbolRow): boolean =>
        candidate.name === symbol || candidate.qualifiedName === symbol
      const bare = path.replace(/\(\)$/, '')
      const candidates =
        symbol !== undefined
          ? symbols.filter((entry) => entry.path === path && named(entry)).map((entry) => `s:${entry.id}`)
          : [
              `m:${source.text}`,
              `f:${path}`,
              `d:${path}`,
              ...(moduleAt.has(path) ? [`m:${moduleAt.get(path) ?? ''}`] : []),
              ...(path.includes('/')
                ? []
                : symbols
                    .filter((entry) => entry.name === bare || entry.qualifiedName === bare)
                    .map((entry) => `s:${entry.id}`))
            ]
      const node = candidates.map((key) => loaded.index.nodes.get(key)).find((found) => found !== undefined)
      if (node !== undefined) results.push({ source: raw, key: node.key, parentKey: node.parentKey ?? ROOT_KEY })
    }
    return { results }
  }

  savePosition(
    genesisId: string,
    input: { readonly parentKey: string; readonly nodeKey: string; readonly x: number; readonly y: number }
  ): void {
    this.projectOrThrow(genesisId)
    const level = levelOf(this.load(genesisId).index, input.parentKey)
    this.deps.reprise.savePosition({ genesisId, level, ...input })
  }

  state(genesisId: string): { readonly parentKey: string; readonly filters: ExplorerFiltersView } {
    this.projectOrThrow(genesisId)
    const saved = this.deps.reprise.explorerState(genesisId)
    if (saved === undefined) return { parentKey: ROOT_KEY, filters: DEFAULT_FILTERS }
    let filters = DEFAULT_FILTERS
    try {
      filters = { ...DEFAULT_FILTERS, ...(JSON.parse(saved.filtersJson) as Partial<ExplorerFiltersView>) }
    } catch {
      // État illisible : les filtres par défaut.
    }
    const parentKey = saved.lastParentKey ?? ROOT_KEY
    return { parentKey: this.load(genesisId).index.nodes.has(parentKey) ? parentKey : ROOT_KEY, filters }
  }

  saveState(genesisId: string, input: { readonly parentKey: string; readonly filters: ExplorerFiltersView }): void {
    this.projectOrThrow(genesisId)
    this.deps.reprise.saveExplorerState({
      genesisId,
      filtersJson: JSON.stringify(input.filters),
      lastLevel: levelOf(this.load(genesisId).index, input.parentKey),
      lastParentKey: input.parentKey
    })
  }

  private load(genesisId: string): Loaded {
    const cached = this.cache.get(genesisId)
    if (cached !== undefined) return cached
    const modules = this.deps.graph.modules(genesisId)
    const files = this.deps.graph.files(genesisId)
    const symbols = this.deps.graph.symbols(genesisId)
    const moduleKeyById = new Map(modules.map((module) => [module.id, module.key] as const))
    const loaded: Loaded = {
      index: buildIndex(
        modules,
        files.map((file) => ({
          path: file.path,
          lang: file.lang,
          moduleKey: file.moduleId === null ? null : (moduleKeyById.get(file.moduleId) ?? null)
        })),
        symbols
      ),
      edges: this.deps.graph.edges(genesisId),
      symbols: new Map(symbols.map((symbol) => [symbol.id, symbol] as const)),
      files: new Map(files.map((file) => [file.path, file] as const)),
      modules: new Map(modules.map((module) => [module.key, module] as const))
    }
    this.cache.set(genesisId, loaded)
    return loaded
  }

  private projectOrThrow(genesisId: string): NonNullable<ReturnType<RepriseRepository['project']>> {
    const project = this.deps.reprise.project(genesisId)
    if (project === undefined) throw new AppError('NOT_FOUND', 'Projet repris introuvable.')
    return project
  }
}
