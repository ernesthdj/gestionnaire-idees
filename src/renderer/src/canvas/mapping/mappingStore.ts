import { useEffect } from 'react'
import { create } from 'zustand'
import type { ChatErrorEvent, ChatTurnEndEvent } from '@shared/ipc/chat'
import { useUiStore } from '../../app/uiStore'

/**
 * Cartographie d'un projet par Claude (« Cartographier ce projet », spec 009 / 022) : en cours, terminée ou
 * interrompue, par genesis. L'orbe de l'idée l'affiche (anneau qui balaie, puis coche) ; la fin est suivie dans toute
 * l'app, que la carte de discussion soit ouverte ou non.
 */

export type MappingPhase = 'running' | 'done' | 'failed'

/** Durée d'affichage de « terminée » / « interrompue » avant que l'orbe redevienne normal. */
export const MAPPING_DONE_MS = 6000

interface MappingState {
  readonly phases: Readonly<Record<string, MappingPhase>>
  start(neuronId: string): void
  finish(neuronId: string, ok: boolean): void
  clear(neuronId: string): void
}

export const useMapping = create<MappingState>()((set, get) => ({
  phases: {},
  start: (neuronId) => set((state) => ({ phases: { ...state.phases, [neuronId]: 'running' } })),
  finish: (neuronId, ok) => {
    if (get().phases[neuronId] !== 'running') return
    set((state) => ({ phases: { ...state.phases, [neuronId]: ok ? 'done' : 'failed' } }))
    setTimeout(() => {
      if (get().phases[neuronId] !== 'running') get().clear(neuronId)
    }, MAPPING_DONE_MS)
  },
  clear: (neuronId) =>
    set((state) => ({
      phases: Object.fromEntries(Object.entries(state.phases).filter(([id]) => id !== neuronId))
    }))
}))

const neuronOf = (payload: unknown): string | null =>
  typeof payload === 'object' && payload !== null && 'neuronId' in payload && typeof payload.neuronId === 'string'
    ? payload.neuronId
    : null

/** Suit la fin des cartographies en cours (fin de tour ou erreur de la conversation) et l'annonce. */
export function useMappingWatch(): void {
  useEffect(() => {
    const end = (payload: unknown, ok: boolean): void => {
      const neuronId = neuronOf(payload)
      if (neuronId === null || useMapping.getState().phases[neuronId] !== 'running') return
      useMapping.getState().finish(neuronId, ok)
      useUiStore
        .getState()
        .showToast(ok ? 'Cartographie terminée : la carte de structure est à jour.' : 'Cartographie interrompue.')
    }
    const stops = [
      window.api.on('chat:turnEnd', (payload) => end(payload, !(payload as ChatTurnEndEvent).interrupted)),
      window.api.on('chat:error', (payload: unknown) => end(payload as ChatErrorEvent, false))
    ]
    return () => {
      for (const stop of stops) stop()
    }
  }, [])
}
