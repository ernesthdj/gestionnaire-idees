import { z } from 'zod'
import type { GrowthService } from '../application/neurons/GrowthService'
import { defineRoute, type IpcRoute } from './registry'

const Id = z.uuid()

const AnswerInput = z.union([
  z.object({ choice: z.string().trim().min(1).max(40) }).strict(),
  z.object({ text: z.string().trim().min(1).max(1000) }).strict(),
  z.object({ unknown: z.literal(true) }).strict()
])

/** Canaux `growth:*` (dont suggestions) et `neuron:delete` (spec 002 contracts/ipc-neurons.md). */
export function createGrowthRoutes(growth: GrowthService): IpcRoute[] {
  return [
    defineRoute({
      channel: 'growth:develop',
      input: z.object({ rootId: Id }).strict(),
      handler: ({ rootId }) => growth.develop(rootId)
    }),
    defineRoute({
      channel: 'growth:answer',
      input: z.object({ extensionId: Id, answer: AnswerInput }).strict(),
      handler: ({ extensionId, answer }) => growth.answer({ extensionId, answer })
    }),
    defineRoute({
      channel: 'growth:more',
      input: z.object({ neuronId: Id }).strict(),
      handler: ({ neuronId }) => growth.more(neuronId)
    }),
    defineRoute({
      channel: 'growth:dismiss',
      input: z.object({ extensionId: Id }).strict(),
      handler: async ({ extensionId }) => growth.dismiss(extensionId)
    }),
    defineRoute({
      channel: 'growth:addBranch',
      input: z
        .object({ parentId: Id, title: z.string().trim().min(1).max(120), content: z.string().max(1000).optional() })
        .strict(),
      handler: async ({ parentId, title, content }) =>
        growth.addBranch({ parentId, title, ...(content === undefined ? {} : { content }) })
    }),
    defineRoute({
      channel: 'growth:editBranch',
      input: z
        .object({
          neuronId: Id,
          title: z.string().trim().min(1).max(120),
          content: z.string().max(1000).nullable().optional()
        })
        .strict(),
      handler: async ({ neuronId, title, content }) =>
        growth.editBranch({ neuronId, title, ...(content === undefined ? {} : { content }) })
    }),
    defineRoute({
      channel: 'growth:acceptSuggestion',
      input: z.object({ suggestionId: Id }).strict(),
      handler: ({ suggestionId }) => growth.acceptSuggestion(suggestionId)
    }),
    defineRoute({
      channel: 'growth:dismissSuggestion',
      input: z.object({ suggestionId: Id }).strict(),
      handler: async ({ suggestionId }) => growth.dismissSuggestion(suggestionId)
    }),
    defineRoute({
      channel: 'growth:promoteIdea',
      input: z.object({ neuronId: Id }).strict(),
      handler: async ({ neuronId }) => growth.promoteIdea(neuronId)
    }),
    defineRoute({
      channel: 'neuron:delete',
      input: z.object({ neuronId: Id, confirm: z.literal(true) }).strict(),
      handler: async ({ neuronId }) => growth.deleteBranch(neuronId)
    })
  ]
}
