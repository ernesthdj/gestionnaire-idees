import { randomUUID } from 'node:crypto'
import { asc, eq, sql } from 'drizzle-orm'
import type { BlockView } from '@shared/ipc/canvas'
import type { AppDatabase } from '../client'
import { canvasBlocks } from '../schemaNeurons'

const COLUMNS = {
  id: canvasBlocks.id,
  x: canvasBlocks.x,
  y: canvasBlocks.y,
  width: canvasBlocks.width,
  height: canvasBlocks.height
}

/** Blocs libres de l'écran Idées (spec 003 FR-026). */
export class BlockRepository {
  constructor(private readonly db: AppDatabase) {}

  list(): BlockView[] {
    return this.db
      .select(COLUMNS)
      .from(canvasBlocks)
      .orderBy(asc(sql`${canvasBlocks}.rowid`))
      .all()
  }

  get(id: string): BlockView | undefined {
    return this.db.select(COLUMNS).from(canvasBlocks).where(eq(canvasBlocks.id, id)).get()
  }

  insert(block: Omit<BlockView, 'id'>): BlockView {
    const created = { id: randomUUID(), ...block }
    this.db.insert(canvasBlocks).values(created).run()
    return created
  }

  update(block: BlockView): boolean {
    const { id, ...geometry } = block
    return this.db.update(canvasBlocks).set(geometry).where(eq(canvasBlocks.id, id)).run().changes > 0
  }

  delete(id: string): boolean {
    return this.db.delete(canvasBlocks).where(eq(canvasBlocks.id, id)).run().changes > 0
  }
}
