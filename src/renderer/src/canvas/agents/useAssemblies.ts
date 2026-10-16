import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import type { ApprovalResult } from '@shared/agents/pipeline'
import type { AgentProfileView } from '@shared/agents/profile'
import type { AssemblyRunView, AssemblySketchView } from '@shared/ipc/assemblies'
import { useUiStore } from '../../app/uiStore'
import { call, IpcFailure } from '../../lib/ipc'

const NONE: readonly never[] = []

/** Ce que la carte sait des agents : croquis des nœuds, assemblages (en cours ou finis) et profils. */
export function useAssemblyData(): {
  readonly sketches: readonly AssemblySketchView[]
  readonly runs: readonly AssemblyRunView[]
  readonly profiles: readonly AgentProfileView[]
} {
  const sketches = useQuery({
    queryKey: ['assembly', 'sketches'],
    queryFn: () => call<AssemblySketchView[]>('assembly:sketches', {})
  })
  const runs = useQuery({
    queryKey: ['assembly', 'runs'],
    queryFn: () => call<AssemblyRunView[]>('assembly:list', {})
  })
  const profiles = useQuery({ queryKey: ['agentProfiles'], queryFn: () => call<AgentProfileView[]>('agents:list', {}) })
  // Même objet tant que les données ne changent pas : la carte s'en sert comme dépendance de son graphe, un objet neuf
  // à chaque rendu la referait sans fin (« Maximum update depth exceeded »).
  return useMemo(
    () => ({ sketches: sketches.data ?? NONE, runs: runs.data ?? NONE, profiles: profiles.data ?? NONE }),
    [sketches.data, runs.data, profiles.data]
  )
}

/** Corps d'une demande d'assemblage : ce que le main attend d'un croquis (le contexte vient du nœud). */
const requestOf = (sketch: AssemblySketchView, baseBranch?: string): Record<string, unknown> => ({
  nodeId: sketch.nodeId,
  taskId: sketch.taskId,
  ...(sketch.task === undefined ? {} : { task: sketch.task }),
  agents: sketch.agents,
  links: sketch.links,
  ...(baseBranch === undefined || baseBranch === '' ? {} : { baseBranch })
})

/**
 * Gestes de mentalyas sur les agents d'un nœud : modifier le croquis, lancer, arrêter, donner l'accord de fusion. Un
 * refus du main est dit tel quel dans une notification ; chaque geste réussi relit le suivi.
 */
export function useAssemblyActions(): {
  readonly save: (sketch: AssemblySketchView) => Promise<boolean>
  readonly clear: (nodeId: string) => Promise<boolean>
  readonly warnings: (sketch: AssemblySketchView, baseBranch?: string) => Promise<string[] | null>
  readonly start: (sketch: AssemblySketchView, baseBranch?: string) => Promise<boolean>
  readonly cancel: (genesisId: string, taskId: string) => Promise<boolean>
  readonly approve: (genesisId: string, taskId: string) => Promise<ApprovalResult | null>
} {
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  const attempt = useCallback(
    async <T>(work: () => Promise<T>, fallback: string): Promise<T | null> => {
      try {
        const result = await work()
        await client.invalidateQueries({ queryKey: ['assembly'] })
        return result
      } catch (error) {
        showToast(error instanceof IpcFailure ? error.message : fallback)
        return null
      }
    },
    [client, showToast]
  )
  return useMemo(
    () => ({
      save: async (sketch) =>
        (await attempt(
          () => call('assembly:sketchSave', requestOf(sketch)),
          'Les agents n’ont pas pu être enregistrés.'
        )) !== null,
      clear: async (nodeId) =>
        (await attempt(() => call('assembly:sketchClear', { nodeId }), 'Les agents n’ont pas pu être retirés.')) !==
        null,
      warnings: (sketch, baseBranch) =>
        attempt(
          () => call<string[]>('assembly:warnings', requestOf(sketch, baseBranch)),
          'L’assemblage n’a pas pu être vérifié.'
        ),
      start: async (sketch, baseBranch) =>
        (await attempt(
          () => call('assembly:start', requestOf(sketch, baseBranch)),
          'L’assemblage n’a pas pu démarrer.'
        )) !== null,
      cancel: async (genesisId, taskId) =>
        (await attempt(
          () => call('assembly:cancel', { genesisId, taskId }),
          'L’assemblage n’a pas pu être arrêté.'
        )) !== null,
      approve: (genesisId, taskId) =>
        attempt(
          () => call<ApprovalResult>('assembly:approve', { genesisId, taskId, confirm: true }),
          'La fusion n’a pas pu être faite.'
        )
    }),
    [attempt]
  )
}
