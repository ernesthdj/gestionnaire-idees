import { z } from 'zod'
import { CHAT_MESSAGE_MAX } from '@shared/ipc/chat'
import { CLAUDE_MODELS } from '@shared/ipc/ai'
import { PERMISSION_DECISIONS } from '@shared/ipc/chat'
import type { ConversationService } from '../application/conversation/ConversationService'
import type { PermissionService } from '../application/conversation/PermissionService'
import { defineRoute, type IpcRoute } from './registry'

const NeuronInput = z.strictObject({ neuronId: z.uuid() })

/** Canaux du chat d'un neurone (spec 008 contracts/chat.md) ; la réponse de Claude arrive par événements. */
export function createChatRoutes(
  conversations: ConversationService,
  permissions?: Pick<PermissionService, 'decide'>
): IpcRoute[] {
  return [
    ...(permissions === undefined
      ? []
      : [
          // Réponse de mentalyas à une demande de permission de Claude Code (spec 014 US1).
          defineRoute({
            channel: 'chat:permissionDecide',
            input: z.strictObject({ requestId: z.uuid(), decision: z.enum(PERMISSION_DECISIONS) }),
            handler: async ({ requestId, decision }) => {
              permissions.decide(requestId, decision)
              return { ok: true }
            }
          })
        ]),
    // Consommation de l'abonnement, affichée en permanence dans l'en-tête (hors de toute conversation).
    defineRoute({ channel: 'usage:get', input: z.undefined(), handler: async () => conversations.usage() }),
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
      channel: 'chat:setModel',
      input: z.strictObject({ neuronId: z.uuid(), model: z.enum(CLAUDE_MODELS).nullable() }),
      handler: async ({ neuronId, model }) => conversations.setModel(neuronId, model)
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
