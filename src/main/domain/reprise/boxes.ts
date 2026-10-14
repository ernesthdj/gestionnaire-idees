import type {
  CodeCategory,
  CodeEdgeKind,
  CodeLang,
  CodeLayer,
  LinkProvenance,
  MapCallSentence,
  MapCallView,
  MapFileView,
  MapModuleView
} from '@shared/ipc/reprise'
import { MAP_LIMITS, weakestProvenance } from '@shared/ipc/reprise'
import { FILE_SYMBOL } from './aggregate'

/**
 * Carte de l'explorateur en boîtes (spec 031) : les modules et leurs fichiers à plat, la couche de chaque module, les
 * appels de fichier à fichier en phrases lisibles, l'ordre des colonnes et la profondeur d'appel des fichiers. Pur : le
 * service fournit les lignes de l'analyse (spec 017) et les catégories déjà calculées par l'index.
 */

export interface BoxModuleInput {
  /** Clé de l'analyse, sans `m:` (`dir:Domain`, `csproj:App`…). */
  readonly key: string
  readonly name: string
  readonly rootPath: string
  readonly summary: string | null
}
export interface BoxFileInput {
  readonly path: string
  readonly lang: CodeLang
  readonly lines: number
  readonly moduleKey: string | null
  /** Rôle écrit avec le guide (spec 031 D12a) ; `null` : pas écrit. */
  readonly summary?: string | null
}
export interface BoxSymbolInput {
  readonly id: string
  readonly path: string
  readonly parentId: string | null
  readonly kind: 'namespace' | 'class' | 'interface' | 'function' | 'method'
  readonly name: string
  readonly startLine: number
}
export interface BoxEdgeInput {
  readonly fromSymbolId: string
  readonly toSymbolId: string | null
  readonly kind: CodeEdgeKind
  readonly provenance: LinkProvenance
  readonly count: number
  /** Cibles possibles d'un lien incertain (JSON : identifiants de symboles). */
  readonly candidatesJson: string | null
}
export interface BoxesInput {
  readonly modules: readonly BoxModuleInput[]
  readonly files: readonly BoxFileInput[]
  readonly symbols: readonly BoxSymbolInput[]
  readonly edges: readonly BoxEdgeInput[]
  /** Points d'entrée de l'analyse (`main`, `cli`, routes…). */
  readonly entries: readonly { readonly symbolId: string; readonly kind: string }[]
  /** Catégorie d'un nœud de l'index (`m:…`, `f:…`), la plus fréquente parmi ses symboles. */
  readonly categoryOf: (key: string) => CodeCategory
}
export interface Boxes {
  readonly modules: MapModuleView[]
  readonly files: MapFileView[]
  readonly calls: MapCallView[]
  readonly truncated: boolean
}

/** Module des fichiers posés hors de tout module (la racine du projet), comme dans l'index de la spec 017. */
export const ROOT_MODULE = 'dir:'
/** Profondeur d'appel la plus grande montrée (au plus 4 colonnes dans un module, spec 031 D5). */
export const MAX_DEPTH = 3
/** Colonne la plus à droite de la carte d'ensemble. */
export const MAX_COLUMN = 8

const LAYER_OF: Readonly<Record<CodeCategory, CodeLayer>> = {
  orchestration: 'entry',
  domain: 'rules',
  infrastructure: 'data',
  plumbing: 'data'
}
const STARTING_ENTRIES = new Set(['main', 'cli'])
const basename = (path: string): string => path.split('/').at(-1) ?? path

/**
 * Plus long chemin d'appel jusqu'à chaque nœud (0 : personne ne l'appelle), borné à `max`. Ordre topologique : quand
 * une boucle bloque (A appelle B qui appelle A), elle est rompue au nœud le moins appelé de ce qui reste, sans qu'elle
 * fasse croître les profondeurs.
 */
export function longestDepths(
  nodes: readonly string[],
  links: readonly (readonly [string, string])[],
  max: number
): Map<string, number> {
  const depth = new Map<string, number>(nodes.map((node) => [node, 0]))
  const out = new Map<string, string[]>()
  const incoming = new Map<string, number>(nodes.map((node) => [node, 0]))
  const seen = new Set<string>()
  for (const [from, to] of links) {
    const key = `${from}\u0000${to}`
    if (from === to || !depth.has(from) || !depth.has(to) || seen.has(key)) continue
    seen.add(key)
    out.set(from, [...(out.get(from) ?? []), to])
    incoming.set(to, (incoming.get(to) ?? 0) + 1)
  }
  const remaining = new Set(nodes)
  const ready = nodes.filter((node) => incoming.get(node) === 0)
  while (remaining.size > 0) {
    if (ready.length === 0) {
      // Boucle : on la rompt au nœud qui a le moins d'appels encore en attente.
      let pick = ''
      for (const node of remaining)
        if (pick === '' || (incoming.get(node) ?? 0) < (incoming.get(pick) ?? 0)) pick = node
      ready.push(pick)
    }
    const node = ready.shift() ?? ''
    if (!remaining.delete(node)) continue
    for (const to of out.get(node) ?? []) {
      if (!remaining.has(to)) continue
      depth.set(to, Math.min(max, Math.max(depth.get(to) ?? 0, (depth.get(node) ?? 0) + 1)))
      incoming.set(to, (incoming.get(to) ?? 0) - 1)
      if (incoming.get(to) === 0) ready.push(to)
    }
  }
  return depth
}

/** Liens qui donnent le sens de lecture (qui sollicite qui) : pas « implémente » ni « importe », qui remontent. */
const ORDERING_KINDS: ReadonlySet<CodeEdgeKind> = new Set(['call', 'injects', 'route'])

/**
 * Fonctions et méthodes de chaque fichier, dans l'ordre du code, sans les constructeurs (méthode au nom de sa classe),
 * `max` par fichier.
 */
export function fileFunctions(
  symbols: readonly Pick<BoxSymbolInput, 'id' | 'path' | 'parentId' | 'kind' | 'name' | 'startLine'>[],
  max: number = MAP_LIMITS.functionsPerFile
): Map<string, string[]> {
  const byId = new Map(symbols.map((symbol) => [symbol.id, symbol] as const))
  const functions = new Map<string, string[]>()
  for (const symbol of [...symbols].sort((a, b) => a.startLine - b.startLine)) {
    if (symbol.kind !== 'function' && symbol.kind !== 'method') continue
    const owner = symbol.parentId === null ? undefined : byId.get(symbol.parentId)
    if (owner !== undefined && owner.name === symbol.name) continue
    const list = functions.get(symbol.path) ?? []
    if (list.length < max && !list.includes(symbol.name)) list.push(symbol.name)
    functions.set(symbol.path, list)
  }
  return functions
}

/** Liste de symboles d'un JSON de cibles possibles ; vide si illisible. */
function candidatesOf(json: string | null): string[] {
  if (json === null) return []
  try {
    const value: unknown = JSON.parse(json)
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export function buildBoxes(input: BoxesInput): Boxes {
  const symbols = new Map(input.symbols.map((symbol) => [symbol.id, symbol] as const))
  const label = (symbol: BoxSymbolInput): string => {
    if (symbol.name === FILE_SYMBOL) return basename(symbol.path)
    const parent = symbol.parentId === null ? undefined : symbols.get(symbol.parentId)
    return parent !== undefined && (parent.kind === 'class' || parent.kind === 'interface')
      ? `${parent.name}.${symbol.name}`
      : symbol.name
  }

  // Fichiers, bornés ; un fichier hors module va à la racine du projet.
  const truncatedFiles = input.files.length > MAP_LIMITS.files
  const files = input.files.slice(0, MAP_LIMITS.files)
  const moduleOfFile = new Map(files.map((file) => [file.path, file.moduleKey ?? ROOT_MODULE] as const))
  const modulesByKey = new Map(input.modules.map((module) => [module.key, module] as const))
  const moduleKeys = [...new Set([...input.modules.map((module) => module.key), ...moduleOfFile.values()])]

  // Appels de fichier à fichier, avec leurs phrases ; un lien sans cible retenue part vers chacune de ses cibles possibles.
  const calls = new Map<
    string,
    {
      from: string
      to: string
      count: number
      provenance: LinkProvenance
      sentences: MapCallSentence[]
      /** Au moins un appel qui donne le sens de lecture (colonnes, profondeurs). */
      ordering: boolean
    }
  >()
  let truncatedCalls = false
  for (const edge of input.edges) {
    const from = symbols.get(edge.fromSymbolId)
    if (from === undefined || !moduleOfFile.has(from.path)) continue
    const candidates = candidatesOf(edge.candidatesJson)
    const targets = edge.toSymbolId !== null ? [edge.toSymbolId] : candidates
    const provenance: LinkProvenance = edge.toSymbolId === null ? 'uncertain' : edge.provenance
    for (const targetId of targets) {
      const to = symbols.get(targetId)
      if (to === undefined || to.path === from.path || !moduleOfFile.has(to.path)) continue
      const key = `${from.path}\u0000${to.path}`
      let call = calls.get(key)
      if (call === undefined) {
        if (calls.size >= MAP_LIMITS.calls) {
          truncatedCalls = true
          continue
        }
        call = { from: from.path, to: to.path, count: 0, provenance, sentences: [], ordering: false }
        calls.set(key, call)
      }
      call.count += edge.count
      call.provenance = weakestProvenance(call.provenance, provenance)
      if (ORDERING_KINDS.has(edge.kind)) call.ordering = true
      if (call.sentences.length < MAP_LIMITS.sentencesPerCall) {
        call.sentences.push({
          from: label(from),
          to: label(to),
          kind: edge.kind,
          provenance,
          alternatives: provenance === 'uncertain' ? Math.max(candidates.length, targets.length) : 0
        })
      }
    }
  }

  // Colonnes des modules dans le sens des appels, profondeur des fichiers dans leur module.
  const ordering = [...calls.values()].filter((call) => call.ordering)
  const moduleLinks = ordering.map(
    (call) => [moduleOfFile.get(call.from) ?? '', moduleOfFile.get(call.to) ?? ''] as const
  )
  const columns = longestDepths(moduleKeys, moduleLinks, MAX_COLUMN)
  const external = new Set<string>()
  const internalLinks: (readonly [string, string])[] = []
  for (const call of calls.values()) {
    if (moduleOfFile.get(call.from) === moduleOfFile.get(call.to)) {
      if (call.ordering) internalLinks.push([call.from, call.to])
    } else {
      external.add(call.from)
      external.add(call.to)
    }
  }
  const depths = longestDepths(
    files.map((file) => file.path),
    internalLinks,
    MAX_DEPTH
  )

  const functions = fileFunctions(input.symbols)

  // Un module qui contient un point d'entrée « main » ou « cli » est le démarrage du projet.
  const starting = new Set<string>()
  for (const entry of input.entries) {
    const symbol = symbols.get(entry.symbolId)
    const moduleKey = symbol === undefined ? undefined : moduleOfFile.get(symbol.path)
    if (STARTING_ENTRIES.has(entry.kind) && moduleKey !== undefined) starting.add(moduleKey)
  }

  const filesOf = new Map<string, BoxFileInput[]>()
  for (const file of files) {
    const key = moduleOfFile.get(file.path) ?? ROOT_MODULE
    filesOf.set(key, [...(filesOf.get(key) ?? []), file])
  }
  const modules: MapModuleView[] = moduleKeys
    .filter((key) => (filesOf.get(key)?.length ?? 0) > 0)
    .map((key) => {
      const own = filesOf.get(key) ?? []
      const row = modulesByKey.get(key)
      const category = input.categoryOf(`m:${key}`)
      const layer: CodeLayer = starting.has(key) ? 'start' : LAYER_OF[category]
      // La racine du projet n'a pas de nom : « Démarrage », le nom de son seul fichier, ou « Racine du projet ».
      const title =
        row !== undefined && key !== ROOT_MODULE
          ? row.name
          : layer === 'start'
            ? 'Démarrage'
            : own.length === 1
              ? basename(own[0]?.path ?? '')
              : 'Racine du projet'
      return {
        key: `m:${key}`,
        title,
        layer,
        plumbing: category === 'plumbing',
        role: row?.summary ?? null,
        column: columns.get(key) ?? 0,
        files: own.length,
        lines: own.reduce((sum, file) => sum + file.lines, 0)
      }
    })

  const mapFiles: MapFileView[] = files.map((file) => {
    const moduleKey = moduleOfFile.get(file.path) ?? ROOT_MODULE
    const root = modulesByKey.get(moduleKey)?.rootPath ?? ''
    const inside = root === '' || !file.path.startsWith(`${root}/`) ? file.path : file.path.slice(root.length + 1)
    return {
      key: `f:${file.path}`,
      path: file.path,
      moduleKey: `m:${moduleKey}`,
      title: basename(file.path),
      folder: inside.includes('/') ? inside.slice(0, inside.lastIndexOf('/')) : '',
      lang: file.lang,
      lines: file.lines,
      role: file.summary ?? null,
      functions: functions.get(file.path) ?? [],
      depth: depths.get(file.path) ?? 0,
      external: external.has(file.path),
      plumbing: input.categoryOf(`f:${file.path}`) === 'plumbing'
    }
  })

  return {
    modules,
    files: mapFiles,
    calls: [...calls.values()].map((call) => ({
      from: `f:${call.from}`,
      to: `f:${call.to}`,
      count: call.count,
      provenance: call.provenance,
      sentences: call.sentences
    })),
    truncated: truncatedFiles || truncatedCalls
  }
}
