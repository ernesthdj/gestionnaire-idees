import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useUiStore } from '../app/uiStore'
import { call, IpcFailure } from '../lib/ipc'

/** Libellé court d'un lien (1 à 3 mots en pratique) : même borne que le moteur. */
export const LINK_LABEL_MAX = 40

/**
 * Relie deux idées (FR-031) et rafraîchit la carte ; l'IA cherche ensuite, en arrière-plan, une graine sur ce lien
 * (FR-028). Renvoie `true` si le lien a été créé ; sinon la raison est annoncée par une notification.
 */
export function useCreateLink(): (input: { aRootId: string; bRootId: string; label: string }) => Promise<boolean> {
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  return useCallback(
    async (input) => {
      try {
        await call('links:create', { ...input, label: input.label.trim() })
        await Promise.all([
          client.invalidateQueries({ queryKey: ['canvas'] }),
          client.invalidateQueries({ queryKey: ['history'] })
        ])
        return true
      } catch (error) {
        showToast(
          error instanceof IpcFailure && error.code === 'DUPLICATE'
            ? 'Ces deux idées sont déjà reliées par ce lien.'
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
