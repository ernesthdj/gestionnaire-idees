import { randomUUID } from 'node:crypto'
import { and, desc, eq, isNull, ne, or, sql } from 'drizzle-orm'
import type { AppDatabase } from '../client'
import { contextImports, contextVersions, examples } from '../schema'

export type ImportStatus = 'pending' | 'applied' | 'rejected' | 'invalid'

export interface VersionRow {
  readonly id: string
  readonly version: number
  readonly profileMd: string
  readonly rulesMd: string
  readonly source: 'seed' | 'import'
  readonly isActive: boolean
  readonly appliedAt: string
}

export interface ImportRow {
  readonly id: string
  readonly detectedAt: string
  readonly status: ImportStatus
  readonly payloadJson: string | null
  readonly error: string | null
}

export interface ExampleRow {
  readonly polarity: 'positive' | 'negative'
  readonly taskKind: string
  readonly contentJson: string
}

/** Versions de contexte, imports et exemples (tables `context_*` et `examples`). */
export class ContextRepository {
  constructor(private readonly db: AppDatabase) {}

  transaction<T>(work: () => T): T {
    return this.db.transaction(() => work())
  }

  activeVersion(): VersionRow | undefined {
    return this.db.select().from(contextVersions).where(eq(contextVersions.isActive, true)).get() as
      VersionRow | undefined
  }

  versions(): VersionRow[] {
    return this.db.select().from(contextVersions).orderBy(desc(contextVersions.version)).all() as VersionRow[]
  }

  version(id: string): VersionRow | undefined {
    return this.db.select().from(contextVersions).where(eq(contextVersions.id, id)).get() as VersionRow | undefined
  }

  nextVersionNumber(): number {
    const row = this.db
      .select({ max: sql<number | null>`max(${contextVersions.version})` })
      .from(contextVersions)
      .get()
    return (row?.max ?? 0) + 1
  }

  createVersion(input: Omit<VersionRow, 'id' | 'isActive'> & { importId: string | null }): string {
    const id = randomUUID()
    this.db
      .insert(contextVersions)
      .values({
        id,
        version: input.version,
        profileMd: input.profileMd,
        rulesMd: input.rulesMd,
        source: input.source,
        importId: input.importId,
        isActive: false,
        appliedAt: input.appliedAt
      })
      .run()
    return id
  }

  /** Une seule version active (index unique partiel) : désactive d'abord, puis active la cible. */
  setActive(id: string): void {
    this.db.update(contextVersions).set({ isActive: false }).where(eq(contextVersions.isActive, true)).run()
    this.db.update(contextVersions).set({ isActive: true }).where(eq(contextVersions.id, id)).run()
  }

  insertImport(input: {
    status: ImportStatus
    detectedAt: string
    manifestJson: string
    payloadJson: string | null
    error: string | null
  }): string {
    const id = randomUUID()
    this.db
      .insert(contextImports)
      .values({
        id,
        detectedAt: input.detectedAt,
        manifestJson: input.manifestJson,
        diffJson: input.payloadJson,
        status: input.status,
        error: input.error
      })
      .run()
    return id
  }

  imports(): ImportRow[] {
    return this.db
      .select({
        id: contextImports.id,
        detectedAt: contextImports.detectedAt,
        status: contextImports.status,
        payloadJson: contextImports.diffJson,
        error: contextImports.error
      })
      .from(contextImports)
      .orderBy(sql`rowid desc`)
      .all()
  }

  importById(id: string): ImportRow | undefined {
    return this.imports().find((row) => row.id === id)
  }

  setImportStatus(id: string, status: ImportStatus): void {
    this.db.update(contextImports).set({ status }).where(eq(contextImports.id, id)).run()
  }

  insertExample(input: {
    polarity: 'positive' | 'negative'
    taskKind: string
    contentJson: string
    source: 'accepted_proposal' | 'rejected_proposal' | 'import'
    contextVersionId: string | null
  }): void {
    this.db
      .insert(examples)
      .values({ id: randomUUID(), ...input })
      .run()
  }

  /** Exemples importés rattachés à une version (pour les reporter sur la version suivante). */
  importedExamples(versionId: string): ExampleRow[] {
    return this.db
      .select({ polarity: examples.polarity, taskKind: examples.taskKind, contentJson: examples.contentJson })
      .from(examples)
      .where(and(eq(examples.source, 'import'), eq(examples.contextVersionId, versionId)))
      .orderBy(sql`rowid`)
      .all()
  }

  learnedCount(taskKind: string): number {
    const row = this.db
      .select({ count: sql<number>`count(*)` })
      .from(examples)
      .where(and(eq(examples.taskKind, taskKind), ne(examples.source, 'import')))
      .get()
    return row?.count ?? 0
  }

  /** Supprime les exemples appris les plus anciens au-delà de `keep` (les exemples importés ne sont pas concernés). */
  trimLearned(taskKind: string, keep: number): void {
    this.db.run(sql`
      DELETE FROM examples WHERE rowid IN (
        SELECT rowid FROM examples WHERE task_kind = ${taskKind} AND source <> 'import'
        ORDER BY rowid DESC LIMIT -1 OFFSET ${keep}
      )`)
  }

  /** Exemples actifs d'un type : appris + importés de la version active, du plus récent au plus ancien. */
  activeExamples(taskKind: string, activeVersionId: string | null, limit: number): ExampleRow[] {
    const imported =
      activeVersionId === null
        ? sql`0`
        : and(eq(examples.source, 'import'), eq(examples.contextVersionId, activeVersionId))
    return this.db
      .select({ polarity: examples.polarity, taskKind: examples.taskKind, contentJson: examples.contentJson })
      .from(examples)
      .where(
        and(
          eq(examples.taskKind, taskKind),
          or(and(ne(examples.source, 'import'), isNull(examples.contextVersionId)), imported)
        )
      )
      .orderBy(sql`rowid desc`)
      .limit(limit)
      .all()
  }
}
