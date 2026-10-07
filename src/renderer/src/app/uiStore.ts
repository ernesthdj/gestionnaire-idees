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

/** Lecture d'une carte de structure (spec 017 D20). */
export type StructureView = 'progression' | 'architecture'

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
  /** Fichier du livrable d'une action finale lu dans la visionneuse (spec 013 D4). */
  readonly viewer: { readonly neuronId: string; readonly path: string } | null
  openViewer(neuronId: string, path: string): void
  closeViewer(): void
  /** Vue de chaque carte de structure (spec 017 D20) : « architecture » une fois basculée, « progression » sinon. */
  readonly structureViews: Readonly<Record<string, StructureView>>
  setStructureView(genesisId: string, view: StructureView): void
  /** Projet repris dont l'explorateur est ouvert en plein écran (spec 017 US2) ; `null` : aucun. */
  readonly explorerGenesisId: string | null
  openExplorer(genesisId: string): void
  closeExplorer(): void
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
  viewer: null,
  toast: null,
  bornId: null,
  show: (view) => set({ view, chatNeuronId: null, ghostId: null, finalId: null, viewer: null }),
  // Une idée capturée s'ouvre directement sur sa conversation (spec 010 US2).
  navigate: ({ section, diveRootId }) => set({ view: section, chatNeuronId: diveRootId ?? null, viewer: null }),
  openChat: (neuronId) => set({ view: 'ideas', chatNeuronId: neuronId, ghostId: null, finalId: null, viewer: null }),
  closeChat: () => set({ chatNeuronId: null }),
  openGhost: (ghostId) => set({ view: 'ideas', ghostId, chatNeuronId: null, finalId: null, viewer: null }),
  closeGhost: () => set({ ghostId: null }),
  openFinal: (neuronId) => set({ view: 'ideas', finalId: neuronId, chatNeuronId: null, ghostId: null, viewer: null }),
  closeFinal: () => set({ finalId: null }),
  openViewer: (neuronId, path) =>
    set({ view: 'ideas', viewer: { neuronId, path }, chatNeuronId: null, ghostId: null, finalId: null }),
  closeViewer: () => set({ viewer: null }),
  explorerGenesisId: null,
  structureViews: {},
  setStructureView: (genesisId, view) =>
    set((state) => ({ structureViews: { ...state.structureViews, [genesisId]: view } })),
  openExplorer: (genesisId) => set({ view: 'ideas', explorerGenesisId: genesisId }),
  closeExplorer: () => set({ explorerGenesisId: null }),
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
