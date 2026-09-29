import { z } from 'zod'
import type { LinkService } from '../application/neurons/LinkService'
import { defineRoute, type IpcRoute } from './registry'

const Id = z.uuid()
const Label = z.string().trim().min(1).max(40)
/** Libellé facultatif à la création : relier deux idées suffit (retour de test de mentalyas). */
const OptionalLabel = z.string().trim().max(40).default('')

/** Canaux `links:*` : liens entre idées (spec 002 US4, contracts/ipc-neurons.md). */
export function createLinkRoutes(links: LinkService): IpcRoute[] {
  return [
    defineRoute({
      channel: 'links:list',
      input: z.object({ status: z.enum(['suggested', 'accepted']).optional() }).strict(),
      handler: async ({ status }) => links.list(status)
    }),
    defineRoute({
      channel: 'links:decide',
      input: z.object({ linkId: Id, accept: z.boolean() }).strict(),
      handler: async ({ linkId, accept }) => links.decide({ linkId, accept })
    }),
    defineRoute({
      channel: 'links:create',
      input: z.object({ aRootId: Id, bRootId: Id, label: OptionalLabel }).strict(),
      handler: async ({ aRootId, bRootId, label }) => links.create({ aRootId, bRootId, label })
    }),
    defineRoute({
      channel: 'links:update',
      input: z.object({ linkId: Id, label: Label }).strict(),
      handler: async ({ linkId, label }) => links.update({ linkId, label })
    }),
    defineRoute({
      channel: 'links:delete',
      input: z.object({ linkId: Id }).strict(),
      handler: async ({ linkId }) => links.delete(linkId)
    })
  ]
}
