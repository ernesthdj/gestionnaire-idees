import { z } from 'zod'
import type { NeuronService } from '../application/neurons/NeuronService'
import { Coordinate } from './canvasHandlers'
import { defineRoute, type IpcRoute } from './registry'
import { AppError } from '../domain/errors'

const Nature = z.enum(['action', 'reflection'])
const CategorySlug = z.enum(['general', 'achat', 'projet', 'sortie', 'photo', 'it'])
const Id = z.uuid()

/** Retrait d'une étape d'un plan d'attaque (spec 011) : `neuron:remove` sert aussi aux étapes. */
export interface StepRemoval {
  isStep(id: string): boolean
  remove(id: string): { readonly batchId: string }
}

/** Canaux `neuron:*` (spec 002 contracts/ipc-neurons.md) — chaque charge utile est validée. */
export function createNeuronRoutes(service: NeuronService, steps?: StepRemoval): IpcRoute[] {
  return [
    defineRoute({
      channel: 'neuron:create',
      input: z
        .object({
          text: z.string().trim().min(1).max(2000),
          nature: Nature.optional(),
          // Idée créée au double-clic sur la carte : à cet endroit (FR-030).
          position: z.object({ x: Coordinate, y: Coordinate }).strict().optional()
        })
        .strict(),
      handler: ({ text, nature, position }) =>
        service.create({
          text,
          ...(nature === undefined ? {} : { nature }),
          ...(position === undefined ? {} : { position })
        })
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
      channel: 'neuron:remove',
      input: z.object({ rootId: Id }).strict(),
      handler: async ({ rootId }) => (steps?.isStep(rootId) === true ? steps.remove(rootId) : service.remove(rootId))
    }),
    defineRoute({
      channel: 'neuron:removeMany',
      input: z.object({ rootIds: z.array(Id).min(1).max(200) }).strict(),
      handler: async ({ rootIds }) => {
        if (rootIds.some((id) => steps?.isStep(id) === true)) {
          throw new AppError('INVALID_STATE', 'Une étape se supprime depuis son propre menu')
        }
        return service.removeMany(rootIds)
      }
    }),
    defineRoute({
      channel: 'neuron:archive',
      input: z.object({ rootId: Id }).strict(),
      handler: async ({ rootId }) => service.archive(rootId)
    })
  ]
}
