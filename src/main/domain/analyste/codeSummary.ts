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
}

/** Candidats au code mort listés au plus. */
export const UNCALLED_LIMIT = 60
/** Fichiers de test : jamais appelés par l'app, jamais candidats. */
const TEST_FILE = /(^|\/)(tests?|__tests__)\/|\.(test|spec)\.[a-z]+$/

/**
 * Résumé du graphe pour le dossier : modules, points d'entrée, et fonctions sans appel entrant résolu (hors points
 * d'entrée et tests). Ce ne sont que des candidats : un appel dynamique n'est pas toujours résolu par l'analyse.
 */
export function summarizeCodeGraph(rows: CodeGraphRows): CodeSummary {
  const called = new Set(rows.edges.flatMap((edge) => (edge.toSymbolId === null ? [] : [edge.toSymbolId])))
  const entries = new Set(rows.entryPoints.map((entry) => entry.symbolId))
  // Un `new X()` est un appel vers la classe X, pas vers `X.constructor` : le constructeur d'une classe appelée l'est.
  const calledClasses = new Set(
    rows.symbols
      .filter((symbol) => symbol.kind === 'class' && called.has(symbol.id))
      .map((symbol) => `${symbol.path}#${symbol.qualifiedName}.constructor`)
  )
  const filesPerModule = new Map<string, number>()
  for (const file of rows.files) {
    if (file.moduleId !== null) filesPerModule.set(file.moduleId, (filesPerModule.get(file.moduleId) ?? 0) + 1)
  }
  const uncalled = rows.symbols
    .filter(
      (symbol) =>
        (symbol.kind === 'function' || symbol.kind === 'method') &&
        !called.has(symbol.id) &&
        !entries.has(symbol.id) &&
        !calledClasses.has(`${symbol.path}#${symbol.qualifiedName}`) &&
        !TEST_FILE.test(symbol.path)
    )
    .sort((a, b) => (a.path === b.path ? a.startLine - b.startLine : a.path < b.path ? -1 : 1))
    .slice(0, UNCALLED_LIMIT)
    .map((symbol) => ({ path: symbol.path, name: symbol.qualifiedName, line: symbol.startLine }))
  return {
    files: rows.files.length,
    modules: rows.modules.map((module) => ({
      key: module.key,
      rootPath: module.rootPath,
      files: filesPerModule.get(module.id) ?? 0
    })),
    entryPoints: rows.entryPoints.length,
    uncalled
  }
}
