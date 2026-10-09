import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import type { AppDatabase } from '../client'
import { savePoints } from '../schemaBrainstorms'
import { canvasBlocks, mapLinks, neurons } from '../schemaNeurons'

export type SavePointRow = Omit<typeof savePoints.$inferSelect, 'snapshot'>
type NeuronRow = typeof neurons.$inferSelect
type BlockRow = typeof canvasBlocks.$inferSelect
type LinkRow = typeof mapLinks.$inferSelect

/** Lignes d'un canevas, telles qu'en base (instantané d'un point de sauvegarde). */
export interface CanvasRows {
  readonly neurons: readonly NeuronRow[]
  readonly blocks: readonly BlockRow[]
  readonly links: readonly LinkRow[]
}

const COLUMNS = {
  id: savePoints.id,
  brainstormId: savePoints.brainstormId,
  name: savePoints.name,
  hidden: savePoints.hidden,
  sizeBytes: savePoints.sizeBytes,
  createdAt: savePoints.createdAt
}

/**
 * Colonnes d'un nœud jamais remises à l'état d'un point (spec 024 R3) : sa conversation (session Claude, modèle, mode,
 * dossiers) et son dossier de projet suivent leur vie propre.
 */
const CONVERSATION_COLUMNS = [
  'sessionId',
  'sessionStarted',
  'chatModel',
  'chatPermissionMode',
  'chatExtraDirsJson',
  'chatBypassConfirmedAt',
  'projectDir'
] as const

const without = <T extends Record<string, unknown>>(row: T, keys: readonly string[]): Partial<T> =>
  Object.fromEntries(Object.entries(row).filter(([key]) => !keys.includes(key))) as Partial<T>

/** Points de sauvegarde (spec 024 US2) et lecture / remplacement des lignes d'un canevas. */
export class SavePointRepository {
  constructor(private readonly db: AppDatabase) {}

  transaction<T>(work: () => T): T {
    return this.db.transaction(() => work())
  }

  insert(input: { brainstormId: string; name: string; hidden: boolean; snapshot: Buffer; at: string }): SavePointRow {
    const row = {
      id: randomUUID(),
      brainstormId: input.brainstormId,
      name: input.name,
      hidden: input.hidden,
      snapshot: input.snapshot,
      sizeBytes: input.snapshot.length,
      createdAt: input.at
    }
    this.db.insert(savePoints).values(row).run()
    return without(row, ['snapshot']) as SavePointRow
  }

  get(id: string): SavePointRow | undefined {
    return this.db.select(COLUMNS).from(savePoints).where(eq(savePoints.id, id)).get()
  }

  snapshot(id: string): Buffer | undefined {
    return this.db.select({ snapshot: savePoints.snapshot }).from(savePoints).where(eq(savePoints.id, id)).get()
      ?.snapshot
  }

  /** Points visibles (ou cachés) d'un brainstorm, le plus récent d'abord. */
  list(brainstormId: string, hidden = false): SavePointRow[] {
    return this.db
      .select(COLUMNS)
      .from(savePoints)
      .where(and(eq(savePoints.brainstormId, brainstormId), eq(savePoints.hidden, hidden)))
      .orderBy(desc(savePoints.createdAt), desc(sql`${savePoints}.rowid`))
      .all()
  }

  rename(id: string, name: string): void {
    this.db.update(savePoints).set({ name }).where(eq(savePoints.id, id)).run()
  }

  remove(id: string): void {
    this.db.delete(savePoints).where(eq(savePoints.id, id)).run()
  }

  /** Lignes du canevas d'un brainstorm : ses genesis et leurs descendants (hors conversations cachées), ses blocs, ses liens. */
  capture(brainstormId: string): CanvasRows {
    const members = this.members(brainstormId)
    const blocks = this.db
      .select()
      .from(canvasBlocks)
      .where(eq(canvasBlocks.brainstormId, brainstormId))
      .orderBy(asc(sql`${canvasBlocks}.rowid`))
      .all()
    const ends = [...members.map((row) => row.id), ...blocks.map((row) => row.id)]
    return { neurons: members, blocks, links: this.linksTouching(ends) }
  }

  /**
   * Remplace le canevas par `rows` (une transaction, appelée par le service) : les lignes de l'instantané reviennent
   * telles quelles (sauf la conversation des nœuds), ce qui n'y était pas est retiré de la carte — archivé ou marqué
   * supprimé, jamais effacé, donc l'annulation du retour le ramène.
   */
  replace(brainstormId: string, rows: CanvasRows, retire: CanvasRows, at: string): void {
    for (const row of rows.neurons) {
      this.db
        .insert(neurons)
        .values(row)
        .onConflictDoUpdate({ target: neurons.id, set: without(row, ['id', ...CONVERSATION_COLUMNS]) })
        .run()
    }
    for (const row of rows.blocks) {
      this.db
        .insert(canvasBlocks)
        .values({ ...row, brainstormId })
        .onConflictDoUpdate({ target: canvasBlocks.id, set: without({ ...row, brainstormId }, ['id']) })
        .run()
    }
    for (const row of rows.links) {
      this.db
        .insert(mapLinks)
        .values(row)
        .onConflictDoUpdate({ target: mapLinks.id, set: without(row, ['id']) })
        .run()
    }
    const neuronIds = retire.neurons.map((row) => row.id)
    if (neuronIds.length > 0) {
      this.db
        .update(neurons)
        .set({ state: 'archived', archivedAt: at, updatedAt: at })
        .where(inArray(neurons.id, neuronIds))
        .run()
    }
    const blockIds = retire.blocks.map((row) => row.id)
    if (blockIds.length > 0) {
      this.db
        .update(canvasBlocks)
        .set({ deletedAt: at })
        .where(and(inArray(canvasBlocks.id, blockIds), isNull(canvasBlocks.deletedAt)))
        .run()
    }
    const linkIds = retire.links.map((row) => row.id)
    if (linkIds.length > 0) {
      this.db
        .update(mapLinks)
        .set({ deletedAt: at })
        .where(and(inArray(mapLinks.id, linkIds), isNull(mapLinks.deletedAt)))
        .run()
    }
  }

  private members(brainstormId: string): NeuronRow[] {
    const roots = this.db
      .select({ id: neurons.id })
      .from(neurons)
      .where(and(eq(neurons.kind, 'root'), eq(neurons.brainstormId, brainstormId)))
      .all()
      .map((row) => row.id)
    if (roots.length === 0) return []
    return this.db
      .select()
      .from(neurons)
      .where(
        and(
          eq(neurons.hidden, false),
          or(inArray(neurons.id, roots), inArray(neurons.rootId, roots), inArray(neurons.genesisId, roots))
        )
      )
      .orderBy(asc(neurons.depth), asc(sql`${neurons}.rowid`))
      .all()
  }

  private linksTouching(ids: readonly string[]): LinkRow[] {
    if (ids.length === 0) return []
    return this.db
      .select()
      .from(mapLinks)
      .where(or(inArray(mapLinks.fromId, [...ids]), inArray(mapLinks.toId, [...ids])))
      .orderBy(asc(sql`${mapLinks}.rowid`))
      .all()
  }
}
