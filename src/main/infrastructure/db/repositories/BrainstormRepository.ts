import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'
import type { AppDatabase } from '../client'
import { brainstorms } from '../schemaBrainstorms'
import { canvasBlocks, neurons } from '../schemaNeurons'

export type BrainstormRow = typeof brainstorms.$inferSelect
export type NewBrainstorm = Pick<
  typeof brainstorms.$inferInsert,
  'name' | 'slug' | 'description' | 'type' | 'location' | 'origin' | 'folderPath' | 'gitRole' | 'github'
>

/** Brainstorm sans dossier qui reçoit les idées hors projet (spec 024 R10, D14). */
export const LOOSE_SLUG = 'idees-en-vrac'

/** Brainstorms (spec 024) et rattachement des genesis et des blocs à leur canevas. */
export class BrainstormRepository {
  constructor(private readonly db: AppDatabase) {}

  transaction<T>(work: () => T): T {
    return this.db.transaction(() => work())
  }

  /** `id` : celui d'un vault déjà posé dans le projet (spec 024 US4), sinon un nouveau. */
  insert(input: NewBrainstorm, id: string = randomUUID()): BrainstormRow {
    this.db
      .insert(brainstorms)
      .values({ ...input, id })
      .run()
    const row = this.get(id)
    if (row === undefined) throw new Error('brainstorm introuvable après insertion')
    return row
  }

  get(id: string): BrainstormRow | undefined {
    return this.db.select().from(brainstorms).where(eq(brainstorms.id, id)).get()
  }

  bySlug(slug: string): BrainstormRow | undefined {
    return this.db.select().from(brainstorms).where(eq(brainstorms.slug, slug)).get()
  }

  byFolder(folder: string): BrainstormRow | undefined {
    return this.db.select().from(brainstorms).where(eq(brainstorms.folderPath, folder)).get()
  }

  /** Brainstorms non archivés, le dernier ouvert d'abord. */
  list(): BrainstormRow[] {
    return this.db
      .select()
      .from(brainstorms)
      .where(isNull(brainstorms.archivedAt))
      .orderBy(desc(sql`coalesce(${brainstorms.lastOpenedAt}, ${brainstorms.createdAt})`))
      .all()
  }

  touchOpened(id: string, at: string): void {
    this.db.update(brainstorms).set({ lastOpenedAt: at }).where(eq(brainstorms.id, id)).run()
  }

  setFolder(id: string, folderPath: string): void {
    this.db.update(brainstorms).set({ folderPath }).where(eq(brainstorms.id, id)).run()
  }

  setGitRole(id: string, gitRole: BrainstormRow['gitRole']): void {
    this.db.update(brainstorms).set({ gitRole }).where(eq(brainstorms.id, id)).run()
  }

  /** Retire un brainstorm tout juste créé (création qui échoue) ; jamais un brainstorm travaillé. */
  remove(id: string): void {
    this.db.delete(brainstorms).where(eq(brainstorms.id, id)).run()
  }

  saveViewState(id: string, json: string): void {
    this.db.update(brainstorms).set({ viewStateJson: json }).where(eq(brainstorms.id, id)).run()
  }

  /** « Idées en vrac » : créé à la première idée hors projet. */
  ensureLoose(): string {
    const existing = this.bySlug(LOOSE_SLUG)
    if (existing !== undefined) return existing.id
    return this.insert({
      name: 'Idées en vrac',
      slug: LOOSE_SLUG,
      description: 'Idées notées hors de tout projet.',
      type: null,
      location: 'local',
      origin: 'migrated',
      folderPath: null,
      gitRole: 'none',
      github: false
    }).id
  }

  /** Premier genesis du brainstorm (nœud de départ du projet) ; `null` s'il n'en a pas. */
  genesisOf(id: string): string | null {
    const row = this.db
      .select({ id: neurons.id })
      .from(neurons)
      .where(and(eq(neurons.brainstormId, id), eq(neurons.kind, 'root')))
      .orderBy(asc(sql`${neurons}.rowid`))
      .get()
    return row?.id ?? null
  }

  assignRoot(neuronId: string, brainstormId: string): void {
    this.db.update(neurons).set({ brainstormId }).where(eq(neurons.id, neuronId)).run()
  }

  /** Retire un genesis tout juste créé, sans enfant ni conversation (création de zéro qui échoue). */
  discardFreshRoot(neuronId: string): void {
    this.db
      .delete(neurons)
      .where(and(eq(neurons.id, neuronId), eq(neurons.kind, 'root'), eq(neurons.sessionStarted, false)))
      .run()
  }

  /** Genesis sans brainstorm (carte unique d'avant la spec 024, ou idée née sans canevas). */
  orphanRoots(): { readonly id: string; readonly projectDir: string | null; readonly title: string }[] {
    return this.db
      .select({ id: neurons.id, projectDir: neurons.projectDir, title: neurons.title })
      .from(neurons)
      .where(and(eq(neurons.kind, 'root'), isNull(neurons.brainstormId)))
      .orderBy(asc(sql`${neurons}.rowid`))
      .all()
  }

  countOrphanBlocks(): number {
    return (
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(canvasBlocks)
        .where(isNull(canvasBlocks.brainstormId))
        .get()?.count ?? 0
    )
  }

  /** Rattache les blocs sans brainstorm (supprimés compris, pour l'annulation) ; nombre de blocs touchés. */
  assignOrphanBlocks(brainstormId: string): number {
    return this.db.update(canvasBlocks).set({ brainstormId }).where(isNull(canvasBlocks.brainstormId)).run().changes
  }
}
