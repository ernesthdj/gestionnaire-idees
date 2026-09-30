import { eq } from 'drizzle-orm'
import type { AppDatabase } from '../client'
import { widgetRequests } from '../schemaNeurons'

/** Outil coché à l'éclosion, en attente de sa première version (spec 006). */
export interface WidgetRequestRow {
  readonly blockId: string
  readonly rootId: string
  readonly title: string
  readonly description: string
  readonly producesResult: boolean
}

const COLUMNS = {
  blockId: widgetRequests.blockId,
  rootId: widgetRequests.rootId,
  title: widgetRequests.title,
  description: widgetRequests.description,
  producesResult: widgetRequests.producesResult
}

/** Demandes de génération des outils proposés à l'éclosion (spec 006 FR-010). */
export class WidgetRequestRepository {
  constructor(private readonly db: AppDatabase) {}

  insert(request: WidgetRequestRow): void {
    this.db.insert(widgetRequests).values(request).run()
  }

  get(blockId: string): WidgetRequestRow | undefined {
    return this.db.select(COLUMNS).from(widgetRequests).where(eq(widgetRequests.blockId, blockId)).get()
  }

  /** La première version est là : la demande a abouti. */
  remove(blockId: string): void {
    this.db.delete(widgetRequests).where(eq(widgetRequests.blockId, blockId)).run()
  }
}
