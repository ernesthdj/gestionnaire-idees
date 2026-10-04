import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { SECTIONS, type NavigateEvent } from '@shared/ipc/app'
import type { MainWindowEvent } from '@shared/ipc/channels'
import type { MapChangedPayload } from '@shared/ipc/mcp'
import { useUiStore } from './uiStore'

/**
 * Données à rafraîchir quand le moteur de neurones (002) annonce un changement. Les clés correspondent aux
 * requêtes des écrans (Idées, plongée, À valider) ; une clé sans requête active est simplement ignorée.
 */
const INVALIDATIONS: ReadonlyArray<readonly [MainWindowEvent, readonly (readonly string[])[]]> = [
  ['neuron:created', [['canvas'], ['dive'], ['history']]],
  ['neuron:thought', [['canvas'], ['dive']]],
  ['synthesis:stale', [['dive'], ['pending']]],
  ['suggestion:updated', [['dive']]],
  ['links:suggested', [['canvas'], ['pending'], ['history']]],
  ['seeds:suggested', [['canvas'], ['seeds']]],
  // Écriture de Claude Code par le pont MCP (spec 007) : la carte et l'Historique changent.
  ['map:changed', [['canvas'], ['history'], ['widgetIo'], ['widgetInputs']]]
]

function isMapChanged(payload: unknown): payload is MapChangedPayload {
  if (typeof payload !== 'object' || payload === null) return false
  const { batchId, summary } = payload as Record<string, unknown>
  return typeof batchId === 'string' && typeof summary === 'string'
}

function isNavigateEvent(payload: unknown): payload is NavigateEvent {
  if (typeof payload !== 'object' || payload === null || !('section' in payload)) return false
  const { section } = payload
  const diveRootId = 'diveRootId' in payload ? payload.diveRootId : undefined
  return (
    typeof section === 'string' &&
    (SECTIONS as readonly string[]).includes(section) &&
    (diveRootId === undefined || typeof diveRootId === 'string')
  )
}

/** Abonnements de la fenêtre principale aux événements du main (navigation, invalidation des données). */
export function useMainEvents(): void {
  const client = useQueryClient()
  const navigate = useUiStore((state) => state.navigate)
  const showToast = useUiStore((state) => state.showToast)

  useEffect(() => {
    const unsubscribes = INVALIDATIONS.map(([event, keys]) =>
      window.api.on(event, () => {
        for (const queryKey of keys) void client.invalidateQueries({ queryKey })
      })
    )
    unsubscribes.push(
      window.api.on('app:navigate', (payload) => {
        if (isNavigateEvent(payload)) navigate(payload)
      })
    )
    // Toute écriture de Claude se signale et s'annule d'un geste (FR-014).
    unsubscribes.push(
      window.api.on('map:changed', (payload) => {
        if (isMapChanged(payload)) {
          showToast(payload.summary, {
            batchId: payload.batchId,
            undoneText: 'Annulé : la carte revient à l’état d’avant.'
          })
        }
      })
    )
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe())
  }, [client, navigate, showToast])
}
