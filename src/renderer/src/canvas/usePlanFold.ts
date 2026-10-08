import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useUiStore } from '../app/uiStore'
import { call, IpcFailure } from '../lib/ipc'

/**
 * Repli des sous-étapes d'une étape, ou de tout le plan d'un genesis (spec 022 D14) : mémorisé par le main
 * (`plan:setCollapsed`), puis la carte se recharge et les nœuds glissent vers leur nouvelle place.
 */
export function usePlanFold(): (neuronId: string, collapsed: boolean) => Promise<void> {
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  return useCallback(
    async (neuronId, collapsed) => {
      try {
        await call('plan:setCollapsed', { neuronId, collapsed })
        await client.invalidateQueries({ queryKey: ['canvas'] })
      } catch (error) {
        showToast(error instanceof IpcFailure ? error.message : 'Le repli n’a pas pu être enregistré.')
      }
    },
    [client, showToast]
  )
}
