import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'
import type { AppDatabase } from '../client'
import { writeChanges, type ChangeEntry } from './changeLog'
import { documents, documentVersions } from '../schemaNeurons'

export type DocumentFolderKind = 'project' | 'profile'
export type DocumentAuthor = 'user' | 'claude' | 'externe'

export interface DocumentRow {
  readonly id: string
  readonly neuronId: string
  readonly genesisId: string
  readonly title: string
  readonly folder: DocumentFolderKind
  readonly fileName: string
  readonly width: number
  readonly height: number
  readonly origin: 'user' | 'claude'
  readonly currentVersionId: string | null
  readonly offsetX: number
  readonly offsetY: number
  readonly createdAt: string
  readonly deletedAt: string | null
}

export interface DocumentVersionRow {
  readonly id: string
  readonly documentId: string
  readonly content: string
  readonly hash: string
  readonly author: DocumentAuthor
  readonly createdAt: string
}

export type NewDocument = Omit<DocumentRow, 'currentVersionId' | 'offsetX' | 'offsetY' | 'createdAt' | 'deletedAt'>

/** Documents rattachés aux neurones (spec 012) et leurs versions. */
export class DocumentRepository {
  constructor(private readonly db: AppDatabase) {}

  transaction<T>(work: () => T): T {
    return this.db.transaction(() => work())
  }

  log(batchId: string, entries: readonly ChangeEntry[], actor: 'user' | 'claude'): void {
    writeChanges(this.db, batchId, entries, actor)
  }

  insert(document: NewDocument): void {
    this.db.insert(documents).values(document).run()
  }

  /** Document, retiré ou non. */
  get(id: string): DocumentRow | undefined {
    return this.db.select().from(documents).where(eq(documents.id, id)).get()
  }

  /** Documents sur la carte (non retirés), dans l'ordre de création. */
  list(): DocumentRow[] {
    return this.db
      .select()
      .from(documents)
      .where(isNull(documents.deletedAt))
      .orderBy(asc(sql`${documents}.rowid`))
      .all()
  }

  ofNeuron(neuronId: string): DocumentRow[] {
    return this.list().filter((row) => row.neuronId === neuronId)
  }

  setDeleted(id: string, deletedAt: string | null): void {
    this.db.update(documents).set({ deletedAt }).where(eq(documents.id, id)).run()
  }

  setOffset(id: string, x: number, y: number): void {
    this.db.update(documents).set({ offsetX: x, offsetY: y }).where(eq(documents.id, id)).run()
  }

  setSize(id: string, width: number, height: number): void {
    this.db.update(documents).set({ width, height }).where(eq(documents.id, id)).run()
  }

  setCurrentVersion(id: string, versionId: string): void {
    this.db.update(documents).set({ currentVersionId: versionId }).where(eq(documents.id, id)).run()
  }

  insertVersion(version: Omit<DocumentVersionRow, 'createdAt'>): void {
    this.db.insert(documentVersions).values(version).run()
  }

  version(id: string): DocumentVersionRow | undefined {
    return this.db.select().from(documentVersions).where(eq(documentVersions.id, id)).get()
  }

  /** Dernière version enregistrée (secours quand le fichier a disparu). */
  latestVersion(documentId: string): DocumentVersionRow | undefined {
    return this.db
      .select()
      .from(documentVersions)
      .where(and(eq(documentVersions.documentId, documentId)))
      .orderBy(desc(sql`${documentVersions}.rowid`))
      .get()
  }
}
