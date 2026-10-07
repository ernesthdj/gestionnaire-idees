import { and, eq, inArray } from 'drizzle-orm'
import type { AppDatabase } from '../client'
import {
  codeEdges,
  codeEntryPoints,
  codeExplorerState,
  codeFiles,
  codeLayout,
  codeModules,
  codeOverrides,
  codeProjects,
  codeRuns,
  codeSymbols
} from '../schemaReprise'

export type CodeProjectRow = typeof codeProjects.$inferSelect
export type Confidentiality = CodeProjectRow['confidentiality']
export type AnalysisState = CodeProjectRow['analysisState']
export type CodeRunRow = typeof codeRuns.$inferSelect
export type CodeRunKind = CodeRunRow['kind']
export type CodeRunState = CodeRunRow['state']
export type ExplorerStateRow = typeof codeExplorerState.$inferSelect

/**
 * Projets repris (spec 017) : le projet et sa confidentialité, les passes (analyse, résolution, guide), les
 * corrections de mentalyas et l'état de l'explorateur. Aucune donnée du code ici, hors chemins relatifs.
 */
export class RepriseRepository {
  constructor(private readonly db: AppDatabase) {}

  transaction<T>(work: () => T): T {
    return this.db.transaction(() => work())
  }

  createProject(row: Omit<CodeProjectRow, 'createdAt' | 'analysisState' | 'analyzedAt' | 'guideDocumentId'>): void {
    this.db.insert(codeProjects).values(row).run()
  }

  /**
   * Efface un projet repris et tout son graphe (spec 017 D9) : seulement quand son genesis a été supprimé et que le
   * même dossier est importé de nouveau. Le dossier du projet n'est jamais touché.
   */
  deleteProject(genesisId: string): void {
    this.db.transaction((tx) => {
      const fileIds = tx
        .select({ id: codeFiles.id })
        .from(codeFiles)
        .where(eq(codeFiles.genesisId, genesisId))
        .all()
        .map((row) => row.id)
      for (let start = 0; start < fileIds.length; start += 200) {
        const part = fileIds.slice(start, start + 200)
        const symbolIds = tx
          .select({ id: codeSymbols.id })
          .from(codeSymbols)
          .where(inArray(codeSymbols.fileId, part))
          .all()
          .map((row) => row.id)
        for (let at = 0; at < symbolIds.length; at += 200) {
          tx.delete(codeEntryPoints)
            .where(inArray(codeEntryPoints.symbolId, symbolIds.slice(at, at + 200)))
            .run()
        }
        tx.delete(codeSymbols).where(inArray(codeSymbols.fileId, part)).run()
      }
      for (const table of [codeEdges, codeFiles, codeModules, codeOverrides, codeRuns, codeLayout, codeExplorerState]) {
        tx.delete(table).where(eq(table.genesisId, genesisId)).run()
      }
      tx.delete(codeProjects).where(eq(codeProjects.genesisId, genesisId)).run()
    })
  }

  project(genesisId: string): CodeProjectRow | undefined {
    return this.db.select().from(codeProjects).where(eq(codeProjects.genesisId, genesisId)).get()
  }

  projectByRoot(rootDir: string): CodeProjectRow | undefined {
    return this.db.select().from(codeProjects).where(eq(codeProjects.rootDir, rootDir)).get()
  }

  setConfidentiality(genesisId: string, confidentiality: Confidentiality, at: string): void {
    this.db
      .update(codeProjects)
      .set({ confidentiality, confidentialityChangedAt: at })
      .where(eq(codeProjects.genesisId, genesisId))
      .run()
  }

  setAnalysisState(genesisId: string, analysisState: AnalysisState, analyzedAt?: string): void {
    this.db
      .update(codeProjects)
      .set({ analysisState, ...(analyzedAt === undefined ? {} : { analyzedAt }) })
      .where(eq(codeProjects.genesisId, genesisId))
      .run()
  }

  setGuideDocument(genesisId: string, documentId: string): void {
    this.db.update(codeProjects).set({ guideDocumentId: documentId }).where(eq(codeProjects.genesisId, genesisId)).run()
  }

  /** Au démarrage : une analyse restée en cours a été interrompue par la fermeture de l'app. */
  interruptRunning(at: string): number {
    this.db.update(codeRuns).set({ state: 'interrupted', endedAt: at }).where(eq(codeRuns.state, 'running')).run()
    return this.db
      .update(codeProjects)
      .set({ analysisState: 'interrupted' })
      .where(eq(codeProjects.analysisState, 'running'))
      .run().changes
  }

  startRun(run: {
    readonly id: string
    readonly genesisId: string
    readonly kind: CodeRunKind
    readonly at: string
  }): void {
    this.db
      .insert(codeRuns)
      .values({ id: run.id, genesisId: run.genesisId, kind: run.kind, startedAt: run.at, state: 'running' })
      .run()
  }

  /** Fin d'une passe : son état et des nombres seulement (jamais de code ni de chemin complet). */
  endRun(
    id: string,
    state: Exclude<CodeRunState, 'running'>,
    at: string,
    stats?: Readonly<Record<string, number>>
  ): void {
    this.db
      .update(codeRuns)
      .set({ state, endedAt: at, statsJson: stats === undefined ? null : JSON.stringify(stats) })
      .where(eq(codeRuns.id, id))
      .run()
  }

  runs(genesisId: string): CodeRunRow[] {
    return this.db.select().from(codeRuns).where(eq(codeRuns.genesisId, genesisId)).all()
  }

  /** Corrections de mentalyas, par cible (`category:<chemin>#<nom>`, `edge:<chemin>#<nom>→<appel>`). */
  overrides(genesisId: string): ReadonlyMap<string, string | null> {
    return new Map(
      this.db
        .select({ target: codeOverrides.target, value: codeOverrides.value })
        .from(codeOverrides)
        .where(eq(codeOverrides.genesisId, genesisId))
        .all()
        .map((row) => [row.target, row.value] as const)
    )
  }

  setOverride(genesisId: string, target: string, value: string | null): void {
    this.db
      .insert(codeOverrides)
      .values({ genesisId, target, value })
      .onConflictDoUpdate({ target: [codeOverrides.genesisId, codeOverrides.target], set: { value } })
      .run()
  }

  explorerState(genesisId: string): ExplorerStateRow | undefined {
    return this.db.select().from(codeExplorerState).where(eq(codeExplorerState.genesisId, genesisId)).get()
  }

  saveExplorerState(row: ExplorerStateRow): void {
    this.db
      .insert(codeExplorerState)
      .values(row)
      .onConflictDoUpdate({
        target: codeExplorerState.genesisId,
        set: { filtersJson: row.filtersJson, lastLevel: row.lastLevel, lastParentKey: row.lastParentKey }
      })
      .run()
  }

  /** Positions déplacées par mentalyas dans un niveau de l'explorateur. */
  positions(genesisId: string, level: number, parentKey: string): ReadonlyMap<string, { x: number; y: number }> {
    return new Map(
      this.db
        .select()
        .from(codeLayout)
        .where(
          and(eq(codeLayout.genesisId, genesisId), eq(codeLayout.level, level), eq(codeLayout.parentKey, parentKey))
        )
        .all()
        .map((row) => [row.nodeKey, { x: row.x, y: row.y }] as const)
    )
  }

  savePosition(row: typeof codeLayout.$inferInsert): void {
    this.db
      .insert(codeLayout)
      .values(row)
      .onConflictDoUpdate({
        target: [codeLayout.genesisId, codeLayout.level, codeLayout.parentKey, codeLayout.nodeKey],
        set: { x: row.x, y: row.y }
      })
      .run()
  }
}
