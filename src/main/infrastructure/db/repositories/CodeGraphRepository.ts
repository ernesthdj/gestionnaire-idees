import { and, count, eq, inArray, isNotNull, notInArray } from 'drizzle-orm'
import type { AppDatabase } from '../client'
import { codeEdges, codeEntryPoints, codeFiles, codeModules, codeSymbols } from '../schemaReprise'

export type CodeModuleRow = typeof codeModules.$inferSelect
export type CodeFileRow = typeof codeFiles.$inferSelect
export type CodeSymbolRow = typeof codeSymbols.$inferSelect
export type CodeEdgeRow = typeof codeEdges.$inferSelect
export type CodeEntryPointRow = typeof codeEntryPoints.$inferSelect
/** Lien à écrire : les cibles possibles (`candidatesJson`) ne sont données que pour un lien incertain. */
export type CodeEdgeInput = Omit<CodeEdgeRow, 'candidatesJson'> & { readonly candidatesJson?: string | null }

/** Un fichier analysé et ce qu'il contient, écrit d'un bloc (ses anciens symboles sont remplacés). */
export interface AnalyzedFile {
  /** Sans le rôle écrit avec le guide : l'analyse ne le produit pas. */
  readonly file: Omit<CodeFileRow, 'summary'> & { readonly summary?: string | null }
  readonly symbols: readonly CodeSymbolRow[]
  readonly entries: readonly CodeEntryPointRow[]
}

/** Empreinte d'une ligne, indépendante de l'ordre de ses colonnes (`null` et absent confondus). */
function fingerprint(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(fingerprint).join(',')}]`
  if (typeof value === 'object' && value !== null) {
    return `{${Object.keys(value)
      .sort()
      .filter((key) => (value as Record<string, unknown>)[key] != null)
      .map((key) => `${JSON.stringify(key)}:${fingerprint((value as Record<string, unknown>)[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

// Le rôle d'un fichier (écrit avec le guide) n'entre pas dans l'empreinte : sinon une réanalyse croirait tout modifié
// et l'effacerait.
const fileFingerprint = (entry: AnalyzedFile): string =>
  fingerprint([
    { ...entry.file, summary: null },
    [...entry.symbols].sort((a, b) => a.id.localeCompare(b.id)),
    [...entry.entries].sort((a, b) => a.symbolId.localeCompare(b.symbolId))
  ])

/** Lignes insérées par requête : sous la limite de variables de SQLite, quel que soit le nombre de colonnes. */
const CHUNK = 200

function chunks<T>(rows: readonly T[]): T[][] {
  const result: T[][] = []
  for (let start = 0; start < rows.length; start += CHUNK) result.push(rows.slice(start, start + CHUNK))
  return result
}

/**
 * Graphe du code d'un projet repris (spec 017 data-model) : modules, fichiers, symboles, liens et points d'entrée.
 * Écriture par lots en transaction ; une réanalyse ne réécrit que les fichiers modifiés, les liens sont recalculés
 * pour tout le projet.
 */
export class CodeGraphRepository {
  constructor(private readonly db: AppDatabase) {}

  modules(genesisId: string): CodeModuleRow[] {
    return this.db.select().from(codeModules).where(eq(codeModules.genesisId, genesisId)).all()
  }

  /** Modules du projet par clé : résumé et analogie gardés pour une clé qui reste, les modules disparus retirés. */
  replaceModules(genesisId: string, rows: readonly Omit<CodeModuleRow, 'summary' | 'analogy'>[]): void {
    this.db.transaction((tx) => {
      const keys = rows.map((row) => row.key)
      tx.delete(codeModules)
        .where(
          and(eq(codeModules.genesisId, genesisId), keys.length === 0 ? undefined : notInArray(codeModules.key, keys))
        )
        .run()
      for (const row of rows) {
        tx.insert(codeModules)
          .values(row)
          .onConflictDoUpdate({
            target: [codeModules.genesisId, codeModules.key],
            set: { name: row.name, rootPath: row.rootPath, kind: row.kind }
          })
          .run()
      }
    })
  }

  setModuleSummaries(
    genesisId: string,
    summaries: readonly { readonly key: string; readonly summary: string; readonly analogy: string }[]
  ): void {
    this.db.transaction((tx) => {
      for (const entry of summaries) {
        tx.update(codeModules)
          .set({ summary: entry.summary, analogy: entry.analogy })
          .where(and(eq(codeModules.genesisId, genesisId), eq(codeModules.key, entry.key)))
          .run()
      }
    })
  }

  /** Rôles des fichiers (spec 031 D12a), écrits avec le guide de reprise ; un chemin inconnu est ignoré. */
  setFileSummaries(genesisId: string, summaries: readonly { readonly path: string; readonly summary: string }[]): void {
    this.db.transaction((tx) => {
      for (const entry of summaries) {
        tx.update(codeFiles)
          .set({ summary: entry.summary })
          .where(and(eq(codeFiles.genesisId, genesisId), eq(codeFiles.path, entry.path)))
          .run()
      }
    })
  }

  files(genesisId: string): CodeFileRow[] {
    return this.db.select().from(codeFiles).where(eq(codeFiles.genesisId, genesisId)).all()
  }

  /** Fichiers analysés, écrits d'un bloc : chaque fichier remplace ses anciens symboles et points d'entrée. */
  writeFiles(genesisId: string, analyzed: readonly AnalyzedFile[]): void {
    this.db.transaction((tx) => {
      const paths = analyzed.map((entry) => entry.file.path)
      if (paths.length > 0) this.removeWithin(tx, genesisId, paths)
      for (const part of chunks(analyzed.map((entry) => entry.file))) tx.insert(codeFiles).values(part).run()
      for (const part of chunks(analyzed.flatMap((entry) => entry.symbols))) tx.insert(codeSymbols).values(part).run()
      for (const part of chunks(analyzed.flatMap((entry) => entry.entries)))
        tx.insert(codeEntryPoints).values(part).run()
    })
  }

  /**
   * Fichiers dont l'analyse diffère de ce qui est en base (nouveaux compris) : une réanalyse ne réécrit qu'eux
   * (spec 017 SC-004 : un fichier modifié sur 5 000 → quelques lignes écrites, pas tout le graphe).
   */
  changedFiles(genesisId: string, analyzed: readonly AnalyzedFile[]): AnalyzedFile[] {
    const stored = new Map<string, { file: CodeFileRow; symbols: CodeSymbolRow[]; entries: CodeEntryPointRow[] }>()
    for (const file of this.files(genesisId)) stored.set(file.id, { file, symbols: [], entries: [] })
    const symbols = this.db
      .select({ symbol: codeSymbols })
      .from(codeSymbols)
      .innerJoin(codeFiles, eq(codeFiles.id, codeSymbols.fileId))
      .where(eq(codeFiles.genesisId, genesisId))
      .all()
    const fileOfSymbol = new Map<string, string>()
    for (const { symbol } of symbols) {
      stored.get(symbol.fileId)?.symbols.push(symbol)
      fileOfSymbol.set(symbol.id, symbol.fileId)
    }
    for (const entry of this.entryPoints(genesisId)) {
      stored.get(fileOfSymbol.get(entry.symbolId) ?? '')?.entries.push(entry)
    }
    return analyzed.filter((entry) => {
      const before = stored.get(entry.file.id)
      return before === undefined || fileFingerprint(before) !== fileFingerprint(entry)
    })
  }

  /** Liens à retirer et à écrire pour passer de ce qui est en base à `edges` (comparés ligne à ligne). */
  edgeChanges(
    genesisId: string,
    edges: readonly CodeEdgeInput[]
  ): { readonly remove: string[]; readonly write: CodeEdgeInput[] } {
    const stored = new Map(this.edges(genesisId).map((edge) => [edge.id, fingerprint(edge)] as const))
    const next = new Set(edges.map((edge) => edge.id))
    return {
      remove: [...stored.keys()].filter((id) => !next.has(id)),
      write: edges.filter((edge) => stored.get(edge.id) !== fingerprint({ candidatesJson: null, ...edge }))
    }
  }

  /** Applique une partie des changements de liens, en une transaction. */
  applyEdgeChanges(genesisId: string, remove: readonly string[], write: readonly CodeEdgeInput[]): void {
    this.db.transaction((tx) => {
      for (const ids of chunks([...remove, ...write.map((edge) => edge.id)])) {
        tx.delete(codeEdges)
          .where(and(eq(codeEdges.genesisId, genesisId), inArray(codeEdges.id, ids)))
          .run()
      }
      for (const part of chunks(write)) tx.insert(codeEdges).values(part).run()
    })
  }

  /** Fichiers disparus du projet (ou devenus ignorés) : retirés avec leurs symboles. */
  removeFiles(genesisId: string, paths: readonly string[]): void {
    if (paths.length === 0) return
    this.db.transaction((tx) => this.removeWithin(tx, genesisId, paths))
  }

  symbols(genesisId: string): (CodeSymbolRow & { readonly path: string })[] {
    return this.db
      .select({ symbol: codeSymbols, path: codeFiles.path })
      .from(codeSymbols)
      .innerJoin(codeFiles, eq(codeFiles.id, codeSymbols.fileId))
      .where(eq(codeFiles.genesisId, genesisId))
      .all()
      .map((row) => ({ ...row.symbol, path: row.path }))
  }

  /** Un symbole du projet et le chemin de son fichier ; `undefined` s'il n'appartient pas à ce projet. */
  symbol(genesisId: string, id: string): (CodeSymbolRow & { readonly path: string }) | undefined {
    const row = this.db
      .select({ symbol: codeSymbols, path: codeFiles.path })
      .from(codeSymbols)
      .innerJoin(codeFiles, eq(codeFiles.id, codeSymbols.fileId))
      .where(and(eq(codeFiles.genesisId, genesisId), eq(codeSymbols.id, id)))
      .get()
    return row === undefined ? undefined : { ...row.symbol, path: row.path }
  }

  edge(genesisId: string, id: string): CodeEdgeRow | undefined {
    return this.db
      .select()
      .from(codeEdges)
      .where(and(eq(codeEdges.genesisId, genesisId), eq(codeEdges.id, id)))
      .get()
  }

  entryPoints(genesisId: string): CodeEntryPointRow[] {
    return this.db
      .select({ entry: codeEntryPoints })
      .from(codeEntryPoints)
      .innerJoin(codeSymbols, eq(codeSymbols.id, codeEntryPoints.symbolId))
      .innerJoin(codeFiles, eq(codeFiles.id, codeSymbols.fileId))
      .where(eq(codeFiles.genesisId, genesisId))
      .all()
      .map((row) => row.entry)
  }

  edges(genesisId: string): CodeEdgeRow[] {
    return this.db.select().from(codeEdges).where(eq(codeEdges.genesisId, genesisId)).all()
  }

  /** Liens recalculés pour tout le projet après une analyse (résolution rapide, en mémoire). */
  replaceEdges(genesisId: string, edges: readonly CodeEdgeInput[]): void {
    const { remove, write } = this.edgeChanges(genesisId, edges)
    this.applyEdgeChanges(genesisId, remove, write)
  }

  /** Liens incertains qui ont des cibles possibles : ce que « Préciser les liens » peut encore lever (US6). */
  resolvableEdges(genesisId: string): number {
    return (
      this.db
        .select({ total: count() })
        .from(codeEdges)
        .where(
          and(
            eq(codeEdges.genesisId, genesisId),
            eq(codeEdges.provenance, 'uncertain'),
            isNotNull(codeEdges.candidatesJson)
          )
        )
        .get()?.total ?? 0
    )
  }

  /**
   * Mise à jour d'un lien (résolution par l'IA, correction de mentalyas). `candidatesJson: null` retire les cibles
   * possibles : le lien n'est plus proposé à l'IA avant la prochaine analyse.
   */
  updateEdge(
    genesisId: string,
    id: string,
    patch: Pick<CodeEdgeRow, 'toSymbolId' | 'provenance' | 'reason'> & { readonly candidatesJson?: string | null }
  ): boolean {
    return (
      this.db
        .update(codeEdges)
        .set(patch)
        .where(and(eq(codeEdges.genesisId, genesisId), eq(codeEdges.id, id)))
        .run().changes > 0
    )
  }

  updateCategory(
    symbolId: string,
    patch: Pick<CodeSymbolRow, 'category' | 'categorySource' | 'categoryReason'>
  ): boolean {
    return this.db.update(codeSymbols).set(patch).where(eq(codeSymbols.id, symbolId)).run().changes > 0
  }

  private removeWithin(
    tx: Parameters<Parameters<AppDatabase['transaction']>[0]>[0],
    genesisId: string,
    paths: readonly string[]
  ): void {
    for (const part of chunks(paths)) {
      const fileIds = tx
        .select({ id: codeFiles.id })
        .from(codeFiles)
        .where(and(eq(codeFiles.genesisId, genesisId), inArray(codeFiles.path, part)))
        .all()
        .map((row) => row.id)
      if (fileIds.length === 0) continue
      const symbolIds = tx
        .select({ id: codeSymbols.id })
        .from(codeSymbols)
        .where(inArray(codeSymbols.fileId, fileIds))
        .all()
        .map((row) => row.id)
      for (const ids of chunks(symbolIds))
        tx.delete(codeEntryPoints).where(inArray(codeEntryPoints.symbolId, ids)).run()
      tx.delete(codeSymbols).where(inArray(codeSymbols.fileId, fileIds)).run()
      tx.delete(codeFiles).where(inArray(codeFiles.id, fileIds)).run()
    }
  }
}
