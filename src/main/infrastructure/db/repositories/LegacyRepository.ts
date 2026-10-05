import { randomUUID } from 'node:crypto'
import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm'
import { IDEA_PARTS } from '@shared/ipc/widgetIo'
import type { LegacyAnswer, LegacyDocument, LegacyIdea, LegacyPoint } from '../../../domain/conversation/legacySheet'
import type { AppDatabase } from '../client'
import { writeChanges, type ChangeEntry } from './changeLog'
import {
  extensions,
  mapLinks,
  neuronLinks,
  neurons,
  planNodes,
  reflectionSummaries,
  settings,
  widgetInputs
} from '../schemaNeurons'

/** Marqueur de la conversion unique (spec 010 FR-004). */
export const LEGACY_CONVERSION_KEY = 'migration.legacySheets'

/** Lien accepté entre deux idées dans l'ancien moteur, repris en lien libre de la carte. */
export interface LegacyLink {
  readonly aRootId: string
  readonly bRootId: string
  readonly label: string | null
}

/** Branchement « prochaine étape → widget » ; `duplicate` : le widget reçoit déjà l'idée elle-même. */
export interface LegacyStepInput {
  readonly id: string
  readonly blockId: string
  readonly rootId: string
  readonly duplicate: boolean
}

export interface ConversionPlan {
  readonly sheets: ReadonlyMap<string, string>
  readonly links: readonly LegacyLink[]
  readonly stepInputs: readonly LegacyStepInput[]
}

const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`)

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

  /** Liens acceptés de l'ancien moteur qui n'ont pas encore d'équivalent en lien libre entre les deux idées. */
  linksToConvert(): LegacyLink[] {
    const existing = new Set(
      this.db
        .select({ from: mapLinks.fromId, to: mapLinks.toId })
        .from(mapLinks)
        .where(and(eq(mapLinks.fromKind, 'idea'), eq(mapLinks.toKind, 'idea'), isNull(mapLinks.deletedAt)))
        .all()
        .map((row) => pairKey(row.from, row.to))
    )
    return this.db
      .select({ aRootId: neuronLinks.aRootId, bRootId: neuronLinks.bRootId, label: neuronLinks.label })
      .from(neuronLinks)
      .where(eq(neuronLinks.status, 'accepted'))
      .orderBy(asc(sql`${neuronLinks}.rowid`))
      .all()
      .filter((link) => !existing.has(pairKey(link.aRootId, link.bRootId)))
      .map((link) => ({ ...link, label: link.label.trim() === '' ? null : link.label }))
  }

  /** Branchements actifs d'une prochaine étape vers un widget. */
  stepInputs(): LegacyStepInput[] {
    const active = this.db
      .select({
        id: widgetInputs.id,
        blockId: widgetInputs.blockId,
        kind: widgetInputs.sourceKind,
        sourceId: widgetInputs.sourceId
      })
      .from(widgetInputs)
      .where(isNull(widgetInputs.deletedAt))
      .orderBy(asc(sql`${widgetInputs}.rowid`))
      .all()
    const ideaInputs = new Set(
      active.filter((input) => input.kind === 'idea').map((input) => `${input.blockId}|${input.sourceId}`)
    )
    return active
      .filter((input) => input.kind === 'step')
      .map((input) => ({
        id: input.id,
        blockId: input.blockId,
        rootId: input.sourceId,
        duplicate: ideaInputs.has(`${input.blockId}|${input.sourceId}`)
      }))
  }

  /**
   * Applique la conversion et pose le marqueur dans une seule transaction, journalisée en un lot d'Historique
   * annulable. Le marqueur est posé même sans rien à convertir : la conversion n'a lieu qu'une fois.
   */
  saveConversion(batchId: string, plan: ConversionPlan): void {
    this.db.transaction(() => {
      const entries: ChangeEntry[] = []
      const entry = (entity: string, entityId: string, before: unknown, after: unknown): void => {
        entries.push({ kind: 'convert', entity, entityId, before, after })
      }
      for (const [id, sheetJson] of plan.sheets) {
        this.db.update(neurons).set({ sheetJson }).where(eq(neurons.id, id)).run()
        entry('neuron_sheet', id, { sheet: null }, { sheet: sheetJson })
      }
      for (const link of plan.links) {
        const id = randomUUID()
        this.db
          .insert(mapLinks)
          .values({
            id,
            fromKind: 'idea',
            fromId: link.aRootId,
            toKind: 'idea',
            toId: link.bRootId,
            label: link.label,
            origin: 'user'
          })
          .run()
        entry('map_link', id, null, { label: link.label })
      }
      const now = new Date().toISOString()
      for (const input of plan.stepInputs) {
        // L'étape disparaît de la carte : le widget reçoit l'idée elle-même (sa revue se redemande).
        this.db.update(widgetInputs).set({ deletedAt: now }).where(eq(widgetInputs.id, input.id)).run()
        entry('widget_input', input.id, { sourceKind: 'step' }, null)
        if (input.duplicate) continue
        const id = randomUUID()
        this.db
          .insert(widgetInputs)
          .values({
            id,
            blockId: input.blockId,
            sourceKind: 'idea',
            sourceId: input.rootId,
            partsJson: JSON.stringify(IDEA_PARTS)
          })
          .run()
        entry('widget_input', id, null, { sourceKind: 'idea' })
      }
      writeChanges(this.db, batchId, entries)
      const valueJson = JSON.stringify({
        at: now,
        sheets: plan.sheets.size,
        links: plan.links.length,
        stepInputs: plan.stepInputs.length
      })
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
