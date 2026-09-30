import { and, eq, inArray, sql } from 'drizzle-orm'
import type { HatchedResultView, PlanDependencyView, PlanNodeView, SourcedPointView } from '@shared/ipc/neurons'
import type { AppDatabase } from '../client'
import { neurons, planDependencies, planNodes, reflectionSummaries } from '../schemaNeurons'

interface StoredPoint {
  readonly headline?: string
  readonly text: string
  readonly sourceIds: readonly string[]
}

/** Points enregistrés `{ text, sourceIds }` ; une ancienne forme (texte seul) reste lisible. */
function parsePoints(json: string): StoredPoint[] {
  const parsed: unknown = JSON.parse(json)
  if (!Array.isArray(parsed)) return []
  return parsed.flatMap((point: unknown): StoredPoint[] => {
    if (typeof point === 'string') return [{ text: point, sourceIds: [] }]
    if (typeof point !== 'object' || point === null || !('text' in point) || typeof point.text !== 'string') return []
    const ids = 'sourceIds' in point && Array.isArray(point.sourceIds) ? point.sourceIds : []
    const headline = 'headline' in point && typeof point.headline === 'string' ? { headline: point.headline } : {}
    return [{ ...headline, text: point.text, sourceIds: ids.filter((id): id is string => typeof id === 'string') }]
  })
}

/** Lecture du résultat en cours d'une idée éclose (spec 003 US5). */
export class HatchedRepository {
  constructor(private readonly db: AppDatabase) {}

  result(rootId: string): HatchedResultView | null {
    const nodes = this.db
      .select()
      .from(planNodes)
      .where(and(eq(planNodes.rootId, rootId), eq(planNodes.isCurrent, true)))
      .orderBy(sql`${planNodes}.rowid`)
      .all()
    if (nodes.length > 0) {
      const views = nodes.map((node): PlanNodeView => ({
        id: node.id,
        parentId: node.parentId,
        type: node.type,
        title: node.title,
        question: node.question,
        branchLabel: node.branchLabel,
        activeBranch: node.activeBranch,
        amountCents: node.amountCents,
        dueDate: node.dueDate,
        status: node.status,
        investigation: node.investigation,
        toSchedule: node.toSchedule
      }))
      const dependencies = this.db
        .select()
        .from(planDependencies)
        .where(
          inArray(
            planDependencies.toNodeId,
            nodes.map((node) => node.id)
          )
        )
        .all()
        .map((dependency): PlanDependencyView => ({
          id: dependency.id,
          fromNodeId: dependency.fromNodeId,
          toNodeId: dependency.toNodeId,
          kind: dependency.kind,
          triggerLabel: dependency.triggerLabel,
          triggerReachedAt: dependency.triggerReachedAt
        }))
      return { type: 'action_plan', nodes: views, dependencies }
    }

    const summary = this.db
      .select()
      .from(reflectionSummaries)
      .where(and(eq(reflectionSummaries.rootId, rootId), eq(reflectionSummaries.isCurrent, true)))
      .orderBy(sql`${reflectionSummaries}.rowid desc`)
      .get()
    if (summary === undefined) return null
    const sections = {
      keyPoints: parsePoints(summary.keyPointsJson),
      decisions: parsePoints(summary.decisionsJson),
      pros: parsePoints(summary.prosJson),
      cons: parsePoints(summary.consJson)
    }
    const ids = [...new Set(Object.values(sections).flatMap((points) => points.flatMap((point) => point.sourceIds)))]
    const titles = new Map(
      ids.length === 0
        ? []
        : this.db
            .select({ id: neurons.id, title: neurons.title })
            .from(neurons)
            .where(inArray(neurons.id, ids))
            .all()
            .map((row) => [row.id, row.title] as const)
    )
    const withSources = (points: StoredPoint[]): SourcedPointView[] =>
      points.map((point) => ({
        headline: point.headline ?? null,
        text: point.text,
        sources: point.sourceIds.flatMap((id) => {
          const title = titles.get(id)
          return title === undefined ? [] : [{ id, title }]
        })
      }))
    return {
      type: 'reflection_summary',
      overview: summary.overview,
      nextStep: summary.nextStep,
      keyPoints: withSources(sections.keyPoints),
      decisions: withSources(sections.decisions),
      pros: withSources(sections.pros),
      cons: withSources(sections.cons),
      openQuestions: parsePoints(summary.openQuestionsJson).map((point) => ({ text: point.text }))
    }
  }
}
