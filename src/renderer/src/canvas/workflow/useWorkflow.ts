import { useQueries, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'
import type { WorkflowView } from '@shared/ipc/workflow'
import { call, IpcFailure } from '../../lib/ipc'
import { watchRunningChats } from './runningChats'
import type { WorkflowEntry } from './workflowTree'

/**
 * Vues Workflow des projets liés basculés en Workflow (spec 023 D10) : lues à l'ouverture de la vue, puis relues à
 * chaque fin de tour de Claude (il a pu cocher une case) et sur « Relire ». Rien n'est lu pour les autres projets.
 * Les tours en cours sont suivis pour allumer « en cours » la tâche dont la conversation tourne (D21).
 */
export function useWorkflows(genesisIds: readonly string[]): Readonly<Record<string, WorkflowEntry>> {
  const client = useQueryClient()
  const watching = genesisIds.length > 0
  useEffect(() => {
    if (!watching) return undefined
    const offRunning = watchRunningChats()
    const offTurn = window.api.on('chat:turnEnd', () => void client.invalidateQueries({ queryKey: ['workflow'] }))
    return () => {
      offRunning()
      offTurn()
    }
  }, [client, watching])
  // `combine` stable : le même objet est rendu tant que les données et erreurs reçues ne changent pas (la carte ne se
  // reconstruit pas à chaque rendu).
  const key = genesisIds.join(',')
  const combine = useCallback(
    (results: readonly UseQueryResult<WorkflowView>[]) => {
      const ids = key === '' ? [] : key.split(',')
      const entries: Record<string, WorkflowEntry> = {}
      results.forEach((result, index) => {
        const genesisId = ids[index]
        if (genesisId === undefined) return
        if (result.data !== undefined) entries[genesisId] = { view: result.data }
        else if (result.error !== null) {
          entries[genesisId] = {
            error: result.error instanceof IpcFailure ? result.error.message : 'La vue Workflow n’a pas pu être lue.'
          }
        }
      })
      return entries as Readonly<Record<string, WorkflowEntry>>
    },
    [key]
  )
  return useQueries({
    queries: genesisIds.map((genesisId) => ({
      queryKey: ['workflow', genesisId],
      queryFn: () => call<WorkflowView>('workflow:read', { genesisId }),
      retry: false
    })),
    combine
  })
}
