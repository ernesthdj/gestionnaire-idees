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
  /** Idée qui vient d'éclore : l'écran Idées la fait migrer de l'incubateur vers le réseau. */
  readonly hatchedId: string | null
  /** Notification brève (FR-019). */
  readonly toast: { readonly id: number; readonly text: string } | null
  openDive(rootId: string): void
  closeDive(): void
  hatch(rootId: string, text: string): void
  clearHatched(): void
  hideToast(): void
}

/** État d'interface (research R4) : navigation par état, sans routeur. */
export const useUiStore = create<UiState>()((set) => ({
  view: 'ideas',
  diveRootId: null,
  hatchedId: null,
  toast: null,
  show: (view) => set({ view, diveRootId: null }),
  navigate: ({ section, diveRootId }) => set({ view: section, diveRootId: diveRootId ?? null }),
  openDive: (rootId) => set({ view: 'ideas', diveRootId: rootId }),
  closeDive: () => set({ diveRootId: null }),
  hatch: (rootId, text) =>
    set((state) => ({ diveRootId: null, hatchedId: rootId, toast: { id: (state.toast?.id ?? 0) + 1, text } })),
  clearHatched: () => set({ hatchedId: null }),
  hideToast: () => set({ toast: null })
}))
