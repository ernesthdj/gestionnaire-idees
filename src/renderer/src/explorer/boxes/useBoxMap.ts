import { useQuery } from '@tanstack/react-query'
import type { ExplorerMapView } from '@shared/ipc/reprise'
import { call } from '../../lib/ipc'

/**
 * Toute la carte en boîtes d'un projet repris (spec 031 FR-001), relue avec le reste de l'explorateur quand l'analyse
 * ou une correction change le graphe (`['explorer', genesisId]`, voir `useExplorer`).
 */
export function useBoxMap(genesisId: string): ReturnType<typeof useQuery<ExplorerMapView>> {
  return useQuery({
    queryKey: ['explorer', genesisId, 'map'],
    queryFn: () => call<ExplorerMapView>('explorer:map', { genesisId })
  })
}
