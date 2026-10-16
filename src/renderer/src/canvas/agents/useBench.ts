import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import type { BenchAgentView } from '@shared/ipc/assemblies'
import { useUiStore } from '../../app/uiStore'
import { call, IpcFailure } from '../../lib/ipc'

/**
 * Agents posés libres sur la carte d'un projet (L1o D26) : la liste, et les gestes (poser depuis le tiroir, déplacer,
 * retirer). Un refus du main est dit dans une notification ; chaque geste réussi relit la liste.
 */
export function useBench(genesisId: string | null): {
  readonly agents: readonly BenchAgentView[]
  readonly place: (profileId: string, x: number, y: number) => Promise<boolean>
  readonly move: (id: string, x: number, y: number) => Promise<boolean>
  readonly remove: (id: string) => Promise<boolean>
} {
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  const query = useQuery({
    queryKey: ['bench', genesisId],
    queryFn: () => call<BenchAgentView[]>('bench:list', { genesisId }),
    enabled: genesisId !== null
  })
  const attempt = useCallback(
    async (work: () => Promise<unknown>, fallback: string): Promise<boolean> => {
      try {
        await work()
        await client.invalidateQueries({ queryKey: ['bench'] })
        return true
      } catch (error) {
        showToast(error instanceof IpcFailure ? error.message : fallback)
        return false
      }
    },
    [client, showToast]
  )
  return useMemo(
    () => ({
      agents: query.data ?? [],
      place: (profileId, x, y) =>
        genesisId === null
          ? Promise.resolve(false)
          : attempt(() => call('bench:place', { genesisId, profileId, x, y }), 'L’agent n’a pas pu être posé.'),
      move: (id, x, y) => attempt(() => call('bench:move', { id, x, y }), 'L’agent n’a pas pu être déplacé.'),
      remove: (id) => attempt(() => call('bench:remove', { id }), 'L’agent n’a pas pu être retiré.')
    }),
    [attempt, genesisId, query.data]
  )
}
