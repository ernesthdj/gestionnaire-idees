import { z } from 'zod'
import { TOOL_PROPOSALS_MAX } from '@shared/ai/neurons'
import type { FusionService } from '../application/neurons/FusionService'
import { defineRoute, type IpcRoute } from './registry'

const Id = z.uuid()
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const Patch = z
  .object({
    ref: z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,15}(\.\d{1,2})?$/),
    title: z.string().trim().min(1).max(120).optional(),
    amountCents: z.number().int().min(0).max(100_000_000_000).nullable().optional(),
    dueDate: IsoDate.nullable().optional(),
    text: z.string().trim().min(1).max(300).optional()
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 1, 'Rien à corriger')

/** Canaux `fusion:*` : verrouiller, corriger, refuser, confirmer (éclosion), rouvrir (spec 002 US3). */
export function createFusionRoutes(fusion: FusionService): IpcRoute[] {
  return [
    defineRoute({
      channel: 'fusion:lock',
      input: z.object({ rootId: Id, force: z.boolean().optional() }).strict(),
      handler: ({ rootId, force }) => fusion.lock({ rootId, ...(force === undefined ? {} : { force }) })
    }),
    defineRoute({
      channel: 'fusion:getProposed',
      input: z.object({ rootId: Id }).strict(),
      handler: async ({ rootId }) => fusion.proposed(rootId)
    }),
    defineRoute({
      channel: 'fusion:editProposed',
      input: z.object({ synthesisId: Id, patch: Patch }).strict(),
      handler: async ({ synthesisId, patch }) =>
        fusion.editProposed({
          synthesisId,
          patch: {
            ref: patch.ref,
            ...(patch.title === undefined ? {} : { title: patch.title }),
            ...(patch.amountCents === undefined ? {} : { amountCents: patch.amountCents }),
            ...(patch.dueDate === undefined ? {} : { dueDate: patch.dueDate }),
            ...(patch.text === undefined ? {} : { text: patch.text })
          }
        })
    }),
    defineRoute({
      channel: 'fusion:revise',
      input: z.object({ synthesisId: Id, instruction: z.string().trim().min(1).max(500) }).strict(),
      handler: ({ synthesisId, instruction }) => fusion.revise({ synthesisId, instruction })
    }),
    defineRoute({
      channel: 'fusion:confirm',
      // Outils cochés dans l'aperçu (spec 006) : positions dans la liste proposée.
      input: z
        .object({
          synthesisId: Id,
          tools: z
            .array(
              z
                .number()
                .int()
                .min(0)
                .max(TOOL_PROPOSALS_MAX - 1)
            )
            .max(TOOL_PROPOSALS_MAX)
            .optional()
        })
        .strict(),
      handler: async ({ synthesisId, tools }) => fusion.confirm(synthesisId, tools ?? [])
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
