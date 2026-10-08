import type { CodeSummary } from './dossier'

/** Lignes du graphe de code de la spec 017 utiles à l'Analyste (aucun code source). */
export interface CodeGraphRows {
  readonly modules: readonly { readonly id: string; readonly key: string; readonly rootPath: string }[]
  readonly files: readonly { readonly moduleId: string | null; readonly path: string }[]
  readonly symbols: readonly {
    readonly id: string
    readonly kind: string
    readonly name: string
    readonly qualifiedName: string
    readonly startLine: number
    readonly path: string
  }[]
  readonly edges: readonly { readonly toSymbolId: string | null }[]
  readonly entryPoints: readonly { readonly symbolId: string }[]
  /** Fin de la dernière analyse réussie (ISO), `null` si inconnue. */
  readonly analyzedAt: string | null
}

/** Candidats au code mort listés au plus. */
export const UNCALLED_LIMIT = 60
/** Fichiers de test : jamais appelés par l'app, jamais candidats. */
const TEST_FILE = /(^|\/)(tests?|__tests__)\/|\.(test|spec)\.[a-z]+$/
/**
 * Copies de travail (worktrees d'outils) et jeux d'essai : pas le code du dépôt. L'analyse les écarte déjà
 * (`ProjectScanner`, `modules.ts`) ; on les retire aussi ici, par sécurité, d'un graphe ancien.
 */
const FOREIGN_PATH = /(^|\/)(\.kilo|\.claude\/worktrees|\.analyste\/worktrees|__fixtures__|fixtures?)(\/|$)/

type GraphSymbol = CodeGraphRows['symbols'][number]

const byPathThenLine = (a: GraphSymbol, b: GraphSymbol): number =>
  a.path === b.path ? a.startLine - b.startLine : a.path < b.path ? -1 : 1

/**
 * Résumé du graphe pour le dossier : modules, points d'entrée, et fonctions sans appel entrant résolu (hors points
 * d'entrée et tests). Ce ne sont que des candidats : un appel dynamique n'est pas toujours résolu par l'analyse.
 * Les places sont réparties entre les modules (tour à tour), pour qu'aucun dossier n'occupe toute la liste.
 */
export function summarizeCodeGraph(rows: CodeGraphRows): CodeSummary {
  const files = rows.files.filter((file) => !FOREIGN_PATH.test(file.path))
  const called = new Set(rows.edges.flatMap((edge) => (edge.toSymbolId === null ? [] : [edge.toSymbolId])))
  const pathOf = new Map(rows.symbols.map((symbol) => [symbol.id, symbol.path] as const))
  const entryPoints = rows.entryPoints.filter((entry) => !FOREIGN_PATH.test(pathOf.get(entry.symbolId) ?? ''))
  const entries = new Set(rows.entryPoints.map((entry) => entry.symbolId))
  // Un `new X()` est un appel vers la classe X, pas vers `X.constructor` : le constructeur d'une classe appelée l'est.
  const calledClasses = new Set(
    rows.symbols
      .filter((symbol) => symbol.kind === 'class' && called.has(symbol.id))
      .map((symbol) => `${symbol.path}#${symbol.qualifiedName}.constructor`)
  )
  const filesPerModule = new Map<string, number>()
  const moduleOf = new Map<string, string | null>()
  for (const file of files) {
    moduleOf.set(file.path, file.moduleId)
    if (file.moduleId !== null) filesPerModule.set(file.moduleId, (filesPerModule.get(file.moduleId) ?? 0) + 1)
  }
  // Rang de chaque candidat dans son module : le tri stable par rang alterne les modules.
  const rankInModule = new Map<string | null, number>()
  const uncalled = rows.symbols
    .filter(
      (symbol) =>
        (symbol.kind === 'function' || symbol.kind === 'method') &&
        !called.has(symbol.id) &&
        !entries.has(symbol.id) &&
        !calledClasses.has(`${symbol.path}#${symbol.qualifiedName}`) &&
        !TEST_FILE.test(symbol.path) &&
        !FOREIGN_PATH.test(symbol.path)
    )
    .sort(byPathThenLine)
    .map((symbol) => {
      const module = moduleOf.get(symbol.path) ?? null
      const rank = rankInModule.get(module) ?? 0
      rankInModule.set(module, rank + 1)
      return { symbol, rank }
    })
    .sort((a, b) => a.rank - b.rank)
    .slice(0, UNCALLED_LIMIT)
    .map(({ symbol }) => symbol)
    .sort(byPathThenLine)
    .map((symbol) => ({ path: symbol.path, name: symbol.qualifiedName, line: symbol.startLine }))
  return {
    files: files.length,
    modules: rows.modules
      .filter((module) => !FOREIGN_PATH.test(module.rootPath))
      .map((module) => ({
        key: module.key,
        rootPath: module.rootPath,
        files: filesPerModule.get(module.id) ?? 0
      })),
    entryPoints: entryPoints.length,
    analyzedAt: rows.analyzedAt,
    uncalled
  }
}
