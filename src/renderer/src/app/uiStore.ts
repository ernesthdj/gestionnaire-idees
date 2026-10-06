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
  /** Neurone dont la conversation Claude Code est ouverte dans le volet (spec 008). */
  readonly chatNeuronId: string | null
  /** Étape proposée par Claude (fantôme, spec 011) consultée dans le volet avant d'être décidée. */
  readonly ghostId: string | null
  openGhost(ghostId: string): void
  closeGhost(): void
  /** Action finale (proposée ou acceptée, spec 013) lue dans le volet. */
  readonly finalId: string | null
  openFinal(neuronId: string): void
  closeFinal(): void
  openChat(neuronId: string): void
  closeChat(): void
  show(view: View): void
  navigate(event: NavigateEvent): void
  /** Notification brève (FR-019). */
  readonly toast: Toast | null
  /** Idée qui vient de naître (double-clic, capture) : elle pousse sur la carte. */
  readonly bornId: string | null
  showToast(text: string, undo?: { readonly batchId: string; readonly undoneText: string }): void
  /** Idée créée sur la carte : elle pousse à l'endroit choisi. */
  markBorn(rootId: string): void
  hideToast(): void
}

const nextToast = (current: Toast | null, toast: Omit<Toast, 'id'>): Toast => ({ id: (current?.id ?? 0) + 1, ...toast })

/** État d'interface (research R4) : navigation par état, sans routeur. */
export const useUiStore = create<UiState>()((set) => ({
  view: 'ideas',
  chatNeuronId: null,
  ghostId: null,
  finalId: null,
  toast: null,
  bornId: null,
  show: (view) => set({ view, chatNeuronId: null, ghostId: null, finalId: null }),
  // Une idée capturée s'ouvre directement sur sa conversation (spec 010 US2).
  navigate: ({ section, diveRootId }) => set({ view: section, chatNeuronId: diveRootId ?? null }),
  openChat: (neuronId) => set({ view: 'ideas', chatNeuronId: neuronId, ghostId: null, finalId: null }),
  closeChat: () => set({ chatNeuronId: null }),
  openGhost: (ghostId) => set({ view: 'ideas', ghostId, chatNeuronId: null, finalId: null }),
  closeGhost: () => set({ ghostId: null }),
  openFinal: (neuronId) => set({ view: 'ideas', finalId: neuronId, chatNeuronId: null, ghostId: null }),
  closeFinal: () => set({ finalId: null }),
  showToast: (text, undo) =>
    set((state) => ({
      toast: nextToast(state.toast, {
        text,
        ...(undo === undefined ? {} : { undoBatchId: undo.batchId, undoneText: undo.undoneText })
      })
    })),
  markBorn: (rootId) => set({ bornId: rootId }),
  hideToast: () => set({ toast: null })
}))
