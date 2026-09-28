import { z } from 'zod'
import type { HistoryService } from '../application/history/HistoryService'
import { defineRoute, type IpcRoute } from './registry'

/** Canaux de l'historique (spec 003 contracts § À valider, historique). */
export function createHistoryRoutes(history: HistoryService): IpcRoute[] {
  return [
    defineRoute({
      channel: 'history:list',
      input: z
        .object({
          cursor: z
            .string()
            .regex(/^\d{1,12}$/)
            .optional(),
          limit: z.number().int().min(1).max(100).optional()
        })
        .strict(),
      handler: async ({ cursor, limit }) =>
        history.list({ ...(cursor === undefined ? {} : { cursor }), ...(limit === undefined ? {} : { limit }) })
    }),
    defineRoute({
      channel: 'history:undo',
      input: z.object({ batchId: z.uuid() }).strict(),
      handler: async ({ batchId }) => history.undo(batchId)
    })
  ]
}
