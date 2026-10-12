import { randomUUID } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'
import type { AppDatabase } from '../client'
import { folderEntries, folders } from '../schemaFolders'
import { writeChanges, type ChangeEntry } from './changeLog'

export interface FolderRow {
  readonly neuronId: string
  readonly offsetX: number
  readonly offsetY: number
  readonly moved: boolean
  readonly seenAt: string | null
}

export type FolderEntrySource = 'manual' | 'conversation' | 'covered'

export interface FolderEntryRow {
  readonly id: string
  readonly neuronId: string
  readonly path: string
  readonly pathKey: string
  readonly source: FolderEntrySource
  readonly hidden: boolean
  readonly addedBy: 'user' | 'claude'
  readonly createdAt: string
  readonly updatedAt: string
  readonly deletedAt: string | null
}

/** Dossiers des nœuds (spec 028) : place glissée, dernière ouverture, fichiers rangés (retrait logique). */
export class FolderRepository {
  constructor(private readonly db: AppDatabase) {}

  transaction<T>(work: () => T): T {
    return this.db.transaction(() => work())
  }

  log(batchId: string, entries: readonly ChangeEntry[], actor: 'user' | 'claude'): void {
    writeChanges(this.db, batchId, entries, actor)
  }

  places(): Map<string, FolderRow> {
    return new Map(
      this.db
        .select()
        .from(folders)
        .all()
        .map((row) => [row.neuronId, row] as const)
    )
  }

  get(neuronId: string): FolderRow | undefined {
    return this.db.select().from(folders).where(eq(folders.neuronId, neuronId)).get()
  }

  /** Place glissée par mentalyas : le dossier ne bouge plus à « Réorganiser ». */
  move(neuronId: string, x: number, y: number): void {
    this.db
      .insert(folders)
      .values({ neuronId, offsetX: x, offsetY: y, moved: true })
      .onConflictDoUpdate({ target: folders.neuronId, set: { offsetX: x, offsetY: y, moved: true } })
      .run()
  }

  markSeen(neuronId: string, at: string): void {
    this.db
      .insert(folders)
      .values({ neuronId, seenAt: at })
      .onConflictDoUpdate({ target: folders.neuronId, set: { seenAt: at } })
      .run()
  }

  /** Fichiers rangés vivants (non retirés), tous nœuds confondus. */
  liveEntries(): FolderEntryRow[] {
    return this.db.select().from(folderEntries).where(isNull(folderEntries.deletedAt)).all()
  }

  /** Ligne d'un fichier dans un dossier, retirée ou non. */
  entryOf(neuronId: string, pathKey: string): FolderEntryRow | undefined {
    return this.db
      .select()
      .from(folderEntries)
      .where(and(eq(folderEntries.neuronId, neuronId), eq(folderEntries.pathKey, pathKey)))
      .get()
  }

  entry(id: string): FolderEntryRow | undefined {
    return this.db.select().from(folderEntries).where(eq(folderEntries.id, id)).get()
  }

  insertEntry(entry: Omit<FolderEntryRow, 'id' | 'createdAt' | 'deletedAt'>): FolderEntryRow {
    const id = randomUUID()
    this.db
      .insert(folderEntries)
      .values({ ...entry, id })
      .run()
    return this.entry(id) as FolderEntryRow
  }

  updateEntry(
    id: string,
    patch: Partial<Pick<FolderEntryRow, 'source' | 'hidden' | 'addedBy' | 'updatedAt' | 'deletedAt'>>
  ): void {
    this.db.update(folderEntries).set(patch).where(eq(folderEntries.id, id)).run()
  }
}
