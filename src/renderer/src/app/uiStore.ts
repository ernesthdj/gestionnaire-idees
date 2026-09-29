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
  /** Idée ouverte dans le volet de l'écran Idées, son arbre déployé sur la carte (FR-013 révisée). */
  readonly openRootId: string | null
  /** Neurone ciblé dans l'idée ouverte (`null` : l'idée elle-même). */
  readonly focusId: string | null
  show(view: View): void
  navigate(event: NavigateEvent): void
  /** Notification brève (FR-019). */
  readonly toast: Toast | null
  /** Idée qui vient de naître (graine ou double-clic) : elle pousse sur la carte. */
  readonly bornId: string | null
  openIdea(rootId: string): void
  /** Cible un neurone de l'idée ouverte (`null` : l'idée elle-même). */
  focus(neuronId: string | null): void
  closeIdea(): void
  /** Éclosion confirmée : notification avec « Annuler » (lot d'historique) ; l'idée reste ouverte. */
  hatch(text: string, undoBatchId: string): void
  showToast(text: string, undo?: { readonly batchId: string; readonly undoneText: string }): void
  /** Graine acceptée : l'idée née pousse sur la carte, notification avec « Annuler ». */
  bear(rootId: string, text: string, undoBatchId: string): void
  /** Idée créée sur la carte : elle pousse à l'endroit choisi. */
  markBorn(rootId: string): void
  hideToast(): void
}

const nextToast = (current: Toast | null, toast: Omit<Toast, 'id'>): Toast => ({ id: (current?.id ?? 0) + 1, ...toast })

/** État d'interface (research R4) : navigation par état, sans routeur. */
export const useUiStore = create<UiState>()((set) => ({
  view: 'ideas',
  openRootId: null,
  focusId: null,
  toast: null,
  bornId: null,
  show: (view) => set({ view, openRootId: null, focusId: null }),
  navigate: ({ section, diveRootId }) => set({ view: section, openRootId: diveRootId ?? null, focusId: null }),
  openIdea: (rootId) => set({ view: 'ideas', openRootId: rootId, focusId: null }),
  focus: (neuronId) => set({ focusId: neuronId }),
  closeIdea: () => set({ openRootId: null, focusId: null }),
  hatch: (text, undoBatchId) =>
    set((state) => ({
      toast: nextToast(state.toast, {
        text,
        undoBatchId,
        undoneText: 'Éclosion annulée : l’idée est revenue en développement.'
      })
    })),
  showToast: (text, undo) =>
    set((state) => ({
      toast: nextToast(state.toast, {
        text,
        ...(undo === undefined ? {} : { undoBatchId: undo.batchId, undoneText: undo.undoneText })
      })
    })),
  bear: (rootId, text, undoBatchId) =>
    set((state) => ({
      bornId: rootId,
      toast: nextToast(state.toast, {
        text,
        undoBatchId,
        undoneText: 'Naissance annulée : la graine attend de nouveau sur son lien.'
      })
    })),
  markBorn: (rootId) => set({ bornId: rootId }),
  hideToast: () => set({ toast: null })
}))
