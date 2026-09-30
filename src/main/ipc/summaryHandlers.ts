import { z } from 'zod'
import type { IdeaSummaryService } from '../application/neurons/IdeaSummaryService'
import { defineRoute, type IpcRoute } from './registry'

/** Canal `neuron:summary` : résumé de l'idée de départ (fiche du volet). */
export function createSummaryRoutes(summaries: IdeaSummaryService): IpcRoute[] {
  return [
    defineRoute({
      channel: 'neuron:summary',
      input: z.object({ rootId: z.uuid() }).strict(),
      handler: ({ rootId }) => summaries.get(rootId)
    })
  ]
}
