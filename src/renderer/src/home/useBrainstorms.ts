import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { BrainstormListItem, BrainstormOpenView, BrainstormView } from '@shared/ipc/brainstorms'
import { useUiStore } from '../app/uiStore'
import { useCards } from '../canvas/cards/cardsStore'
import { call } from '../lib/ipc'
import { viewStateOf } from './viewState'

export const BRAINSTORMS_KEY = ['brainstorms'] as const

/** Écriture de l'état de vue différée (spec 024 R2) : 500 ms après le dernier changement. */
export const VIEW_STATE_DELAY_MS = 500

export function useBrainstormList(): UseQueryResult<BrainstormListItem[]> {
  return useQuery({ queryKey: BRAINSTORMS_KEY, queryFn: () => call<BrainstormListItem[]>('brainstorms:list') })
}

let pending: number | undefined

/** Écrit tout de suite l'état de vue du brainstorm ouvert (avant d'en ouvrir un autre, ou à la fermeture). */
export async function flushViewState(): Promise<void> {
  window.clearTimeout(pending)
  pending = undefined
  const { brainstorm, structureViews, viewport } = useUiStore.getState()
  if (brainstorm === null) return
  const state = viewStateOf(structureViews, useCards.getState().cards, viewport)
  await call('brainstorms:viewState', { id: brainstorm.id, state }).catch(() => undefined)
}

/**
 * Sauvegarde continue de la vue (spec 024 D7) : vues des cartes de projet, cartes ouvertes et cadrage, écrits en
 * différé ; à la fermeture de la fenêtre, écrits tout de suite.
 */
export function useViewStateSync(): void {
  useEffect(() => {
    const schedule = (): void => {
      if (useUiStore.getState().brainstorm === null) return
      window.clearTimeout(pending)
      pending = window.setTimeout(() => void flushViewState(), VIEW_STATE_DELAY_MS)
    }
    const offUi = useUiStore.subscribe((state, before) => {
      if (state.brainstorm !== before.brainstorm) return
      if (state.structureViews !== before.structureViews || state.viewport !== before.viewport) schedule()
    })
    const offCards = useCards.subscribe((state, before) => {
      if (state.cards !== before.cards) schedule()
    })
    const onUnload = (): void => void flushViewState()
    window.addEventListener('beforeunload', onUnload)
    return () => {
      offUi()
      offCards()
      window.removeEventListener('beforeunload', onUnload)
      window.clearTimeout(pending)
    }
  }, [])
}

/** Après un rechargement de l'interface, le brainstorm encore actif dans le main revient. */
export function useActiveBrainstormHydration(): void {
  useEffect(() => {
    let cancelled = false
    void call<BrainstormView | null>('brainstorms:active')
      .then((active) => {
        if (cancelled || active === null || useUiStore.getState().brainstorm !== null) return
        useUiStore.setState({ brainstorm: active })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])
}

/** Ouvre un brainstorm (ou celui d'un projet du registre) : sa carte et sa vue d'avant reviennent. */
export function useOpenBrainstorm(): ReturnType<
  typeof useMutation<BrainstormOpenView, Error, { readonly id: string } | { readonly slug: string }>
> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (target: { readonly id: string } | { readonly slug: string }) => {
      await flushViewState()
      return call<BrainstormOpenView>('brainstorms:open', target)
    },
    onSuccess: (opened) => {
      useUiStore.getState().enterBrainstorm(opened)
      // Tout ce qui est lu de la carte appartient au brainstorm précédent : on relit tout.
      void client.invalidateQueries()
    }
  })
}
