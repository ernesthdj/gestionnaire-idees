import { randomUUID } from 'node:crypto'
import { and, eq, inArray, sql } from 'drizzle-orm'
import type { Extension } from '@shared/ai/neurons'
import type { GaugeLevel, NeuronKind, RootState, Source } from '@shared/ipc/neurons'
import type { AppDatabase } from '../client'
import { contextAssessments, extensions, neurons } from '../schemaNeurons'

export interface GrowthNode {
  readonly id: string
  readonly rootId: string
  readonly parentId: string | null
  readonly depth: number
  readonly kind: NeuronKind
  readonly title: string
  readonly content: string | null
}

export interface ExtensionRow {
  readonly id: string
  readonly rootId: string
  readonly neuronId: string
  readonly question: string
  readonly dimension: string
  readonly answerKind: 'answer' | 'condition' | 'opportunity' | null
  readonly status: 'proposed' | 'answered' | 'dismissed'
}

/** Écritures de la croissance : sous-neurones, extensions, jauges (spec 002 US1/US2). */
export class GrowthRepository {
  constructor(private readonly db: AppDatabase) {}

  transaction<T>(work: () => T): T {
    return this.db.transaction(() => work())
  }

  nodes(rootId: string): GrowthNode[] {
    return this.db
      .select({
        id: neurons.id,
        rootId: neurons.rootId,
        parentId: neurons.parentId,
        depth: neurons.depth,
        kind: neurons.kind,
        title: neurons.title,
        content: neurons.content
      })
      .from(neurons)
      .where(eq(neurons.rootId, rootId))
      .orderBy(sql`${neurons}.rowid`)
      .all()
  }

  node(id: string): GrowthNode | undefined {
    return this.db
      .select({
        id: neurons.id,
        rootId: neurons.rootId,
        parentId: neurons.parentId,
        depth: neurons.depth,
        kind: neurons.kind,
        title: neurons.title,
        content: neurons.content
      })
      .from(neurons)
      .where(eq(neurons.id, id))
      .get()
  }

  insertSubNeuron(input: {
    rootId: string
    parentId: string
    depth: number
    kind: Exclude<NeuronKind, 'root'>
    title: string
    content: string | null
    origin: Source
    fromExtensionId: string | null
  }): string {
    const id = randomUUID()
    this.db
      .insert(neurons)
      .values({ id, ...input })
      .run()
    return id
  }

  insertExtensions(rootId: string, neuronId: string, proposed: readonly Extension[]): void {
    if (proposed.length === 0) return
    this.db
      .insert(extensions)
      .values(
        proposed.map((extension) => ({
          id: randomUUID(),
          rootId,
          neuronId,
          question: extension.question,
          quickRepliesJson: JSON.stringify(extension.quickReplies),
          dimension: extension.dimension,
          answerKind: extension.answerKind ?? null,
          status: 'proposed' as const,
          origin: 'ai' as const
        }))
      )
      .run()
  }

  extension(id: string): ExtensionRow | undefined {
    return this.db
      .select({
        id: extensions.id,
        rootId: extensions.rootId,
        neuronId: extensions.neuronId,
        question: extensions.question,
        dimension: extensions.dimension,
        answerKind: extensions.answerKind,
        status: extensions.status
      })
      .from(extensions)
      .where(eq(extensions.id, id))
      .get()
  }

  resolveExtension(id: string, status: 'answered' | 'dismissed'): void {
    this.db
      .update(extensions)
      .set({ status, resolvedAt: new Date().toISOString() })
      .where(and(eq(extensions.id, id), eq(extensions.status, 'proposed')))
      .run()
  }

  /** Toutes les questions déjà proposées pour ce neurone racine, quel que soit leur statut (anti-doublon). */
  knownQuestions(rootId: string): string[] {
    return this.db
      .select({ question: extensions.question })
      .from(extensions)
      .where(eq(extensions.rootId, rootId))
      .all()
      .map((row) => row.question)
  }

  hasProposedExtensions(rootId: string): boolean {
    const row = this.db
      .select({ count: sql<number>`count(*)` })
      .from(extensions)
      .where(and(eq(extensions.rootId, rootId), eq(extensions.status, 'proposed')))
      .get()
    return (row?.count ?? 0) > 0
  }

  answeredCount(rootId: string): number {
    const row = this.db
      .select({ count: sql<number>`count(*)` })
      .from(extensions)
      .where(and(eq(extensions.rootId, rootId), eq(extensions.status, 'answered')))
      .get()
    return row?.count ?? 0
  }

  insertAssessment(input: {
    rootId: string
    level: GaugeLevel
    aiLevel: GaugeLevel
    covered: readonly string[]
    missing: readonly string[]
    answered: number
  }): void {
    this.db
      .insert(contextAssessments)
      .values({
        id: randomUUID(),
        rootId: input.rootId,
        level: input.level,
        aiLevel: input.aiLevel,
        coveredJson: JSON.stringify(input.covered),
        missingJson: JSON.stringify(input.missing),
        answeredCount: input.answered
      })
      .run()
  }

  /** Supprime des sous-neurones et les extensions qui les ciblent (appelé dans une transaction). */
  deleteNeurons(ids: readonly string[]): void {
    if (ids.length === 0) return
    this.db
      .delete(extensions)
      .where(inArray(extensions.neuronId, [...ids]))
      .run()
    // Enfants d'abord : la clé étrangère parent_id interdit de supprimer un parent encore référencé.
    for (const id of [...ids].reverse()) this.db.delete(neurons).where(eq(neurons.id, id)).run()
  }

  touchRoot(rootId: string, state?: RootState): void {
    this.db
      .update(neurons)
      .set({
        version: sql`${neurons.version} + 1`,
        updatedAt: new Date().toISOString(),
        ...(state === undefined ? {} : { state })
      })
      .where(and(eq(neurons.id, rootId), eq(neurons.kind, 'root')))
      .run()
  }
}
