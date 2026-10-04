import { z } from 'zod'
import { CHAT_MESSAGE_MAX } from '@shared/ipc/chat'
import type { ConversationService } from '../application/conversation/ConversationService'
import { defineRoute, type IpcRoute } from './registry'

const NeuronInput = z.strictObject({ neuronId: z.uuid() })

/** Canaux du chat d'un neurone (spec 008 contracts/chat.md) ; la réponse de Claude arrive par événements. */
export function createChatRoutes(conversations: ConversationService): IpcRoute[] {
  return [
    defineRoute({
      channel: 'chat:open',
      input: NeuronInput,
      handler: async ({ neuronId }) => conversations.open(neuronId)
    }),
    defineRoute({
      channel: 'chat:send',
      input: z.strictObject({ neuronId: z.uuid(), text: z.string().trim().min(1).max(CHAT_MESSAGE_MAX) }),
      handler: async ({ neuronId, text }) => {
        await conversations.send(neuronId, text)
        return { ok: true }
      }
    }),
    defineRoute({
      channel: 'chat:stop',
      input: NeuronInput,
      handler: async ({ neuronId }) => {
        conversations.stop(neuronId)
        return { ok: true }
      }
    }),
    defineRoute({
      channel: 'chat:linkFolder',
      input: z.strictObject({ neuronId: z.uuid(), unlink: z.boolean().optional() }),
      handler: async ({ neuronId, unlink }) => conversations.linkFolder(neuronId, unlink === true)
    }),
    defineRoute({
      channel: 'chat:close',
      input: NeuronInput,
      handler: async ({ neuronId }) => {
        conversations.close(neuronId)
        return { ok: true }
      }
    })
  ]
}
