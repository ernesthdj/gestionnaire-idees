import { eq } from 'drizzle-orm'
import type { AppDatabase } from '../client'
import { extensions, neurons, suggestions } from '../schemaNeurons'

/**
 * Place d'un neurone dans un arbre : à quelle idée il appartient, sous quel parent, à quelle profondeur, et s'il est
 * lui-même une idée (racine). Sert à faire éclore une idée suggérée en idée à part entière, et à l'annuler.
 */
export interface Placement {
  readonly rootId: string
  readonly parentId: string | null
  readonly depth: number
  readonly kind: typeof neurons.$inferSelect.kind
  readonly state: typeof neurons.$inferSelect.state
  readonly nature: typeof neurons.$inferSelect.nature
  readonly natureSource: typeof neurons.$inferSelect.natureSource
  readonly categoryId: string | null
  readonly categorySource: typeof neurons.$inferSelect.categorySource
}

export function readPlacement(db: AppDatabase, id: string): Placement | undefined {
  return db
    .select({
      rootId: neurons.rootId,
      parentId: neurons.parentId,
      depth: neurons.depth,
      kind: neurons.kind,
      state: neurons.state,
      nature: neurons.nature,
      natureSource: neurons.natureSource,
      categoryId: neurons.categoryId,
      categorySource: neurons.categorySource
    })
    .from(neurons)
    .where(eq(neurons.id, id))
    .get()
}

/** Déplace un neurone ; ses questions et suggestions suivent (elles appartiennent à la même idée que lui). */
export function writePlacement(db: AppDatabase, id: string, placement: Placement): void {
  db.update(neurons)
    .set({ ...placement, updatedAt: new Date().toISOString() })
    .where(eq(neurons.id, id))
    .run()
  db.update(extensions).set({ rootId: placement.rootId }).where(eq(extensions.neuronId, id)).run()
  db.update(suggestions).set({ rootId: placement.rootId }).where(eq(suggestions.neuronId, id)).run()
}
