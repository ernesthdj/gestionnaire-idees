import { randomUUID } from 'node:crypto'
import { and, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import { linkFingerprint, orderedPair } from '../../../domain/neurons/links'
import type { AppDatabase } from '../client'
import { readPlacement, writePlacement, type Placement } from './placement'
import { examples } from '../schema'
import {
  canvasBlocks,
  changeLog,
  extensions,
  linkSeeds,
  mapLinks,
  neuronLinks,
  neurons,
  planNodes,
  reflectionSummaries,
  suggestions,
  syntheses,
  widgetInputs
} from '../schemaNeurons'

export type ChangeKind =
  'confirm_synthesis' | 'manual_edit' | 'link' | 'seed' | 'delete' | 'promote' | 'undo' | 'mcp_write'

export interface ChangeRow {
  readonly id: string
  readonly batchId: string
  readonly kind: ChangeKind
  readonly actor: 'user' | 'claude'
  readonly entity: string
  readonly entityId: string
  readonly before: Record<string, unknown> | null
  readonly after: Record<string, unknown> | null
  readonly createdAt: string
  readonly undoneByBatch: string | null
}

export interface BatchRow {
  readonly batchId: string
  readonly entries: readonly ChangeRow[]
  readonly seq: number
}

/** État d'un élément tel que l'historique le compare et le restaure (`null` : absent / plus en cours). */
export type Snapshot = Record<string, unknown> | null

const parse = (json: string | null): Record<string, unknown> | null =>
  json === null ? null : (JSON.parse(json) as Record<string, unknown>)

const toRow = (row: typeof changeLog.$inferSelect): ChangeRow => ({
  id: row.id,
  batchId: row.batchId,
  kind: row.kind,
  actor: row.actor,
  entity: row.entity,
  entityId: row.entityId,
  before: parse(row.beforeJson),
  after: parse(row.afterJson),
  createdAt: row.createdAt,
  undoneByBatch: row.undoneByBatch
})

/**
 * Historique (spec 003 US6, research R6) : lecture des lots de `change_log` et, pour chaque type d'élément,
 * lecture de l'état actuel (`snapshot`) et application d'un état cible (`apply`).
 */
export class HistoryRepository {
  constructor(private readonly db: AppDatabase) {}

  transaction<T>(work: () => T): T {
    return this.db.transaction(() => work())
  }

  /** Lots du plus récent au plus ancien ; `seq` sert de curseur de pagination. */
  batches(limit: number, beforeSeq?: number): BatchRow[] {
    const heads = this.db
      .select({ batchId: changeLog.batchId, seq: sql<number>`max(${changeLog}.rowid)` })
      .from(changeLog)
      .groupBy(changeLog.batchId)
      .having(beforeSeq === undefined ? undefined : lt(sql`max(${changeLog}.rowid)`, beforeSeq))
      .orderBy(desc(sql`max(${changeLog}.rowid)`))
      .limit(limit)
      .all()
    if (heads.length === 0) return []
    const rows = this.db
      .select()
      .from(changeLog)
      .where(
        inArray(
          changeLog.batchId,
          heads.map((head) => head.batchId)
        )
      )
      .orderBy(sql`${changeLog}.rowid`)
      .all()
      .map(toRow)
    return heads.map((head) => ({
      batchId: head.batchId,
      seq: head.seq,
      entries: rows.filter((row) => row.batchId === head.batchId)
    }))
  }

  entries(batchId: string): ChangeRow[] {
    return this.db
      .select()
      .from(changeLog)
      .where(eq(changeLog.batchId, batchId))
      .orderBy(sql`${changeLog}.rowid`)
      .all()
      .map(toRow)
  }

  markUndone(batchId: string, undoBatchId: string): void {
    this.db
      .update(changeLog)
      .set({ undoneByBatch: undoBatchId })
      .where(and(eq(changeLog.batchId, batchId), isNull(changeLog.undoneByBatch)))
      .run()
  }

  write(
    batchId: string,
    entries: readonly Omit<ChangeRow, 'id' | 'batchId' | 'createdAt' | 'undoneByBatch' | 'actor'>[]
  ): void {
    if (entries.length === 0) return
    this.db
      .insert(changeLog)
      .values(
        entries.map((entry) => ({
          id: randomUUID(),
          batchId,
          kind: entry.kind,
          entity: entry.entity,
          entityId: entry.entityId,
          beforeJson: entry.before === null ? null : JSON.stringify(entry.before),
          afterJson: entry.after === null ? null : JSON.stringify(entry.after)
        }))
      )
      .run()
  }

  /** Type du lot qu'une annulation a défait (pour la résumer, ex. un lot « Claude »). */
  undoneKind(undoBatchId: string): ChangeKind | undefined {
    return this.db
      .select({ kind: changeLog.kind })
      .from(changeLog)
      .where(eq(changeLog.undoneByBatch, undoBatchId))
      .get()?.kind
  }

  rootTitle(rootId: string): string | undefined {
    return this.db.select({ title: neurons.title }).from(neurons).where(eq(neurons.id, rootId)).get()?.title
  }

  synthesisRoot(synthesisId: string): string | undefined {
    return this.db.select({ rootId: syntheses.rootId }).from(syntheses).where(eq(syntheses.id, synthesisId)).get()
      ?.rootId
  }

  /** Suggestions de liens encore en attente touchant cette idée (nées de son éclosion). */
  deleteSuggestedLinks(rootId: string): void {
    this.db
      .delete(neuronLinks)
      .where(
        and(eq(neuronLinks.status, 'suggested'), or(eq(neuronLinks.aRootId, rootId), eq(neuronLinks.bRootId, rootId)))
      )
      .run()
  }

  snapshot(entity: string, id: string): Snapshot {
    switch (entity) {
      case 'neuron': {
        const row = this.db
          .select({ state: neurons.state, version: neurons.version })
          .from(neurons)
          .where(eq(neurons.id, id))
          .get()
        // Une idée archivée est « retirée » (ex. idée née d'une graine dont l'acceptation a été annulée).
        return row === undefined || row.state === 'archived' ? null : row
      }
      case 'neuron_placement':
        return (readPlacement(this.db, id) as Snapshot | undefined) ?? null
      case 'canvas_block': {
        const row = this.db
          .select({ kind: canvasBlocks.kind, deletedAt: canvasBlocks.deletedAt })
          .from(canvasBlocks)
          .where(eq(canvasBlocks.id, id))
          .get()
        return row === undefined || row.deletedAt !== null ? null : { kind: row.kind }
      }
      case 'widget_input': {
        const row = this.db
          .select({ sourceKind: widgetInputs.sourceKind, deletedAt: widgetInputs.deletedAt })
          .from(widgetInputs)
          .where(eq(widgetInputs.id, id))
          .get()
        return row === undefined || row.deletedAt !== null ? null : { sourceKind: row.sourceKind }
      }
      case 'neuron_absorb': {
        const row = this.db.select({ absorbedIn: neurons.absorbedIn }).from(neurons).where(eq(neurons.id, id)).get()
        return row ?? null
      }
      case 'extension': {
        const row = this.db.select({ status: extensions.status }).from(extensions).where(eq(extensions.id, id)).get()
        return row ?? null
      }
      case 'suggestion': {
        const row = this.db.select({ status: suggestions.status }).from(suggestions).where(eq(suggestions.id, id)).get()
        return row ?? null
      }
      case 'link_seed': {
        const row = this.db
          .select({ status: linkSeeds.status, bornRootId: linkSeeds.bornRootId })
          .from(linkSeeds)
          .where(eq(linkSeeds.id, id))
          .get()
        return row ?? null
      }
      case 'synthesis': {
        const row = this.db.select({ status: syntheses.status }).from(syntheses).where(eq(syntheses.id, id)).get()
        return row ?? null
      }
      case 'plan_node': {
        const row = this.db.select({ isCurrent: planNodes.isCurrent }).from(planNodes).where(eq(planNodes.id, id)).get()
        return row?.isCurrent === true ? { isCurrent: true } : null
      }
      case 'reflection_summary': {
        const row = this.db
          .select({ isCurrent: reflectionSummaries.isCurrent })
          .from(reflectionSummaries)
          .where(eq(reflectionSummaries.id, id))
          .get()
        return row?.isCurrent === true ? { isCurrent: true } : null
      }
      case 'example': {
        const row = this.db.select().from(examples).where(eq(examples.id, id)).get()
        return row === undefined
          ? null
          : { polarity: row.polarity, taskKind: row.taskKind, contentJson: row.contentJson, source: row.source }
      }
      case 'map_link': {
        const row = this.db.select().from(mapLinks).where(eq(mapLinks.id, id)).get()
        return row === undefined || row.deletedAt !== null ? null : { label: row.label }
      }
      case 'block_text': {
        const row = this.db
          .select({ title: canvasBlocks.title, text: canvasBlocks.text })
          .from(canvasBlocks)
          .where(eq(canvasBlocks.id, id))
          .get()
        return row === undefined ? null : { title: row.title, text: row.text }
      }
      case 'element': {
        const row = this.db
          .select({
            state: neurons.state,
            title: neurons.title,
            content: neurons.content,
            type: neurons.elementType,
            status: neurons.elementStatus,
            paths: neurons.pathsJson,
            parentId: neurons.parentId,
            depth: neurons.depth
          })
          .from(neurons)
          .where(and(eq(neurons.id, id), eq(neurons.kind, 'element')))
          .get()
        if (row === undefined || row.state === 'archived') return null
        return {
          title: row.title,
          content: row.content,
          type: row.type,
          status: row.status,
          paths: row.paths,
          parentId: row.parentId,
          depth: row.depth
        }
      }
      case 'neuron_sheet': {
        const row = this.db.select({ sheetJson: neurons.sheetJson }).from(neurons).where(eq(neurons.id, id)).get()
        return row === undefined ? null : { sheet: row.sheetJson }
      }
      case 'neuron_text': {
        const row = this.db
          .select({ title: neurons.title, content: neurons.content })
          .from(neurons)
          .where(eq(neurons.id, id))
          .get()
        return row === undefined ? null : { title: row.title, content: row.content }
      }
      case 'neuron_link': {
        const row = this.db.select().from(neuronLinks).where(eq(neuronLinks.id, id)).get()
        return row === undefined
          ? null
          : {
              a: row.aRootId,
              b: row.bRootId,
              label: row.label,
              status: row.status,
              origin: row.origin,
              justification: row.justification
            }
      }
      default:
        // Élément sans état restaurable (ex. dépendance de plan, liée à ses tâches).
        return null
    }
  }

  /** Amène l'élément à l'état `target` (partiel : seules les clés présentes changent ; `null` : retrait). */
  apply(entity: string, id: string, target: Snapshot): void {
    switch (entity) {
      case 'neuron': {
        const now = new Date().toISOString()
        if (target === null) {
          // Retrait réversible : l'idée est archivée, jamais supprimée (un rétablissement la fait revenir).
          this.db
            .update(neurons)
            .set({ state: 'archived', archivedAt: now, updatedAt: now })
            .where(eq(neurons.id, id))
            .run()
          return
        }
        this.db
          .update(neurons)
          .set({
            ...(typeof target['state'] === 'string'
              ? { state: target['state'] as 'raw' | 'developing' | 'hatched', archivedAt: null }
              : {}),
            ...(typeof target['version'] === 'number' ? { version: target['version'] } : {}),
            updatedAt: now
          })
          .where(eq(neurons.id, id))
          .run()
        return
      }
      case 'neuron_placement':
        if (target !== null) writePlacement(this.db, id, target as unknown as Placement)
        return
      case 'canvas_block':
        this.db
          .update(canvasBlocks)
          .set({ deletedAt: target === null ? new Date().toISOString() : null })
          .where(eq(canvasBlocks.id, id))
          .run()
        return
      case 'widget_input':
        this.db
          .update(widgetInputs)
          .set({ deletedAt: target === null ? new Date().toISOString() : null })
          .where(eq(widgetInputs.id, id))
          .run()
        return
      case 'neuron_absorb':
        if (target === null) return
        this.db
          .update(neurons)
          .set({ absorbedIn: typeof target['absorbedIn'] === 'string' ? target['absorbedIn'] : null })
          .where(eq(neurons.id, id))
          .run()
        return
      case 'extension': {
        const status = target?.['status']
        if (status !== 'proposed' && status !== 'dismissed') return
        this.db
          .update(extensions)
          .set({ status, resolvedAt: status === 'proposed' ? null : new Date().toISOString() })
          .where(eq(extensions.id, id))
          .run()
        return
      }
      case 'suggestion': {
        const status = target?.['status']
        if (status !== 'proposed' && status !== 'dismissed') return
        this.db
          .update(suggestions)
          .set({ status, resolvedAt: status === 'proposed' ? null : new Date().toISOString() })
          .where(eq(suggestions.id, id))
          .run()
        return
      }
      case 'link_seed': {
        if (target === null || typeof target['status'] !== 'string') return
        const status = target['status'] as 'suggested' | 'accepted'
        this.db
          .update(linkSeeds)
          .set({
            status,
            bornRootId: typeof target['bornRootId'] === 'string' ? target['bornRootId'] : null,
            decidedAt: status === 'suggested' ? null : new Date().toISOString()
          })
          .where(eq(linkSeeds.id, id))
          .run()
        return
      }
      case 'synthesis': {
        if (target === null || typeof target['status'] !== 'string') return
        const status = target['status'] as 'proposed' | 'confirmed'
        this.db
          .update(syntheses)
          .set({ status, decidedAt: status === 'proposed' ? null : new Date().toISOString() })
          .where(eq(syntheses.id, id))
          .run()
        return
      }
      case 'plan_node':
        this.db
          .update(planNodes)
          .set({ isCurrent: target !== null })
          .where(eq(planNodes.id, id))
          .run()
        return
      case 'reflection_summary':
        this.db
          .update(reflectionSummaries)
          .set({ isCurrent: target !== null })
          .where(eq(reflectionSummaries.id, id))
          .run()
        return
      case 'example':
        this.applyExample(id, target)
        return
      case 'neuron_link':
        this.applyLink(id, target)
        return
      case 'map_link':
        this.db
          .update(mapLinks)
          .set({ deletedAt: target === null ? new Date().toISOString() : null })
          .where(eq(mapLinks.id, id))
          .run()
        return
      case 'block_text':
        if (target === null) return
        this.db
          .update(canvasBlocks)
          .set({
            title: typeof target['title'] === 'string' ? target['title'] : null,
            text: typeof target['text'] === 'string' ? target['text'] : null
          })
          .where(eq(canvasBlocks.id, id))
          .run()
        return
      case 'element': {
        // Élément de carte de structure (spec 009) : retiré = archivé ; rétabli = ses champs et visible.
        const now = new Date().toISOString()
        if (target === null) {
          this.db
            .update(neurons)
            .set({ state: 'archived', archivedAt: now, updatedAt: now })
            .where(and(eq(neurons.id, id), eq(neurons.kind, 'element')))
            .run()
          return
        }
        const text = (key: string): string | null => (typeof target[key] === 'string' ? (target[key] as string) : null)
        this.db
          .update(neurons)
          .set({
            state: 'raw',
            archivedAt: null,
            updatedAt: now,
            ...(text('title') === null ? {} : { title: text('title') as string }),
            content: text('content'),
            elementStatus: text('status'),
            pathsJson: text('paths'),
            ...(text('parentId') === null ? {} : { parentId: text('parentId') }),
            ...(typeof target['depth'] === 'number' ? { depth: target['depth'] } : {}),
            ...(text('type') === null
              ? {}
              : { elementType: text('type') as (typeof neurons.$inferInsert)['elementType'] })
          })
          .where(and(eq(neurons.id, id), eq(neurons.kind, 'element')))
          .run()
        return
      }
      case 'neuron_sheet':
        if (target === null) return
        this.db
          .update(neurons)
          .set({ sheetJson: typeof target['sheet'] === 'string' ? target['sheet'] : null })
          .where(eq(neurons.id, id))
          .run()
        return
      case 'neuron_text':
        if (target === null || typeof target['title'] !== 'string') return
        this.db
          .update(neurons)
          .set({
            title: target['title'],
            content: typeof target['content'] === 'string' ? target['content'] : null,
            updatedAt: new Date().toISOString()
          })
          .where(eq(neurons.id, id))
          .run()
        return
      default:
        return
    }
  }

  private applyExample(id: string, target: Snapshot): void {
    if (target === null) {
      this.db.delete(examples).where(eq(examples.id, id)).run()
      return
    }
    const exists = this.db.select({ id: examples.id }).from(examples).where(eq(examples.id, id)).get()
    if (exists !== undefined || typeof target['contentJson'] !== 'string') return
    this.db
      .insert(examples)
      .values({
        id,
        polarity: target['polarity'] === 'negative' ? 'negative' : 'positive',
        taskKind: String(target['taskKind']),
        contentJson: target['contentJson'],
        source: target['source'] === 'rejected_proposal' ? 'rejected_proposal' : 'accepted_proposal',
        contextVersionId: null
      })
      .run()
  }

  private applyLink(id: string, target: Snapshot): void {
    if (target === null) {
      this.db.delete(neuronLinks).where(eq(neuronLinks.id, id)).run()
      return
    }
    const current = this.db.select().from(neuronLinks).where(eq(neuronLinks.id, id)).get()
    if (current !== undefined) {
      const label = typeof target['label'] === 'string' ? target['label'] : current.label
      this.db
        .update(neuronLinks)
        .set({
          label,
          fingerprint: linkFingerprint(current.aRootId, current.bRootId, label),
          ...(typeof target['status'] === 'string'
            ? { status: target['status'] as 'suggested' | 'accepted' | 'rejected' | 'superseded' }
            : {})
        })
        .where(eq(neuronLinks.id, id))
        .run()
      return
    }
    if (typeof target['a'] !== 'string' || typeof target['b'] !== 'string' || typeof target['label'] !== 'string') {
      return
    }
    const [a, b] = orderedPair(target['a'], target['b'])
    this.db
      .insert(neuronLinks)
      .values({
        id,
        aRootId: a,
        bRootId: b,
        label: target['label'],
        justification: typeof target['justification'] === 'string' ? target['justification'] : null,
        origin: target['origin'] === 'ai' ? 'ai' : 'user',
        status: typeof target['status'] === 'string' ? (target['status'] as 'accepted') : 'accepted',
        fingerprint: linkFingerprint(a, b, target['label'])
      })
      .run()
  }
}
