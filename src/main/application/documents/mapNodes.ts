import type { ConversationRepository } from '../../infrastructure/db/repositories/ConversationRepository'

/**
 * Nœuds vivants de la carte qui reçoivent des documents (spec 028 D1) : genesis, étape, élément de carte de structure,
 * conversation d'un nœud Workflow — avec le genesis dont ils prennent le dossier de projet.
 */
export function mapNodes(conversations: Pick<ConversationRepository, 'neuron'>): {
  node(id: string): { readonly id: string; readonly genesisId: string } | undefined
} {
  return {
    node: (id) => {
      const neuron = conversations.neuron(id)
      if (neuron === undefined || neuron.state === 'archived') return undefined
      const genesisId = neuron.kind === 'root' ? neuron.id : neuron.genesisId
      return genesisId === null ? undefined : { id: neuron.id, genesisId }
    }
  }
}
