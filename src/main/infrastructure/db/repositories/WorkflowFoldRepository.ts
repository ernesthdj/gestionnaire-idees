import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { WORKFLOW_KEY } from '@shared/ipc/workflow'
import type { AppDatabase } from '../client'
import { settings } from '../schemaNeurons'

/** Au plus ce nombre de nœuds repliés ou dépliés à la main, par projet (research R6). */
export const WORKFLOW_FOLDS_MAX = 500

const FoldsSchema = z.record(z.string().regex(WORKFLOW_KEY).max(160), z.boolean())

const keyOf = (genesisId: string): string => `workflow.folded.${genesisId}`

/**
 * Repli des nœuds de la vue Workflow (spec 023 FR-016), par projet, dans la table `settings` : seulement les écarts au
 * repli par défaut. Une valeur illisible est ignorée (repli par défaut).
 */
export class WorkflowFoldRepository {
  constructor(private readonly db: AppDatabase) {}

  get(genesisId: string): Record<string, boolean> {
    const row = this.db
      .select()
      .from(settings)
      .where(eq(settings.key, keyOf(genesisId)))
      .get()
    if (row === undefined) return {}
    try {
      const parsed = FoldsSchema.safeParse(JSON.parse(row.valueJson))
      return parsed.success ? parsed.data : {}
    } catch {
      return {}
    }
  }

  set(genesisId: string, nodeKey: string, folded: boolean): void {
    const folds = { ...this.get(genesisId), [nodeKey]: folded }
    const keys = Object.keys(folds)
    // Au-delà de la borne, les plus anciens écarts sont oubliés (ordre d'insertion).
    const kept = Object.fromEntries(keys.slice(-WORKFLOW_FOLDS_MAX).map((key) => [key, folds[key] === true]))
    const valueJson = JSON.stringify(FoldsSchema.parse(kept))
    this.db
      .insert(settings)
      .values({ key: keyOf(genesisId), valueJson })
      .onConflictDoUpdate({ target: settings.key, set: { valueJson } })
      .run()
  }
}
