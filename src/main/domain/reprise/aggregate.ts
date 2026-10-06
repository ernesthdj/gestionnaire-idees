import type {
  CodeCategory,
  CodeLang,
  ExplorerEdgeView,
  ExplorerFiltersView,
  ExplorerLevel,
  ExplorerNodeView,
  LinkProvenance
} from '@shared/ipc/reprise'
import { EXPLORER_LIMITS } from '@shared/ipc/reprise'

/**
 * Explorateur à niveaux (spec 017 US2, R3-1 à R3-3) : le graphe du code vu comme un arbre — modules, dossiers,
 * fichiers, symboles —, et, pour un nœud ouvert, ses enfants avec les appels regroupés sur l'enfant visible qui les
 * contient. Fonctions pures : le service charge les données, les met en cache et ajoute les positions.
 */

export interface IndexModule {
  readonly key: string
  readonly name: string
  readonly rootPath: string
}
export interface IndexFile {
  readonly path: string
  readonly lang: CodeLang
  readonly moduleKey: string | null
}
export interface IndexSymbol {
  readonly id: string
  readonly path: string
  readonly parentId: string | null
  readonly kind: 'namespace' | 'class' | 'interface' | 'function' | 'method'
  readonly name: string
  readonly category: CodeCategory
}
export interface IndexEdge {
  readonly fromSymbolId: string
  readonly toSymbolId: string | null
  readonly provenance: LinkProvenance
  readonly count: number
}

export interface TreeNode {
  readonly key: string
  readonly parentKey: string | null
  readonly kind: ExplorerNodeView['kind']
  readonly title: string
  readonly lang: CodeLang | null
  category: CodeCategory
  childCount: number
}

export interface ExplorerIndex {
  readonly nodes: ReadonlyMap<string, TreeNode>
  readonly children: ReadonlyMap<string, readonly string[]>
  /** Clés, de la racine au symbole, qui contiennent ce symbole (le symbole « fichier » s'arrête au fichier). */
  readonly chains: ReadonlyMap<string, readonly string[]>
  readonly symbolCategory: ReadonlyMap<string, CodeCategory>
  readonly symbolLang: ReadonlyMap<string, CodeLang>
}

/** Nom du symbole « fichier » écrit par l'analyse (porte les appels de premier niveau) : jamais un nœud. */
export const FILE_SYMBOL = '(fichier)'
export const ROOT_KEY = ''

const ORDER: Readonly<Record<LinkProvenance, number>> = { syntax: 0, user: 0, deduced: 1, uncertain: 2 }
const weaker = (a: LinkProvenance, b: LinkProvenance): LinkProvenance => (ORDER[b] > ORDER[a] ? b : a)

const dirOf = (path: string): string => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '')

export function buildIndex(
  modules: readonly IndexModule[],
  files: readonly IndexFile[],
  symbols: readonly IndexSymbol[]
): ExplorerIndex {
  const nodes = new Map<string, TreeNode>()
  const add = (node: Omit<TreeNode, 'childCount'>): void => {
    if (!nodes.has(node.key)) nodes.set(node.key, { ...node, childCount: 0 })
  }
  const moduleRoot = new Map(modules.map((module) => [module.key, module.rootPath] as const))
  for (const module of modules) {
    add({
      key: `m:${module.key}`,
      parentKey: ROOT_KEY,
      kind: 'module',
      title: module.name,
      lang: null,
      category: 'domain'
    })
  }
  const fileKey = new Map<string, string>()
  for (const file of files) {
    const moduleKey = file.moduleKey ?? 'dir:'
    if (!nodes.has(`m:${moduleKey}`)) {
      add({
        key: `m:${moduleKey}`,
        parentKey: ROOT_KEY,
        kind: 'module',
        title: '(racine)',
        lang: null,
        category: 'domain'
      })
    }
    const root = moduleRoot.get(moduleKey) ?? ''
    let parent = `m:${moduleKey}`
    const inside = root === '' ? file.path : file.path.slice(root.length + 1)
    const dirs = dirOf(inside)
      .split('/')
      .filter((part) => part !== '')
    let walked = root
    for (const dir of dirs) {
      walked = walked === '' ? dir : `${walked}/${dir}`
      add({ key: `d:${walked}`, parentKey: parent, kind: 'folder', title: dir, lang: null, category: 'domain' })
      parent = `d:${walked}`
    }
    const key = `f:${file.path}`
    add({
      key,
      parentKey: parent,
      kind: 'file',
      title: file.path.split('/').at(-1) ?? file.path,
      lang: file.lang,
      category: 'domain'
    })
    fileKey.set(file.path, key)
  }

  const byId = new Map(symbols.map((symbol) => [symbol.id, symbol] as const))
  const chains = new Map<string, string[]>()
  const symbolCategory = new Map<string, CodeCategory>()
  const symbolLang = new Map<string, CodeLang>()
  const langOf = new Map(files.map((file) => [file.path, file.lang] as const))
  const chainOfKey = (key: string): string[] => {
    const chain: string[] = []
    let current: string | null = key
    for (let guard = 0; current !== null && current !== ROOT_KEY && guard < 100; guard++) {
      chain.unshift(current)
      current = nodes.get(current)?.parentKey ?? null
    }
    return chain
  }
  for (const symbol of symbols) {
    symbolCategory.set(symbol.id, symbol.category)
    symbolLang.set(symbol.id, langOf.get(symbol.path) ?? 'other')
    const file = fileKey.get(symbol.path)
    if (file === undefined) continue
    if (symbol.name === FILE_SYMBOL && symbol.parentId === null) {
      chains.set(symbol.id, chainOfKey(file))
      continue
    }
    const parent = symbol.parentId === null || !byId.has(symbol.parentId) ? file : `s:${symbol.parentId}`
    add({
      key: `s:${symbol.id}`,
      parentKey: parent,
      kind: symbol.kind,
      title: symbol.name,
      lang: langOf.get(symbol.path) ?? null,
      category: symbol.category
    })
  }
  for (const symbol of symbols) {
    if (!chains.has(symbol.id) && nodes.has(`s:${symbol.id}`)) chains.set(symbol.id, chainOfKey(`s:${symbol.id}`))
  }

  const children = new Map<string, string[]>()
  for (const node of nodes.values()) {
    const parent = node.parentKey ?? ROOT_KEY
    children.set(parent, [...(children.get(parent) ?? []), node.key])
    const owner = nodes.get(parent)
    if (owner !== undefined) owner.childCount++
  }
  // Catégorie d'un nœud qui regroupe (module, dossier, fichier) : la plus fréquente parmi ses symboles, plomberie
  // seulement si tout l'est ; à défaut de symbole, celle de ses fichiers (`Program.cs` : du code de premier niveau).
  const tallies = (fromFiles: boolean): Map<string, Map<CodeCategory, number>> => {
    const tally = new Map<string, Map<CodeCategory, number>>()
    for (const symbol of symbols) {
      if ((symbol.name === FILE_SYMBOL) !== fromFiles) continue
      const chain = chains.get(symbol.id) ?? []
      for (const key of fromFiles ? chain : chain.slice(0, -1)) {
        const counts = tally.get(key) ?? new Map<CodeCategory, number>()
        counts.set(symbol.category, (counts.get(symbol.category) ?? 0) + 1)
        tally.set(key, counts)
      }
    }
    return tally
  }
  const bySymbols = tallies(false)
  const byFiles = tallies(true)
  for (const node of nodes.values()) {
    if (node.kind !== 'module' && node.kind !== 'folder' && node.kind !== 'file') continue
    const counts = bySymbols.get(node.key) ?? byFiles.get(node.key)
    if (counts === undefined) continue
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
    const best = sorted.find(([category]) => category !== 'plumbing') ?? sorted[0]
    if (best !== undefined) node.category = best[0]
  }
  return { nodes, children, chains, symbolCategory, symbolLang }
}

/** Niveau montré pour un nœud ouvert : racine → modules (1), module → dossiers (2), dossier → fichiers (3), puis le code (4). */
export function levelOf(index: ExplorerIndex, parentKey: string): ExplorerLevel {
  if (parentKey === ROOT_KEY) return 1
  const kind = index.nodes.get(parentKey)?.kind
  return kind === 'module' ? 2 : kind === 'folder' ? 3 : 4
}

export function breadcrumbOf(
  index: ExplorerIndex,
  parentKey: string
): { readonly key: string; readonly title: string }[] {
  const crumbs: { key: string; title: string }[] = []
  let current: string | null = parentKey
  for (let guard = 0; current !== null && current !== ROOT_KEY && guard < 100; guard++) {
    const node = index.nodes.get(current)
    if (node === undefined) break
    crumbs.unshift({ key: node.key, title: node.title })
    current = node.parentKey
  }
  return [{ key: ROOT_KEY, title: 'Projet' }, ...crumbs]
}

export interface AggregatedView {
  readonly nodes: readonly Omit<ExplorerNodeView, 'x' | 'y'>[]
  readonly edges: readonly ExplorerEdgeView[]
  readonly grouped: readonly { readonly key: string; readonly title: string; readonly count: number }[]
  readonly hidden: { readonly plumbingCalls: number; readonly nodes: number }
}

/**
 * Enfants d'un nœud ouvert et appels entre eux (R3-1) : chaque extrémité d'un lien remonte sur l'enfant visible qui
 * la contient ; nombre d'appels additionné, fiabilité la plus faible. Filtres appliqués avant le regroupement ; au-delà
 * de 150 enfants, les moins reliés sont regroupés (R3-2). `focusKey` : n'afficher que lui et ses voisins (« isoler »).
 */
export function aggregateView(
  index: ExplorerIndex,
  edges: readonly IndexEdge[],
  parentKey: string,
  filters: ExplorerFiltersView,
  focus?: { readonly key: string; readonly depth: 1 | 2 }
): AggregatedView {
  const level = levelOf(index, parentKey)
  const shownCategory = (category: CodeCategory): boolean => filters.categories.includes(category)
  const shownLang = (lang: CodeLang | null): boolean =>
    lang === null || filters.langs.length === 0 || filters.langs.includes(lang)
  const all = (index.children.get(parentKey) ?? [])
    .map((key) => index.nodes.get(key))
    .filter((node): node is TreeNode => node !== undefined)
  let visible = all.filter((node) => shownCategory(node.category) && shownLang(node.lang))
  const hiddenNodes = all.length - visible.length
  const visibleKeys = new Set(visible.map((node) => node.key))

  let plumbingCalls = 0
  const merged = new Map<string, ExplorerEdgeView>()
  for (const edge of edges) {
    if (edge.toSymbolId === null) continue
    const fromCategory = index.symbolCategory.get(edge.fromSymbolId)
    const toCategory = index.symbolCategory.get(edge.toSymbolId)
    if (fromCategory === undefined || toCategory === undefined) continue
    if (!shownCategory(fromCategory) || !shownCategory(toCategory)) {
      if (fromCategory === 'plumbing' || toCategory === 'plumbing') plumbingCalls += edge.count
      continue
    }
    if (filters.hideUncertain && edge.provenance === 'uncertain') continue
    if (
      !shownLang(index.symbolLang.get(edge.fromSymbolId) ?? null) ||
      !shownLang(index.symbolLang.get(edge.toSymbolId) ?? null)
    )
      continue
    const from = index.chains.get(edge.fromSymbolId)?.find((key) => visibleKeys.has(key))
    const to = index.chains.get(edge.toSymbolId)?.find((key) => visibleKeys.has(key))
    if (from === undefined || to === undefined || from === to) continue
    const key = `${from}→${to}`
    const existing = merged.get(key)
    merged.set(
      key,
      existing === undefined
        ? { from, to, count: edge.count, provenance: edge.provenance }
        : { ...existing, count: existing.count + edge.count, provenance: weaker(existing.provenance, edge.provenance) }
    )
  }
  let links = [...merged.values()]

  if (focus !== undefined && visibleKeys.has(focus.key)) {
    const kept = new Set([focus.key])
    for (let step = 0; step < focus.depth; step++) {
      for (const link of links) {
        if (kept.has(link.from)) kept.add(link.to)
        if (kept.has(link.to)) kept.add(link.from)
      }
    }
    visible = visible.filter((node) => kept.has(node.key))
    links = links.filter((link) => kept.has(link.from) && kept.has(link.to))
  }

  // Trop d'enfants : les moins reliés sont regroupés (« + 42 fichiers »).
  const grouped: { key: string; title: string; count: number }[] = []
  if (visible.length > EXPLORER_LIMITS.nodes) {
    const degree = new Map<string, number>()
    for (const link of links) {
      degree.set(link.from, (degree.get(link.from) ?? 0) + link.count)
      degree.set(link.to, (degree.get(link.to) ?? 0) + link.count)
    }
    const sorted = [...visible].sort(
      (a, b) => (degree.get(b.key) ?? 0) - (degree.get(a.key) ?? 0) || a.title.localeCompare(b.title)
    )
    const keep = sorted.slice(0, EXPLORER_LIMITS.nodes - 1)
    const rest = sorted.slice(EXPLORER_LIMITS.nodes - 1)
    grouped.push({ key: `${parentKey}#reste`, title: `+ ${rest.length} éléments`, count: rest.length })
    visible = keep
    const keys = new Set(keep.map((node) => node.key))
    links = links.filter((link) => keys.has(link.from) && keys.has(link.to))
  }
  links = links.sort((a, b) => b.count - a.count).slice(0, EXPLORER_LIMITS.edges)

  return {
    nodes: visible.map((node) => ({
      key: node.key,
      level,
      kind: node.kind,
      title: node.title,
      category: node.category,
      lang: node.lang,
      childCount: node.childCount
    })),
    edges: links,
    grouped,
    hidden: { plumbingCalls, nodes: hiddenNodes }
  }
}
