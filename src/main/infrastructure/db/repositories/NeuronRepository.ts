import { and, desc, eq, lt, ne, sql, type SQL } from 'drizzle-orm'
import type {
  CategoryView,
  ExtensionView,
  GaugeView,
  Nature,
  NeuronView,
  RootListView,
  RootState,
  RootView,
  Source,
  SuggestionView,
  WebSourceView
} from '@shared/ipc/neurons'
import type { AppDatabase } from '../client'
import { categories, contextAssessments, extensions, neurons, suggestions } from '../schemaNeurons'

export interface RootFilter {
  readonly state?: RootState
  readonly nature?: Nature
  readonly categorySlug?: string
  readonly search?: string
  readonly cursor?: string
  readonly limit?: number
}

const DEFAULT_LIMIT = 50

/**
 * Transforme une saisie libre en requête FTS5 sûre : mots conservés (lettres/chiffres), chacun entre guillemets
 * et en préfixe. Aucun opérateur FTS de l'utilisateur n'est interprété.
 */
export function toFtsQuery(search: string): string | null {
  const words = search.match(/[\p{L}\p{N}]+/gu)
  if (words === null) return null
  return words
    .slice(0, 8)
    .map((word) => `"${word}"*`)
    .join(' ')
}

type RootRow = typeof neurons.$inferSelect & { category: CategoryView | null }

function toRootView(row: RootRow): RootView {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    nature: row.nature ?? 'reflection',
    natureSource: row.natureSource,
    category: row.category,
    categorySource: row.categorySource,
    state: row.state ?? 'raw',
    version: row.version,
    position: row.posX === null || row.posY === null ? null : { x: row.posX, y: row.posY },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}

/** Accès aux neurones (racines et sous-neurones), extensions et jauges (spec 002). */
export class NeuronRepository {
  constructor(private readonly db: AppDatabase) {}

  categoryBySlug(slug: string): CategoryView | undefined {
    const row = this.db.select().from(categories).where(eq(categories.slug, slug)).get()
    return row === undefined ? undefined : { id: row.id, slug: row.slug, label: row.label, color: row.color }
  }

  insertRoot(input: {
    id: string
    title: string
    content: string | null
    nature: Nature
    natureSource: Source | null
  }): void {
    this.db
      .insert(neurons)
      .values({
        id: input.id,
        rootId: input.id,
        kind: 'root',
        title: input.title,
        content: input.content,
        origin: 'user',
        nature: input.nature,
        natureSource: input.natureSource,
        state: 'raw'
      })
      .run()
  }

  root(id: string): RootView | undefined {
    const row = this.selectRoots()
      .where(and(eq(neurons.id, id), eq(neurons.kind, 'root')))
      .get()
    return row === undefined ? undefined : toRootView(this.withCategory(row))
  }

  listRoots(filter: RootFilter): RootListView {
    const limit = Math.min(Math.max(filter.limit ?? DEFAULT_LIMIT, 1), 200)
    const conditions: SQL[] = [eq(neurons.kind, 'root')]
    conditions.push(filter.state === undefined ? ne(neurons.state, 'archived') : eq(neurons.state, filter.state))
    if (filter.nature !== undefined) conditions.push(eq(neurons.nature, filter.nature))
    if (filter.categorySlug !== undefined) conditions.push(eq(categories.slug, filter.categorySlug))
    if (filter.search !== undefined) {
      const query = toFtsQuery(filter.search)
      if (query === null) return { items: [], nextCursor: null }
      conditions.push(sql`${neurons.id} IN (SELECT neuron_id FROM neurons_fts WHERE neurons_fts MATCH ${query})`)
    }
    if (filter.cursor !== undefined && /^\d+$/.test(filter.cursor)) {
      conditions.push(lt(sql`${neurons}.rowid`, Number(filter.cursor)))
    }
    const rows = this.selectRoots()
      .where(and(...conditions))
      .orderBy(desc(sql`${neurons}.rowid`))
      .limit(limit + 1)
      .all()
    const page = rows.slice(0, limit)
    const last = page.at(-1)
    return {
      items: page.map((row) => toRootView(this.withCategory(row))),
      nextCursor: rows.length > limit && last !== undefined ? String(last.rowid) : null
    }
  }

  /** Modifie une racine et incrémente sa version (détection des synthèses périmées). */
  updateRoot(
    id: string,
    patch: Partial<
      Pick<
        typeof neurons.$inferInsert,
        'title' | 'content' | 'nature' | 'natureSource' | 'categoryId' | 'categorySource' | 'state' | 'archivedAt'
      >
    >
  ): void {
    this.db
      .update(neurons)
      .set({ ...patch, version: sql`${neurons.version} + 1`, updatedAt: new Date().toISOString() })
      .where(and(eq(neurons.id, id), eq(neurons.kind, 'root')))
      .run()
  }

  /** Classement proposé par l'IA : ne remplace jamais un choix de l'utilisateur (sans changer la version). */
  applyCategorization(id: string, categoryId: string, nature: Nature): void {
    this.db.run(sql`
      UPDATE neurons SET
        category_id = CASE WHEN category_source = 'user' THEN category_id ELSE ${categoryId} END,
        category_source = CASE WHEN category_source = 'user' THEN 'user' ELSE 'ai' END,
        nature = CASE WHEN nature_source = 'user' THEN nature ELSE ${nature} END,
        nature_source = CASE WHEN nature_source = 'user' THEN 'user' ELSE 'ai' END
      WHERE id = ${id} AND kind = 'root'`)
  }

  neuronsOf(rootId: string): NeuronView[] {
    return this.db
      .select({
        id: neurons.id,
        parentId: neurons.parentId,
        depth: neurons.depth,
        kind: neurons.kind,
        title: neurons.title,
        content: neurons.content,
        amountCents: neurons.amountCents,
        dueDate: neurons.dueDate,
        origin: neurons.origin
      })
      .from(neurons)
      .where(and(eq(neurons.rootId, rootId), ne(neurons.kind, 'root')))
      .orderBy(sql`${neurons}.rowid`)
      .all()
  }

  proposedExtensions(rootId: string): Omit<ExtensionView, 'outsideNature'>[] {
    return this.db
      .select()
      .from(extensions)
      .where(and(eq(extensions.rootId, rootId), eq(extensions.status, 'proposed')))
      .orderBy(sql`${extensions}.rowid`)
      .all()
      .map((row) => ({
        id: row.id,
        neuronId: row.neuronId,
        question: row.question,
        quickReplies: JSON.parse(row.quickRepliesJson) as string[],
        dimension: row.dimension,
        origin: row.origin
      }))
  }

  proposedSuggestions(rootId: string): SuggestionView[] {
    return this.db
      .select()
      .from(suggestions)
      .where(and(eq(suggestions.rootId, rootId), eq(suggestions.status, 'proposed')))
      .orderBy(sql`${suggestions}.rowid`)
      .all()
      .map((row) => ({
        id: row.id,
        neuronId: row.neuronId,
        title: row.title,
        content: row.content,
        research: row.research,
        sources: JSON.parse(row.sourcesJson) as WebSourceView[]
      }))
  }

  latestGauge(rootId: string): GaugeView | null {
    const row = this.db
      .select()
      .from(contextAssessments)
      .where(eq(contextAssessments.rootId, rootId))
      .orderBy(desc(sql`${contextAssessments}.rowid`))
      .get()
    if (row === undefined) return null
    return {
      level: row.level,
      covered: JSON.parse(row.coveredJson) as string[],
      missing: JSON.parse(row.missingJson) as string[],
      answered: row.answeredCount
    }
  }

  private selectRoots() {
    return this.db
      .select({ neuron: neurons, category: categories, rowid: sql<number>`${neurons}.rowid` })
      .from(neurons)
      .leftJoin(categories, eq(neurons.categoryId, categories.id))
      .$dynamic()
  }

  private withCategory(row: {
    neuron: typeof neurons.$inferSelect
    category: typeof categories.$inferSelect | null
  }): RootRow {
    const category = row.category
    return {
      ...row.neuron,
      category:
        category === null
          ? null
          : { id: category.id, slug: category.slug, label: category.label, color: category.color }
    }
  }
}
