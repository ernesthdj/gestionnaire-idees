import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useUiStore } from '../app/uiStore'
import { call, IpcFailure } from '../lib/ipc'

/**
 * Supprime une idée et tout son contenu de la carte (après l'avertissement affiché par l'appelant), referme sa
 * conversation si elle est ouverte, et propose « Annuler » : l'idée n'est qu'archivée, l'historique la restaure.
 */
export function useRemoveIdea(): (idea: { readonly id: string; readonly title: string }) => Promise<boolean> {
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  const closeChat = useUiStore((state) => state.closeChat)
  return useCallback(
    async (idea) => {
      try {
        const { batchId } = await call<{ readonly batchId: string }>('neuron:remove', { rootId: idea.id })
        if (useUiStore.getState().chatNeuronId === idea.id) closeChat()
        showToast(`« ${idea.title} » est supprimée.`, { batchId, undoneText: 'Idée restaurée, avec tout son contenu.' })
        await Promise.all([
          client.invalidateQueries({ queryKey: ['canvas'] }),
          client.invalidateQueries({ queryKey: ['history'] })
        ])
        return true
      } catch (error) {
        showToast(error instanceof IpcFailure ? error.message : 'L’idée n’a pas pu être supprimée.')
        return false
      }
    },
    [client, showToast, closeChat]
  )
}
