import { randomUUID } from 'node:crypto'
import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { IDEA_PARTS, type IdeaPart, type InputSourceKind } from '@shared/ipc/widgetIo'
import type { AppDatabase } from '../client'
import {
  canvasBlocks,
  extensions,
  neurons,
  widgetApprovals,
  widgetInputs,
  widgetResults,
  widgetVersions
} from '../schemaNeurons'
import { writeChanges, type ChangeEntry } from './changeLog'

export interface WidgetInputRow {
  readonly id: string
  readonly blockId: string
  readonly sourceKind: InputSourceKind
  readonly sourceId: string
  readonly parts: readonly IdeaPart[]
}

function parseParts(json: string): IdeaPart[] {
  const parsed: unknown = JSON.parse(json)
  return Array.isArray(parsed) ? IDEA_PARTS.filter((part) => parsed.includes(part)) : []
}

const COLUMNS = {
  id: widgetInputs.id,
  blockId: widgetInputs.blockId,
  sourceKind: widgetInputs.sourceKind,
  sourceId: widgetInputs.sourceId,
  partsJson: widgetInputs.partsJson
}

const toRow = (row: {
  id: string
  blockId: string
  sourceKind: InputSourceKind
  sourceId: string
  partsJson: string
}): WidgetInputRow => ({
  id: row.id,
  blockId: row.blockId,
  sourceKind: row.sourceKind,
  sourceId: row.sourceId,
  parts: parseParts(row.partsJson)
})

/** Branchements d'entrée, autorisations et derniers résultats des widgets (spec 005). */
export class WidgetIoRepository {
  constructor(private readonly db: AppDatabase) {}

  transaction<T>(work: () => T): T {
    return this.db.transaction(() => work())
  }

  /** Branchements en place d'un widget, dans l'ordre où ils ont été tirés. */
  inputs(blockId: string): WidgetInputRow[] {
    return this.db
      .select(COLUMNS)
      .from(widgetInputs)
      .where(and(eq(widgetInputs.blockId, blockId), isNull(widgetInputs.deletedAt)))
      .orderBy(asc(sql`${widgetInputs}.rowid`))
      .all()
      .map(toRow)
  }

  /** Tous les branchements en place vers des widgets visibles (traits de la carte). */
  links(): WidgetInputRow[] {
    return this.db
      .select(COLUMNS)
      .from(widgetInputs)
      .innerJoin(canvasBlocks, eq(canvasBlocks.id, widgetInputs.blockId))
      .where(and(isNull(widgetInputs.deletedAt), isNull(canvasBlocks.deletedAt)))
      .orderBy(asc(sql`${widgetInputs}.rowid`))
      .all()
      .map(toRow)
  }

  input(id: string): WidgetInputRow | undefined {
    const row = this.db
      .select(COLUMNS)
      .from(widgetInputs)
      .where(and(eq(widgetInputs.id, id), isNull(widgetInputs.deletedAt)))
      .get()
    return row === undefined ? undefined : toRow(row)
  }

  insertInput(input: Omit<WidgetInputRow, 'id'>): WidgetInputRow {
    const id = randomUUID()
    this.db
      .insert(widgetInputs)
      .values({
        id,
        blockId: input.blockId,
        sourceKind: input.sourceKind,
        sourceId: input.sourceId,
        partsJson: JSON.stringify(input.parts)
      })
      .run()
    return { id, ...input }
  }

  setParts(id: string, parts: readonly IdeaPart[]): void {
    this.db
      .update(widgetInputs)
      .set({ partsJson: JSON.stringify(parts) })
      .where(eq(widgetInputs.id, id))
      .run()
  }

  /** Débranchement annulable : le branchement reste en base pour l'Historique. */
  softDelete(id: string): void {
    this.db.update(widgetInputs).set({ deletedAt: new Date().toISOString() }).where(eq(widgetInputs.id, id)).run()
  }

  isApproved(blockId: string, fingerprint: string): boolean {
    return (
      this.db
        .select({ blockId: widgetApprovals.blockId })
        .from(widgetApprovals)
        .where(and(eq(widgetApprovals.blockId, blockId), eq(widgetApprovals.fingerprint, fingerprint)))
        .get() !== undefined
    )
  }

  approve(blockId: string, fingerprint: string): void {
    this.db.insert(widgetApprovals).values({ blockId, fingerprint }).onConflictDoNothing().run()
  }

  /** Widgets visibles branchés sur une idée, avec le titre et le résumé de leur version affichée (spec 006). */
  toolsOf(rootId: string): { readonly title: string; readonly summary: string }[] {
    return this.db
      .selectDistinct({ blockId: canvasBlocks.id, title: widgetVersions.title, summary: widgetVersions.summary })
      .from(widgetInputs)
      .innerJoin(canvasBlocks, eq(canvasBlocks.id, widgetInputs.blockId))
      .innerJoin(widgetVersions, eq(widgetVersions.id, canvasBlocks.currentVersionId))
      .where(
        and(
          eq(widgetInputs.sourceId, rootId),
          isNull(widgetInputs.deletedAt),
          eq(canvasBlocks.kind, 'widget'),
          isNull(canvasBlocks.deletedAt)
        )
      )
      .all()
      .map(({ title, summary }) => ({ title, summary }))
  }

  /** Dernier résultat d'un widget : remplace le précédent. */
  saveResult(blockId: string, dataJson: string): void {
    const updatedAt = new Date().toISOString()
    this.db
      .insert(widgetResults)
      .values({ blockId, dataJson, updatedAt })
      .onConflictDoUpdate({ target: widgetResults.blockId, set: { dataJson, updatedAt } })
      .run()
  }

  result(blockId: string): { readonly dataJson: string; readonly updatedAt: string } | undefined {
    return this.db
      .select({ dataJson: widgetResults.dataJson, updatedAt: widgetResults.updatedAt })
      .from(widgetResults)
      .where(eq(widgetResults.blockId, blockId))
      .get()
  }

  /** Questions posées sur une idée et la réponse donnée à chacune (sous-neurone né de la question). */
  answers(rootId: string): { readonly question: string; readonly answer: string }[] {
    return this.db
      .select({ question: extensions.question, title: neurons.title, content: neurons.content })
      .from(neurons)
      .innerJoin(extensions, eq(extensions.id, neurons.fromExtensionId))
      .where(eq(neurons.rootId, rootId))
      .orderBy(asc(sql`${neurons}.rowid`))
      .all()
      .map((row) => ({ question: row.question, answer: row.content ?? row.title }))
  }

  log(batchId: string, entries: readonly ChangeEntry[]): void {
    writeChanges(this.db, batchId, entries)
  }
}
