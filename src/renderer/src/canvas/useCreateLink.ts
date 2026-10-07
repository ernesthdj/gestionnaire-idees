import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useUiStore } from '../app/uiStore'
import { call, IpcFailure } from '../lib/ipc'
import { probeAction } from '../analyste/probe'

/**
 * Relie deux idées (FR-031, libellé facultatif) par un lien libre de la carte (spec 010), annulable, et rafraîchit
 * la carte. Renvoie `true` si le lien a été créé ; sinon la raison est annoncée par une notification.
 */
export function useCreateLink(): (input: { aRootId: string; bRootId: string; label: string }) => Promise<boolean> {
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  return useCallback(
    async (input) => {
      try {
        await call('canvas:createLink', { ...input, label: input.label.trim() })
        probeAction('link.create', 'link', 'souris')
        await Promise.all([
          client.invalidateQueries({ queryKey: ['canvas'] }),
          client.invalidateQueries({ queryKey: ['history'] })
        ])
        return true
      } catch (error) {
        showToast(
          error instanceof IpcFailure && error.code === 'DUPLICATE'
            ? 'Ces deux idées sont déjà reliées.'
            : error instanceof IpcFailure
              ? error.message
              : 'Le lien n’a pas pu être créé.'
        )
        return false
      }
    },
    [client, showToast]
  )
}
