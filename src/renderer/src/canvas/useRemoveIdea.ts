import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useUiStore } from '../app/uiStore'
import { call, IpcFailure } from '../lib/ipc'
import { probeAction } from '../analyste/probe'

type Idea = { readonly id: string; readonly title: string }

/**
 * Supprime une ou plusieurs idées et tout leur contenu de la carte (après l'avertissement affiché par l'appelant),
 * referme la conversation ouverte de l'une d'elles, et propose « Annuler » : les idées ne sont qu'archivées, et un seul
 * lot d'historique les restaure toutes.
 */
export function useRemoveIdeas(): (ideas: readonly Idea[], via?: 'souris' | 'clavier') => Promise<boolean> {
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  const closeChat = useUiStore((state) => state.closeChat)
  return useCallback(
    async (ideas, via = 'souris') => {
      const [first] = ideas
      if (first === undefined) return false
      try {
        const { batchId } =
          ideas.length === 1
            ? await call<{ readonly batchId: string }>('neuron:remove', { rootId: first.id })
            : await call<{ readonly batchId: string }>('neuron:removeMany', { rootIds: ideas.map((idea) => idea.id) })
        for (const idea of ideas) probeAction('neuron.remove', 'neuron', via, idea.id)
        const chatId = useUiStore.getState().chatNeuronId
        if (ideas.some((idea) => idea.id === chatId)) closeChat()
        showToast(ideas.length === 1 ? `« ${first.title} » est supprimée.` : `${ideas.length} idées supprimées.`, {
          batchId,
          undoneText:
            ideas.length === 1 ? 'Idée restaurée, avec tout son contenu.' : 'Idées restaurées, avec tout leur contenu.'
        })
        await Promise.all([
          client.invalidateQueries({ queryKey: ['canvas'] }),
          client.invalidateQueries({ queryKey: ['history'] })
        ])
        return true
      } catch (error) {
        showToast(
          error instanceof IpcFailure
            ? error.message
            : ideas.length === 1
              ? 'L’idée n’a pas pu être supprimée.'
              : 'Les idées n’ont pas pu être supprimées.'
        )
        return false
      }
    },
    [client, showToast, closeChat]
  )
}

/** Une seule idée (menu de l'idée). */
export function useRemoveIdea(): (idea: Idea) => Promise<boolean> {
  const removeIdeas = useRemoveIdeas()
  return useCallback((idea) => removeIdeas([idea]), [removeIdeas])
}
