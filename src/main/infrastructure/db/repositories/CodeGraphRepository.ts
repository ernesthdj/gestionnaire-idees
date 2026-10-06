import { and, eq, inArray, notInArray } from 'drizzle-orm'
import type { AppDatabase } from '../client'
import { codeEdges, codeEntryPoints, codeFiles, codeModules, codeSymbols } from '../schemaReprise'

export type CodeModuleRow = typeof codeModules.$inferSelect
export type CodeFileRow = typeof codeFiles.$inferSelect
export type CodeSymbolRow = typeof codeSymbols.$inferSelect
export type CodeEdgeRow = typeof codeEdges.$inferSelect
export type CodeEntryPointRow = typeof codeEntryPoints.$inferSelect

/** Un fichier analysé et ce qu'il contient, écrit d'un bloc (ses anciens symboles sont remplacés). */
export interface AnalyzedFile {
  readonly file: CodeFileRow
  readonly symbols: readonly CodeSymbolRow[]
  readonly entries: readonly CodeEntryPointRow[]
}

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
  replaceEdges(genesisId: string, edges: readonly CodeEdgeRow[]): void {
    this.db.transaction((tx) => {
      tx.delete(codeEdges).where(eq(codeEdges.genesisId, genesisId)).run()
      for (const part of chunks(edges)) tx.insert(codeEdges).values(part).run()
    })
  }

  /** Mise à jour d'un lien (résolution par l'IA, correction de mentalyas). */
  updateEdge(genesisId: string, id: string, patch: Pick<CodeEdgeRow, 'toSymbolId' | 'provenance' | 'reason'>): boolean {
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
