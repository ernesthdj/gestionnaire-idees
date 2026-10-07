import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { ProbeScreen } from '@shared/analyste/events'
import type { AnalysteStatusView } from '@shared/ipc/analyste'
import { useUiStore, type View } from '../app/uiStore'
import { call } from '../lib/ipc'
import { enableProbe, listenToErrors, probeScreen } from './probe'

export const ANALYSTE_STATUS_KEY = ['analyste', 'status'] as const

/** Requête du statut de la sonde (spec 019 US1) : disponible, active, raison d'une pause. */
export function useAnalysteStatusQuery(): UseQueryResult<AnalysteStatusView> {
  return useQuery({
    queryKey: ANALYSTE_STATUS_KEY,
    queryFn: () => call<AnalysteStatusView>('analyste:repo:status'),
    staleTime: 60_000
  })
}

export function useAnalysteStatus(): AnalysteStatusView | undefined {
  return useAnalysteStatusQuery().data
}

const SCREEN_OF: Readonly<Record<View, ProbeScreen>> = {
  ideas: 'carte',
  pending: 'a_valider',
  history: 'historique',
  analyste: 'analyste',
  settings: 'reglages'
}

/** Ouvre un écran pendant que `open` est vrai ; sa fermeture enregistre la durée. */
function useScreen(screen: ProbeScreen, open: boolean, active: boolean): void {
  useEffect(() => {
    if (!active || !open) return
    probeScreen(screen, true)
    return () => probeScreen(screen, false)
  }, [screen, open, active])
}

/** Branche la sonde de l'interface quand le main la déclare active : erreurs globales et navigation. */
export function useProbe(): void {
  const active = useAnalysteStatus()?.active === true
  const view = useUiStore((state) => state.view)
  const chatOpen = useUiStore((state) => state.chatNeuronId !== null)
  const explorerOpen = useUiStore((state) => state.explorerGenesisId !== null)

  useEffect(() => {
    enableProbe(active)
    if (!active) return
    const stop = listenToErrors()
    return () => {
      stop()
      enableProbe(false)
    }
  }, [active])

  useScreen(SCREEN_OF[view], true, active)
  useScreen('chat', chatOpen, active)
  useScreen('explorateur', explorerOpen, active)
}
