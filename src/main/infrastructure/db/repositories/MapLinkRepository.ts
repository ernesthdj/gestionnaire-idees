import { randomUUID } from 'node:crypto'
import { and, asc, eq, isNull, or, sql } from 'drizzle-orm'
import { ELEMENT_RELATIONS, type ElementRelation, type MapEnd, type MapLinkView } from '@shared/ipc/canvas'
import type { AppDatabase } from '../client'
import { mapLinks } from '../schemaNeurons'

type Row = typeof mapLinks.$inferSelect

const toView = (row: Row): MapLinkView => ({
  id: row.id,
  from: { kind: row.fromKind, id: row.fromId },
  to: { kind: row.toKind, id: row.toId },
  label: row.label,
  origin: row.origin,
  relation: (ELEMENT_RELATIONS as readonly string[]).includes(row.relation ?? '')
    ? (row.relation as ElementRelation)
    : null
})

/** Liens libres de la carte (spec 007) : retrait annulable (`deleted_at`), jamais d'effacement. */
export class MapLinkRepository {
  constructor(private readonly db: AppDatabase) {}

  list(): MapLinkView[] {
    return this.db
      .select()
      .from(mapLinks)
      .where(isNull(mapLinks.deletedAt))
      .orderBy(asc(sql`${mapLinks}.rowid`))
      .all()
      .map(toView)
  }

  /** Lien visible entre deux éléments, quel que soit le sens. */
  between(a: MapEnd, b: MapEnd): MapLinkView | undefined {
    const pair = (x: MapEnd, y: MapEnd) =>
      and(
        eq(mapLinks.fromKind, x.kind),
        eq(mapLinks.fromId, x.id),
        eq(mapLinks.toKind, y.kind),
        eq(mapLinks.toId, y.id)
      )
    const row = this.db
      .select()
      .from(mapLinks)
      .where(and(isNull(mapLinks.deletedAt), or(pair(a, b), pair(b, a))))
      .get()
    return row === undefined ? undefined : toView(row)
  }

  /** Liens visibles touchant un élément (retrait d'un élément = retrait de ses liens). */
  touching(id: string): MapLinkView[] {
    return this.db
      .select()
      .from(mapLinks)
      .where(and(isNull(mapLinks.deletedAt), or(eq(mapLinks.fromId, id), eq(mapLinks.toId, id))))
      .all()
      .map(toView)
  }

  insert(link: Omit<MapLinkView, 'id' | 'relation'> & { readonly relation?: ElementRelation | null }): MapLinkView {
    const id = randomUUID()
    this.db
      .insert(mapLinks)
      .values({
        id,
        fromKind: link.from.kind,
        fromId: link.from.id,
        toKind: link.to.kind,
        toId: link.to.id,
        label: link.label,
        origin: link.origin,
        relation: link.relation ?? null
      })
      .run()
    return { id, ...link, relation: link.relation ?? null }
  }

  softDelete(id: string): boolean {
    return (
      this.db
        .update(mapLinks)
        .set({ deletedAt: new Date().toISOString() })
        .where(and(eq(mapLinks.id, id), isNull(mapLinks.deletedAt)))
        .run().changes > 0
    )
  }
}
