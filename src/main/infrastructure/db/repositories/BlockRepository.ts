import { randomUUID } from 'node:crypto'
import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import type { BlockView } from '@shared/ipc/canvas'
import type { AppDatabase } from '../client'
import { canvasBlocks } from '../schemaNeurons'
import { writeChanges, type ChangeEntry } from './changeLog'

const COLUMNS = {
  id: canvasBlocks.id,
  kind: canvasBlocks.kind,
  x: canvasBlocks.x,
  y: canvasBlocks.y,
  width: canvasBlocks.width,
  height: canvasBlocks.height,
  text: canvasBlocks.text,
  versionId: canvasBlocks.currentVersionId,
  sourceBlockId: canvasBlocks.sourceBlockId
}

export interface BlockPatch {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  /** Texte d'une note (absent : inchangé). */
  readonly text?: string
}

/** Blocs de l'écran Idées : vides (spec 003 FR-026), notes et widgets (spec 004), cadres résultat (spec 005). */
export class BlockRepository {
  constructor(private readonly db: AppDatabase) {}

  transaction<T>(work: () => T): T {
    return this.db.transaction(() => work())
  }

  /** Blocs visibles (les blocs supprimés restent en base pour l'annulation). */
  list(): BlockView[] {
    return this.db
      .select(COLUMNS)
      .from(canvasBlocks)
      .where(isNull(canvasBlocks.deletedAt))
      .orderBy(asc(sql`${canvasBlocks}.rowid`))
      .all()
  }

  get(id: string): BlockView | undefined {
    return this.db
      .select(COLUMNS)
      .from(canvasBlocks)
      .where(and(eq(canvasBlocks.id, id), isNull(canvasBlocks.deletedAt)))
      .get()
  }

  insert(
    block: Omit<BlockView, 'id' | 'versionId' | 'sourceBlockId'> & { readonly sourceBlockId?: string }
  ): BlockView {
    const created = { id: randomUUID(), ...block, sourceBlockId: block.sourceBlockId ?? null }
    this.db.insert(canvasBlocks).values(created).run()
    return { ...created, versionId: null }
  }

  /** Cadre résultat visible d'un widget (le plus ancien s'il y en a plusieurs après une annulation). */
  resultBlockOf(widgetBlockId: string): BlockView | undefined {
    return this.db
      .select(COLUMNS)
      .from(canvasBlocks)
      .where(
        and(
          eq(canvasBlocks.kind, 'result'),
          eq(canvasBlocks.sourceBlockId, widgetBlockId),
          isNull(canvasBlocks.deletedAt)
        )
      )
      .orderBy(asc(sql`${canvasBlocks}.rowid`))
      .get()
  }

  update(patch: BlockPatch): boolean {
    const { id, text, ...geometry } = patch
    return (
      this.db
        .update(canvasBlocks)
        .set({ ...geometry, ...(text === undefined ? {} : { text }) })
        .where(and(eq(canvasBlocks.id, id), isNull(canvasBlocks.deletedAt)))
        .run().changes > 0
    )
  }

  /** Suppression annulable : le bloc disparaît de la carte, ses versions et sa conversation sont gardées. */
  softDelete(id: string): boolean {
    return (
      this.db
        .update(canvasBlocks)
        .set({ deletedAt: new Date().toISOString() })
        .where(and(eq(canvasBlocks.id, id), isNull(canvasBlocks.deletedAt)))
        .run().changes > 0
    )
  }

  log(batchId: string, entries: readonly ChangeEntry[]): void {
    writeChanges(this.db, batchId, entries)
  }
}
