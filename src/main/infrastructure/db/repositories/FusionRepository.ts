import { randomUUID } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import type { SynthesisStatus } from '@shared/ipc/neurons'
import type { AppDatabase } from '../client'
import { writeChanges, type ChangeEntry } from './changeLog'
import { changeLog, neurons, planDependencies, planNodes, reflectionSummaries, syntheses } from '../schemaNeurons'

export type SynthesisType = 'action_plan' | 'reflection_summary'

export interface SynthesisRow {
  readonly id: string
  readonly rootId: string
  readonly type: SynthesisType
  readonly payloadJson: string
  readonly baseVersion: number
  readonly instruction: string | null
  readonly forced: boolean
  readonly degraded: boolean
  readonly status: SynthesisStatus
  readonly createdAt: string
}

export interface PlanNodeInsert {
  readonly id: string
  readonly parentId: string | null
  readonly type: 'task' | 'condition' | 'opportunity'
  readonly title: string
  readonly question: string | null
  readonly branchLabel: string | null
  readonly amountCents: number | null
  readonly dueDate: string | null
  readonly status: 'blocked' | 'ready'
  readonly investigation: boolean
  readonly toSchedule: boolean
}

export interface DependencyInsert {
  readonly id: string
  readonly fromNodeId: string
  readonly toNodeId: string
  readonly kind: 'after_done' | 'on_trigger'
  readonly triggerLabel: string | null
}

export interface ReflectionInsert {
  readonly id: string
  readonly keyPointsJson: string
  readonly decisionsJson: string
  readonly prosJson: string
  readonly consJson: string
  readonly openQuestionsJson: string
}

export type { ChangeEntry } from './changeLog'

const SYNTHESIS_COLUMNS = {
  id: syntheses.id,
  rootId: syntheses.rootId,
  type: syntheses.type,
  payloadJson: syntheses.payloadJson,
  baseVersion: syntheses.baseVersion,
  instruction: syntheses.instruction,
  forced: syntheses.forced,
  degraded: syntheses.degraded,
  status: syntheses.status,
  createdAt: syntheses.createdAt
}

const now = (): string => new Date().toISOString()

/** Synthèses (verrouillage) et résultats d'éclosion : plan, synthèse de réflexion, historique (spec 002 US3). */
export class FusionRepository {
  constructor(private readonly db: AppDatabase) {}

  transaction<T>(work: () => T): T {
    return this.db.transaction(() => work())
  }

  synthesis(id: string): SynthesisRow | undefined {
    return this.db.select(SYNTHESIS_COLUMNS).from(syntheses).where(eq(syntheses.id, id)).get()
  }

  proposedFor(rootId: string): SynthesisRow | undefined {
    return this.db
      .select(SYNTHESIS_COLUMNS)
      .from(syntheses)
      .where(and(eq(syntheses.rootId, rootId), eq(syntheses.status, 'proposed')))
      .get()
  }

  /** Nouvelle proposition ; les précédentes encore proposées sont remplacées (une seule `proposed` par racine). */
  insertProposal(input: {
    rootId: string
    type: SynthesisType
    payload: unknown
    baseVersion: number
    instruction: string | null
    forced: boolean
    degraded: boolean
  }): string {
    const id = randomUUID()
    this.transaction(() => {
      this.db
        .update(syntheses)
        .set({ status: 'superseded', decidedAt: now() })
        .where(and(eq(syntheses.rootId, input.rootId), eq(syntheses.status, 'proposed')))
        .run()
      this.db
        .insert(syntheses)
        .values({
          id,
          rootId: input.rootId,
          type: input.type,
          payloadJson: JSON.stringify(input.payload),
          baseVersion: input.baseVersion,
          instruction: input.instruction,
          forced: input.forced,
          degraded: input.degraded,
          status: 'proposed'
        })
        .run()
    })
    return id
  }

  decide(id: string, status: Exclude<SynthesisStatus, 'proposed'>, batchId?: string): void {
    this.db
      .update(syntheses)
      .set({ status, decidedAt: now(), ...(batchId === undefined ? {} : { batchId }) })
      .where(eq(syntheses.id, id))
      .run()
  }

  insertPlan(
    rootId: string,
    synthesisId: string,
    nodes: readonly PlanNodeInsert[],
    deps: readonly DependencyInsert[]
  ): void {
    if (nodes.length > 0) {
      this.db
        .insert(planNodes)
        .values(nodes.map((node) => ({ ...node, rootId, synthesisId })))
        .run()
    }
    if (deps.length > 0)
      this.db
        .insert(planDependencies)
        .values([...deps])
        .run()
  }

  insertReflection(rootId: string, synthesisId: string, summary: ReflectionInsert): void {
    this.db
      .insert(reflectionSummaries)
      .values({ ...summary, rootId, synthesisId })
      .run()
  }

  /** Plans et synthèses précédents restent consultables mais ne sont plus « en cours ». */
  retireCurrentResults(rootId: string): void {
    this.db.update(planNodes).set({ isCurrent: false }).where(eq(planNodes.rootId, rootId)).run()
    this.db.update(reflectionSummaries).set({ isCurrent: false }).where(eq(reflectionSummaries.rootId, rootId)).run()
  }

  setRootState(rootId: string, state: 'developing' | 'hatched'): void {
    this.db
      .update(neurons)
      .set({ state, version: sql`${neurons.version} + 1`, updatedAt: now() })
      .where(and(eq(neurons.id, rootId), eq(neurons.kind, 'root')))
      .run()
  }

  log(batchId: string, entries: readonly ChangeEntry[]): void {
    writeChanges(this.db, batchId, entries)
  }

  planOf(rootId: string): { id: string; title: string; status: string; isCurrent: boolean; synthesisId: string }[] {
    return this.db
      .select({
        id: planNodes.id,
        title: planNodes.title,
        status: planNodes.status,
        isCurrent: planNodes.isCurrent,
        synthesisId: planNodes.synthesisId
      })
      .from(planNodes)
      .where(eq(planNodes.rootId, rootId))
      .orderBy(sql`${planNodes}.rowid`)
      .all()
  }

  reflectionsOf(rootId: string): { id: string; keyPointsJson: string; isCurrent: boolean }[] {
    return this.db
      .select({
        id: reflectionSummaries.id,
        keyPointsJson: reflectionSummaries.keyPointsJson,
        isCurrent: reflectionSummaries.isCurrent
      })
      .from(reflectionSummaries)
      .where(eq(reflectionSummaries.rootId, rootId))
      .orderBy(sql`${reflectionSummaries}.rowid`)
      .all()
  }

  changesOf(batchId: string): { entity: string; kind: string }[] {
    return this.db
      .select({ entity: changeLog.entity, kind: changeLog.kind })
      .from(changeLog)
      .where(eq(changeLog.batchId, batchId))
      .all()
  }
}
