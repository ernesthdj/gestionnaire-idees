import { z } from 'zod'
import type { FusionService } from '../application/neurons/FusionService'
import { defineRoute, type IpcRoute } from './registry'

const Id = z.uuid()

/** Canaux `fusion:*` : verrouiller, corriger, refuser, confirmer (éclosion), rouvrir (spec 002 US3). */
export function createFusionRoutes(fusion: FusionService): IpcRoute[] {
  return [
    defineRoute({
      channel: 'fusion:lock',
      input: z.object({ rootId: Id, force: z.boolean().optional() }).strict(),
      handler: ({ rootId, force }) => fusion.lock({ rootId, ...(force === undefined ? {} : { force }) })
    }),
    defineRoute({
      channel: 'fusion:revise',
      input: z.object({ synthesisId: Id, instruction: z.string().trim().min(1).max(500) }).strict(),
      handler: ({ synthesisId, instruction }) => fusion.revise({ synthesisId, instruction })
    }),
    defineRoute({
      channel: 'fusion:confirm',
      input: z.object({ synthesisId: Id }).strict(),
      handler: async ({ synthesisId }) => fusion.confirm(synthesisId)
    }),
    defineRoute({
      channel: 'fusion:reject',
      input: z.object({ synthesisId: Id, reason: z.string().trim().max(300).optional() }).strict(),
      handler: async ({ synthesisId, reason }) =>
        fusion.reject({ synthesisId, ...(reason === undefined ? {} : { reason }) })
    }),
    defineRoute({
      channel: 'fusion:reopen',
      input: z.object({ rootId: Id }).strict(),
      handler: async ({ rootId }) => fusion.reopen(rootId)
    })
  ]
}
