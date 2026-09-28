import { create } from 'zustand'
import type { NavigateEvent, Section } from '@shared/ipc/app'

/** Vue affichée : une section de la navigation, ou les réglages (⚙). */
export type View = Section | 'settings'

interface UiState {
  readonly view: View
  /** Neurone à ouvrir en plongée à l'arrivée sur Idées (capture « plonger maintenant »). */
  readonly diveRootId: string | null
  show(view: View): void
  navigate(event: NavigateEvent): void
  openDive(rootId: string): void
  closeDive(): void
}

/** État d'interface (research R4) : navigation par état, sans routeur. */
export const useUiStore = create<UiState>()((set) => ({
  view: 'ideas',
  diveRootId: null,
  show: (view) => set({ view, diveRootId: null }),
  navigate: ({ section, diveRootId }) => set({ view: section, diveRootId: diveRootId ?? null }),
  openDive: (rootId) => set({ view: 'ideas', diveRootId: rootId }),
  closeDive: () => set({ diveRootId: null })
}))
