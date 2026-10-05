import { McpToolError } from '../../domain/mcp/errors'
import type { McpCaller } from '../../domain/mcp/caller'
import type {
  ConversationNeuron,
  ConversationRepository
} from '../../infrastructure/db/repositories/ConversationRepository'

/** Arbre d'un neurone : un projet = un genesis et ses éléments ou étapes ; une idée = sa racine et son arbre. */
const treeOf = (row: ConversationNeuron): string => row.genesisId ?? row.rootId

/**
 * Neurone visé par un outil du pont (spec 008 FR-014) : `id` fourni, sinon celui de la conversation ; toujours dans
 * l'arbre de la conversation.
 */
export function conversationTarget(
  conversations: Pick<ConversationRepository, 'neuron'>,
  id: string | undefined,
  caller: McpCaller,
  writing = false
): ConversationNeuron {
  const targetId = id ?? caller.neuronId
  if (targetId === null) {
    throw new McpToolError('ENTREE_INVALIDE', 'id requis : cette session n’est pas la conversation d’un neurone.')
  }
  const neuron = conversations.neuron(targetId)
  if (neuron === undefined || neuron.state === 'archived') {
    throw new McpToolError('INTROUVABLE', `Neurone ${targetId} introuvable (retiré ou annulé ?)`)
  }
  if (caller.neuronId !== null && id !== undefined) {
    const own = conversations.neuron(caller.neuronId)
    if (own === undefined || treeOf(own) !== treeOf(neuron)) {
      throw new McpToolError(
        'NON_MODIFIABLE',
        'Ce neurone appartient à un autre arbre que celui de cette conversation.'
      )
    }
  }
  if (writing && neuron.absorbed) throw new McpToolError('NON_MODIFIABLE', 'Ce neurone a été absorbé par une éclosion.')
  return neuron
}
