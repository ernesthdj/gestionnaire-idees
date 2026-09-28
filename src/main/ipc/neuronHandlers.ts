import { z } from 'zod'
import type { NeuronService } from '../application/neurons/NeuronService'
import { defineRoute, type IpcRoute } from './registry'

const Nature = z.enum(['action', 'reflection'])
const CategorySlug = z.enum(['general', 'achat', 'projet', 'sortie', 'photo', 'it'])
const Id = z.uuid()

/** Canaux `neuron:*` (spec 002 contracts/ipc-neurons.md) — chaque charge utile est validée. */
export function createNeuronRoutes(service: NeuronService): IpcRoute[] {
  return [
    defineRoute({
      channel: 'neuron:create',
      input: z.object({ text: z.string().trim().min(1).max(2000), nature: Nature.optional() }).strict(),
      handler: ({ text, nature }) => service.create({ text, ...(nature === undefined ? {} : { nature }) })
    }),
    defineRoute({
      channel: 'neuron:list',
      input: z
        .object({
          state: z.enum(['raw', 'developing', 'hatched', 'archived']).optional(),
          nature: Nature.optional(),
          categorySlug: CategorySlug.optional(),
          search: z.string().max(100).optional(),
          cursor: z
            .string()
            .regex(/^\d{1,12}$/)
            .optional(),
          limit: z.number().int().min(1).max(200).optional()
        })
        .strict(),
      handler: async (filter) =>
        service.list(Object.fromEntries(Object.entries(filter).filter(([, value]) => value !== undefined)))
    }),
    defineRoute({
      channel: 'neuron:getTree',
      input: z.object({ rootId: Id }).strict(),
      handler: async ({ rootId }) => service.getTree(rootId)
    }),
    defineRoute({
      channel: 'neuron:update',
      input: z
        .object({
          id: Id,
          title: z.string().trim().min(1).max(120).optional(),
          content: z.string().max(2000).nullable().optional(),
          nature: Nature.optional(),
          categorySlug: CategorySlug.optional()
        })
        .strict(),
      handler: async (patch) =>
        service.update({
          id: patch.id,
          ...(patch.title === undefined ? {} : { title: patch.title }),
          ...(patch.content === undefined ? {} : { content: patch.content }),
          ...(patch.nature === undefined ? {} : { nature: patch.nature }),
          ...(patch.categorySlug === undefined ? {} : { categorySlug: patch.categorySlug })
        })
    }),
    defineRoute({
      channel: 'neuron:archive',
      input: z.object({ rootId: Id }).strict(),
      handler: async ({ rootId }) => service.archive(rootId)
    })
  ]
}
