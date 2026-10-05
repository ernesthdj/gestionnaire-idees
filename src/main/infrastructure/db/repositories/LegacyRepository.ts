import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm'
import type { LegacyAnswer, LegacyDocument, LegacyIdea, LegacyPoint } from '../../../domain/conversation/legacySheet'
import type { AppDatabase } from '../client'
import { writeChanges } from './changeLog'
import { extensions, neurons, planNodes, reflectionSummaries, settings } from '../schemaNeurons'

/** Marqueur de la conversion unique (spec 010 FR-004). */
export const LEGACY_CONVERSION_KEY = 'migration.legacySheets'

/** Points enregistrés `{ headline?, text }` ; une ancienne forme (texte seul) reste lisible ; une valeur abîmée : rien. */
function parsePoints(json: string): LegacyPoint[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  return parsed.flatMap((point: unknown): LegacyPoint[] => {
    if (typeof point === 'string') return [{ headline: null, text: point }]
    if (typeof point !== 'object' || point === null || !('text' in point) || typeof point.text !== 'string') return []
    const headline = 'headline' in point && typeof point.headline === 'string' ? point.headline : null
    return [{ headline, text: point.text }]
  })
}

/**
 * Lecture des tables de l'ancien moteur, conservées en archive (spec 010 D1, FR-005), et écriture des fiches
 * converties. Ne dépend d'aucun service de l'ancien moteur : il survit à leur retrait.
 */
export class LegacyRepository {
  constructor(private readonly db: AppDatabase) {}

  isConverted(): boolean {
    return (
      this.db.select({ key: settings.key }).from(settings).where(eq(settings.key, LEGACY_CONVERSION_KEY)).get() !==
      undefined
    )
  }

  /** Idées (racines) sans fiche, avec leurs réponses et leur document en cours. */
  ideasWithoutSheet(): LegacyIdea[] {
    return this.db
      .select({ id: neurons.id })
      .from(neurons)
      .where(and(eq(neurons.kind, 'root'), isNull(neurons.sheetJson)))
      .orderBy(asc(sql`${neurons}.rowid`))
      .all()
      .map((row) => ({ id: row.id, answers: this.answers(row.id), document: this.document(row.id) }))
  }

  /**
   * Écrit les fiches et pose le marqueur dans une seule transaction, journalisées en un lot d'Historique annulable.
   * Le marqueur est posé même sans fiche : la conversion n'a lieu qu'une fois.
   */
  saveConversion(batchId: string, sheets: ReadonlyMap<string, string>): void {
    this.db.transaction(() => {
      for (const [id, sheetJson] of sheets) {
        this.db.update(neurons).set({ sheetJson }).where(eq(neurons.id, id)).run()
      }
      writeChanges(
        this.db,
        batchId,
        [...sheets].map(([id, sheetJson]) => ({
          kind: 'convert' as const,
          entity: 'neuron_sheet',
          entityId: id,
          before: { sheet: null },
          after: { sheet: sheetJson }
        }))
      )
      const valueJson = JSON.stringify({ at: new Date().toISOString(), converted: sheets.size })
      this.db
        .insert(settings)
        .values({ key: LEGACY_CONVERSION_KEY, valueJson })
        .onConflictDoUpdate({ target: settings.key, set: { valueJson } })
        .run()
    })
  }

  private answers(rootId: string): LegacyAnswer[] {
    return this.db
      .select({ kind: neurons.kind, title: neurons.title, content: neurons.content, question: extensions.question })
      .from(neurons)
      .leftJoin(extensions, eq(extensions.id, neurons.fromExtensionId))
      .where(and(eq(neurons.rootId, rootId), ne(neurons.id, rootId), isNull(neurons.archivedAt)))
      .orderBy(asc(sql`${neurons}.rowid`))
      .all()
  }

  private document(rootId: string): LegacyDocument | null {
    const nodes = this.db
      .select({
        type: planNodes.type,
        title: planNodes.title,
        status: planNodes.status,
        activeBranch: planNodes.activeBranch
      })
      .from(planNodes)
      .where(and(eq(planNodes.rootId, rootId), eq(planNodes.isCurrent, true)))
      .orderBy(asc(sql`${planNodes}.rowid`))
      .all()
    if (nodes.length > 0) return { type: 'action_plan', nodes }
    const summary = this.db
      .select()
      .from(reflectionSummaries)
      .where(and(eq(reflectionSummaries.rootId, rootId), eq(reflectionSummaries.isCurrent, true)))
      .orderBy(sql`${reflectionSummaries}.rowid desc`)
      .get()
    if (summary === undefined) return null
    return {
      type: 'reflection_summary',
      overview: summary.overview,
      nextStep: summary.nextStep,
      keyPoints: parsePoints(summary.keyPointsJson),
      decisions: parsePoints(summary.decisionsJson),
      pros: parsePoints(summary.prosJson),
      cons: parsePoints(summary.consJson),
      openQuestions: parsePoints(summary.openQuestionsJson).map((point) => point.text)
    }
  }
}
