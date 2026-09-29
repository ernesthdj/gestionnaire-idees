import { create } from 'zustand'
import type { NavigateEvent, Section } from '@shared/ipc/app'

export interface Toast {
  readonly id: number
  readonly text: string
  /** Lot d'historique que le bouton « Annuler » de la notification défait. */
  readonly undoBatchId?: string
  /** Message affiché une fois l'annulation faite. */
  readonly undoneText?: string
}

/** Vue affichée : une section de la navigation, ou les réglages (⚙). */
export type View = Section | 'settings'

interface UiState {
  readonly view: View
  /** Neurone à ouvrir en plongée à l'arrivée sur Idées (capture « plonger maintenant »). */
  readonly diveRootId: string | null
  show(view: View): void
  navigate(event: NavigateEvent): void
  /** Notification brève (FR-019). */
  readonly toast: Toast | null
  /** Idée qui vient de naître (graine ou double-clic) : elle pousse sur la carte. */
  readonly bornId: string | null
  openDive(rootId: string): void
  closeDive(): void
  /** Éclosion confirmée : retour à la carte et notification avec « Annuler » (lot d'historique). */
  hatch(rootId: string, text: string, undoBatchId: string): void
  showToast(text: string, undo?: { readonly batchId: string; readonly undoneText: string }): void
  /** Graine acceptée : l'idée née pousse sur la carte, notification avec « Annuler ». */
  bear(rootId: string, text: string, undoBatchId: string): void
  /** Idée créée sur la carte : elle pousse à l'endroit choisi. */
  markBorn(rootId: string): void
  hideToast(): void
}

/** État d'interface (research R4) : navigation par état, sans routeur. */
export const useUiStore = create<UiState>()((set) => ({
  view: 'ideas',
  diveRootId: null,
  toast: null,
  bornId: null,
  show: (view) => set({ view, diveRootId: null }),
  navigate: ({ section, diveRootId }) => set({ view: section, diveRootId: diveRootId ?? null }),
  openDive: (rootId) => set({ view: 'ideas', diveRootId: rootId }),
  closeDive: () => set({ diveRootId: null }),
  hatch: (rootId, text, undoBatchId) =>
    set((state) => ({
      diveRootId: null,
      toast: {
        id: (state.toast?.id ?? 0) + 1,
        text,
        undoBatchId,
        undoneText: 'Éclosion annulée : l’idée est revenue en développement.'
      }
    })),
  showToast: (text, undo) =>
    set((state) => ({
      toast: {
        id: (state.toast?.id ?? 0) + 1,
        text,
        ...(undo === undefined ? {} : { undoBatchId: undo.batchId, undoneText: undo.undoneText })
      }
    })),
  bear: (rootId, text, undoBatchId) =>
    set((state) => ({
      bornId: rootId,
      toast: {
        id: (state.toast?.id ?? 0) + 1,
        text,
        undoBatchId,
        undoneText: 'Naissance annulée : la graine attend de nouveau sur son lien.'
      }
    })),
  markBorn: (rootId) => set({ bornId: rootId }),
  hideToast: () => set({ toast: null })
}))
