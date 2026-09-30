import { randomUUID } from 'node:crypto'
import { and, asc, eq, isNull, max, sql } from 'drizzle-orm'
import type { AppDatabase } from '../client'
import { canvasBlocks, widgetMessages, widgetVersions } from '../schemaNeurons'

export interface WidgetVersionRow {
  readonly id: string
  readonly blockId: string
  readonly number: number
  readonly title: string
  readonly html: string
  readonly css: string
  readonly ts: string
  readonly js: string
  readonly summary: string
  readonly model: string
  readonly createdAt: string
}

export interface WidgetMessageRow {
  readonly id: string
  readonly role: 'user' | 'assistant'
  readonly text: string
  readonly versionId: string | null
  readonly failed: boolean
  readonly createdAt: string
}

/** Versions et conversation des widgets (spec 004) ; le bloc lui-même est dans `BlockRepository`. */
export class WidgetRepository {
  constructor(private readonly db: AppDatabase) {}

  transaction<T>(work: () => T): T {
    return this.db.transaction(() => work())
  }

  /** Widget visible (non supprimé) : sa version affichée. */
  widget(blockId: string): { readonly versionId: string | null } | undefined {
    const row = this.db
      .select({ versionId: canvasBlocks.currentVersionId })
      .from(canvasBlocks)
      .where(and(eq(canvasBlocks.id, blockId), eq(canvasBlocks.kind, 'widget'), isNull(canvasBlocks.deletedAt)))
      .get()
    return row
  }

  version(blockId: string, versionId: string): WidgetVersionRow | undefined {
    return this.db
      .select()
      .from(widgetVersions)
      .where(and(eq(widgetVersions.id, versionId), eq(widgetVersions.blockId, blockId)))
      .get()
  }

  versions(blockId: string): WidgetVersionRow[] {
    return this.db
      .select()
      .from(widgetVersions)
      .where(eq(widgetVersions.blockId, blockId))
      .orderBy(asc(widgetVersions.number))
      .all()
  }

  insertVersion(version: Omit<WidgetVersionRow, 'id' | 'number' | 'createdAt'>): WidgetVersionRow {
    const last = this.db
      .select({ number: max(widgetVersions.number) })
      .from(widgetVersions)
      .where(eq(widgetVersions.blockId, version.blockId))
      .get()
    const id = randomUUID()
    this.db
      .insert(widgetVersions)
      .values({ ...version, id, number: (last?.number ?? 0) + 1 })
      .run()
    const created = this.version(version.blockId, id)
    if (created === undefined) throw new Error('Version non enregistrée')
    return created
  }

  messages(blockId: string): WidgetMessageRow[] {
    return this.db
      .select({
        id: widgetMessages.id,
        role: widgetMessages.role,
        text: widgetMessages.text,
        versionId: widgetMessages.versionId,
        failed: widgetMessages.failed,
        createdAt: widgetMessages.createdAt
      })
      .from(widgetMessages)
      .where(eq(widgetMessages.blockId, blockId))
      .orderBy(asc(sql`${widgetMessages}.rowid`))
      .all()
  }

  insertMessage(message: {
    readonly blockId: string
    readonly role: 'user' | 'assistant'
    readonly text: string
    readonly versionId?: string
    readonly failed?: boolean
  }): void {
    this.db
      .insert(widgetMessages)
      .values({ id: randomUUID(), ...message })
      .run()
  }

  setCurrent(blockId: string, versionId: string): void {
    this.db.update(canvasBlocks).set({ currentVersionId: versionId }).where(eq(canvasBlocks.id, blockId)).run()
  }
}
