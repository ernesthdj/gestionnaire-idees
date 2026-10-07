import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'
import type {
  CodeBlockLinkView,
  CodeBlockView,
  CodeExcerptView,
  ExplorerFiltersView,
  ExplorerLinkView,
  ExplorerNodeDetailView,
  ExplorerPlaceView,
  ExplorerView,
  FileCodeView
} from '@shared/ipc/reprise'
import { EXPLORER_LIMITS } from '@shared/ipc/reprise'
import { AppError } from '../../domain/errors'
import {
  aggregateView,
  breadcrumbOf,
  buildIndex,
  FILE_SYMBOL,
  levelOf,
  openableKey,
  placeOf,
  RACINE_PREFIX,
  ROOT_KEY,
  type ExplorerIndex,
  type IndexEdge
} from '../../domain/reprise/aggregate'
import { ANALYZED_FILE_MAX_BYTES, classifyFile } from '../../domain/reprise/fileFilter'
import { parseSource } from '../../domain/reprise/guideSources'
import { columnLayout, FOLDER_ROW_HEIGHT, ROW_HEIGHT } from '../../domain/reprise/layout'
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
  readonly size?: (path: string) => number
  readonly exists?: (path: string) => boolean
}

/** Résultat de recherche : la place de l'élément sur la carte (D16), son nom et son chemin dans l'arbre. */
export type SearchResult = ExplorerPlaceView & { readonly key: string; readonly title: string; readonly where: string }

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
    // Seuls un module ou un dossier s'ouvrent (D16) : un ancien état sur un fichier ouvre son dossier.
    const parentKey = openableKey(loaded.index, input.parentKey)
    const level = levelOf(parentKey)
    const aggregated = aggregateView(
      loaded.index,
      loaded.edges as readonly IndexEdge[],
      parentKey,
      input.filters,
      input.focusKey === undefined ? undefined : { key: input.focusKey, depth: input.depth ?? 1 }
    )
    const positions = columnLayout(
      aggregated.nodes,
      aggregated.edges,
      this.deps.reprise.positions(genesisId, level, parentKey),
      level === 1 ? ROW_HEIGHT : FOLDER_ROW_HEIGHT
    )
    return {
      level,
      breadcrumb: breadcrumbOf(loaded.index, parentKey),
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
    // « Racine » d'un module ou d'un dossier : ses fichiers directs, vus ensemble.
    const racineOf = key.startsWith(RACINE_PREFIX) ? key.slice(RACINE_PREFIX.length) : null
    const node = loaded.index.nodes.get(racineOf ?? key)
    if (node === undefined) throw new AppError('NOT_FOUND', 'Élément introuvable.')
    const scope =
      racineOf === null ? [key] : (loaded.index.children.get(racineOf) ?? []).filter((child) => child.startsWith('f:'))
    const inside = (symbolId: string): boolean =>
      loaded.index.chains.get(symbolId)?.some((chainKey) => scope.includes(chainKey)) ?? false
    const linkOf = (symbolId: string, edge: CodeEdgeRow): ExplorerLinkView => {
      const symbol = loaded.symbols.get(symbolId)
      const isFile = symbol?.name === FILE_SYMBOL
      return {
        key: isFile ? `f:${symbol?.path ?? ''}` : `s:${symbolId}`,
        title: isFile ? (symbol?.path ?? '') : (symbol?.qualifiedName ?? symbolId),
        path: symbol?.path ?? null,
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
    if (racineOf !== null) {
      return {
        key,
        parentKey: racineOf,
        kind: 'folder',
        title: `Racine · ${node.title}`,
        path: racineOf.startsWith('m:') ? (loaded.modules.get(racineOf.slice(2))?.rootPath ?? null) : racineOf.slice(2),
        category: node.category,
        categorySource: 'rules',
        lang: null,
        lines: null,
        summary: null,
        analogy: null,
        callers,
        callees,
        error: null
      }
    }
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
    const lines = this.readLines(project.rootDir, symbol.path)
    const start = Math.max(1, symbol.startLine)
    const end = Math.min(lines.length, symbol.endLine, start + EXPLORER_LIMITS.excerptLines - 1)
    const lang = this.load(genesisId).files.get(symbol.path)?.lang ?? 'other'
    return { path: symbol.path, startLine: start, lines: lines.slice(start - 1, end), lang }
  }

  /**
   * Fichier complet pour le volet (D16, FR-037) : son texte (lecture seule), et chaque bloc avec ses appelants et ses
   * appelés ; la ligne d'un appel est repérée de façon approchée (le nom appelé dans le bloc).
   */
  file(genesisId: string, path: string): FileCodeView {
    const project = this.projectOrThrow(genesisId)
    const loaded = this.load(genesisId)
    const file = loaded.files.get(path)
    const place = this.placeIn(loaded, `f:${path}`)
    if (file === undefined || place === null) throw new AppError('NOT_FOUND', 'Fichier introuvable dans ce projet.')
    const all = this.readLines(project.rootDir, path)
    const lines = all.slice(0, EXPLORER_LIMITS.fileLines)
    const own = [...loaded.symbols.values()]
      .filter((symbol) => symbol.path === path && (symbol.kind !== 'namespace' || symbol.name === FILE_SYMBOL))
      .sort((a, b) => a.startLine - b.startLine)
    const linkTo = (
      symbolId: string,
      edge: CodeEdgeRow,
      range: { readonly start: number; readonly end: number } | null
    ): CodeBlockLinkView | null => {
      const other = loaded.symbols.get(symbolId)
      if (other === undefined) return null
      const isFile = other.name === FILE_SYMBOL
      let at: number | null = null
      if (range !== null && !isFile) {
        for (let line = range.start; line <= Math.min(range.end, lines.length); line++) {
          if (lines[line - 1]?.includes(other.name) === true) {
            at = line
            break
          }
        }
      }
      return {
        symbolId,
        title: isFile ? other.path : other.qualifiedName,
        path: other.path,
        line: isFile ? 1 : other.startLine,
        kind: edge.kind,
        provenance: edge.provenance,
        count: edge.count,
        at
      }
    }
    const blocks: CodeBlockView[] = []
    for (const symbol of own) {
      const isFile = symbol.name === FILE_SYMBOL
      const range = { start: isFile ? 1 : symbol.startLine, end: isFile ? lines.length : symbol.endLine }
      const callers: CodeBlockLinkView[] = []
      const callees: CodeBlockLinkView[] = []
      let external = 0
      for (const edge of loaded.edges) {
        if (edge.fromSymbolId === symbol.id) {
          if (edge.toSymbolId === null) external += edge.count
          else if (edge.toSymbolId !== symbol.id && callees.length < EXPLORER_LIMITS.callers) {
            const link = linkTo(edge.toSymbolId, edge, range)
            if (link !== null) callees.push(link)
          }
        } else if (edge.toSymbolId === symbol.id && callers.length < EXPLORER_LIMITS.callers) {
          const link = linkTo(edge.fromSymbolId, edge, null)
          if (link !== null) callers.push(link)
        }
      }
      if (isFile && callers.length === 0 && callees.length === 0 && external === 0) continue
      blocks.push({
        symbolId: symbol.id,
        kind: isFile ? 'file' : symbol.kind,
        name: isFile ? 'Code de premier niveau' : symbol.name,
        startLine: range.start,
        endLine: Math.max(range.start, range.end),
        category: symbol.category,
        corrected: symbol.categorySource === 'user',
        callers,
        callees,
        external
      })
    }
    return {
      path,
      lang: file.lang,
      lines,
      truncated: all.length > lines.length,
      blocks,
      error: file.error,
      place
    }
  }

  search(genesisId: string, query: string): { readonly results: readonly SearchResult[] } {
    this.projectOrThrow(genesisId)
    const loaded = this.load(genesisId)
    const needle = query.trim().toLowerCase()
    const results: SearchResult[] = []
    for (const node of loaded.index.nodes.values()) {
      if (results.length >= EXPLORER_LIMITS.search) break
      if (!node.title.toLowerCase().includes(needle)) continue
      const place = this.placeIn(loaded, node.key)
      if (place === null) continue
      results.push({
        ...place,
        key: place.nodeKey,
        title: node.title,
        where: breadcrumbOf(loaded.index, node.parentKey ?? ROOT_KEY)
          .slice(1)
          .map((crumb) => crumb.title)
          .join(' › ')
      })
    }
    return { results }
  }

  /** Où un élément apparaît sur la carte (D16), et le fichier à montrer dans le volet s'il y en a un. */
  private placeIn(loaded: Loaded, key: string): ExplorerPlaceView | null {
    return placeOf(loaded.index, key, (symbolId) => loaded.symbols.get(symbolId)?.path)
  }

  /**
   * Éléments de l'explorateur désignés par des sources citées (guide de reprise, spec 017 US4) : module, dossier,
   * fichier, `fichier#symbole` ou nom de symbole. Une source inconnue est omise.
   */
  locate(
    genesisId: string,
    sources: readonly string[]
  ): { readonly results: readonly (ExplorerPlaceView & { readonly source: string; readonly key: string })[] } {
    this.projectOrThrow(genesisId)
    const loaded = this.load(genesisId)
    const symbols = [...loaded.symbols.values()].filter((symbol) => symbol.name !== FILE_SYMBOL)
    const moduleAt = new Map([...loaded.modules.values()].map((module) => [module.rootPath, module.key] as const))
    const results: (ExplorerPlaceView & { source: string; key: string })[] = []
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
      const key = candidates.find((candidate) => loaded.index.nodes.has(candidate))
      const place = key === undefined ? null : this.placeIn(loaded, key)
      if (place !== null) results.push({ ...place, source: raw, key: place.nodeKey })
    }
    return { results }
  }

  savePosition(
    genesisId: string,
    input: { readonly parentKey: string; readonly nodeKey: string; readonly x: number; readonly y: number }
  ): void {
    this.projectOrThrow(genesisId)
    const level = levelOf(input.parentKey)
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
    return { parentKey: openableKey(this.load(genesisId).index, saved.lastParentKey ?? ROOT_KEY), filters }
  }

  saveState(genesisId: string, input: { readonly parentKey: string; readonly filters: ExplorerFiltersView }): void {
    this.projectOrThrow(genesisId)
    this.deps.reprise.saveExplorerState({
      genesisId,
      filtersJson: JSON.stringify(input.filters),
      lastLevel: levelOf(input.parentKey),
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

  /** Lignes d'un fichier du projet : sous la racine réelle, 1 Mo au plus, jamais un fichier sensible ni binaire. */
  private readLines(rootDir: string, path: string): string[] {
    if (classifyFile(path, 0, () => false).kind === 'sensitive') {
      throw new AppError('SECRET_FILE', 'Fichier sensible : jamais affiché.')
    }
    let text: string
    try {
      const root = realpathSync(rootDir)
      const target = realpathSync(join(root, ...path.split('/')))
      const inside = relative(root, target)
      if (inside === '' || inside.startsWith('..') || isAbsolute(inside)) throw new Error('hors du projet')
      if ((this.deps.size ?? ((file: string) => statSync(file).size))(target) > ANALYZED_FILE_MAX_BYTES) {
        throw new AppError('TOO_LARGE', 'Fichier de plus de 1 Mo : pas affiché.')
      }
      text = (this.deps.readText ?? ((file: string) => readFileSync(file, 'utf8')))(target)
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError('FOLDER_MISSING', 'Le fichier est introuvable dans le dossier du projet.')
    }
    if (text.includes('\u0000')) throw new AppError('INVALID_STATE', 'Ce fichier n’est pas un fichier texte.')
    return text.split(/\r?\n/)
  }

  private projectOrThrow(genesisId: string): NonNullable<ReturnType<RepriseRepository['project']>> {
    const project = this.deps.reprise.project(genesisId)
    if (project === undefined) throw new AppError('NOT_FOUND', 'Projet repris introuvable.')
    return project
  }
}
