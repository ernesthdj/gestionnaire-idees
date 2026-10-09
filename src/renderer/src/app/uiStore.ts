import { create } from 'zustand'
import type { NavigateEvent, Section } from '@shared/ipc/app'
import type { BrainstormOpenView, BrainstormView, HubAnomaly } from '@shared/ipc/brainstorms'
import type { ViewState } from '@shared/brainstorms/viewState'
import { useCards, type CardsState } from '../canvas/cards/cardsStore'
import { cardsOf } from '../home/viewState'
import { deliverableNodeId, ghostNodeId } from '../canvas/planLayout'

export interface Toast {
  readonly id: number
  readonly text: string
  /** Lot d'historique que le bouton « Annuler » de la notification défait. */
  readonly undoBatchId?: string
  /** Message affiché une fois l'annulation faite. */
  readonly undoneText?: string
}

/** Lecture d'une carte de structure (spec 017 D20). */
/** Lecture d'une carte de projet lié : Workflow (spec 023), Progression ou Architecture (spec 017 D20). */
export type StructureView = 'workflow' | 'progression' | 'architecture'

/** Vue affichée : une section de la navigation, ou les réglages (⚙). */
export type View = Section | 'settings'

export type Viewport = NonNullable<ViewState['viewport']>

interface UiState {
  readonly view: View
  /** Brainstorm ouvert (spec 024) : son canevas est la carte ; `null` : le Project Manager s'affiche. */
  readonly brainstorm: BrainstormView | null
  /** Ce que `/hub work` signale à l'ouverture (anomalies, JOURNAL), jusqu'à ce que mentalyas le referme. */
  readonly openSummary: { readonly anomalies: readonly HubAnomaly[]; readonly journal: readonly string[] } | null
  /** Cadrage courant de la carte (écrit dans l'état de vue) et cadrage à rétablir une fois à l'ouverture. */
  readonly viewport: Viewport | null
  readonly restoredViewport: Viewport | null
  /** Entre dans un brainstorm : sa vue d'avant revient (vues des cartes de projet, cartes ouvertes, cadrage). */
  enterBrainstorm(opened: BrainstormOpenView): void
  dismissSummary(): void
  setViewport(viewport: Viewport): void
  takeRestoredViewport(): Viewport | null
  /**
   * Neurone dont la conversation est ouverte (spec 008) : la carte active si sa discussion est ouverte, sinon la plus
   * haute dont la discussion l'est (spec 022 : une discussion par carte de détails) ; `null` sans discussion.
   */
  readonly chatNeuronId: string | null
  /** Étape proposée par Claude (fantôme, spec 011) : sa carte s'ouvre sur son détail (fiche). */
  openGhost(ghostId: string): void
  /** Action finale (spec 013) : la carte de l'étape s'ouvre sur sa fiche. */
  openFinal(neuronId: string): void
  /** Fichier du livrable d'une action finale (spec 013 D4) : lu dans le lecteur de la carte du livrable. */
  openViewer(neuronId: string, path: string): void
  /** Vue de chaque carte de structure (spec 017 D20) : « architecture » une fois basculée, « progression » sinon. */
  readonly structureViews: Readonly<Record<string, StructureView>>
  /** Liens d'analyse des cartes de structure affichés au repos (spec 022 D29) ; masqués par défaut (allège la carte). */
  readonly analysisLinks: boolean
  toggleAnalysisLinks(): void
  /**
   * Consignes pré-remplies dans le champ d'une conversation (spec 023 : « Discuter » sur une tâche), par clé (le neurone,
   * ou la carte qui affiche la conversation) ; la conversation la reprend une fois, puis l'efface. Jamais envoyée sans
   * geste de mentalyas.
   */
  readonly chatDrafts: Readonly<Record<string, string>>
  seedChatDraft(neuronId: string, text: string): void
  takeChatDraft(neuronId: string): void
  setStructureView(genesisId: string, view: StructureView): void
  /** Projet repris dont l'explorateur est ouvert en plein écran (spec 017 US2) ; `null` : aucun. */
  readonly explorerGenesisId: string | null
  openExplorer(genesisId: string): void
  closeExplorer(): void
  /** Projet dont le volet Dépôt est ouvert à côté de la carte (spec 021 US1) ; `null` : aucun. */
  readonly repoGenesisId: string | null
  openRepo(genesisId: string): void
  closeRepo(): void
  /** Ouvre la carte du neurone sur sa discussion (menu, Entrée, historique, exécution d'une action…). */
  openChat(neuronId: string): void
  /** Replie la discussion ouverte (`chatNeuronId`). */
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
/** Discussion ouverte d'après les cartes : l'active si sa discussion est ouverte, sinon la plus haute. */
export function chatOf(cards: CardsState): string | null {
  const chats = cards.cards.filter((card) => card.side === 'chat')
  if (chats.some((card) => card.id === cards.activeId)) return cards.activeId
  return (
    chats.reduce<(typeof chats)[number] | null>((top, card) => (top === null || card.z > top.z ? card : top), null)
      ?.id ?? null
  )
}

export const useUiStore = create<UiState>()((set, get) => ({
  view: 'home',
  brainstorm: null,
  openSummary: null,
  viewport: null,
  restoredViewport: null,
  enterBrainstorm: (opened) => {
    const state = opened.viewState
    useCards.setState(cardsOf(state))
    set({
      brainstorm: opened.brainstorm,
      openSummary:
        opened.anomalies.length === 0 && opened.journal.length === 0
          ? null
          : { anomalies: opened.anomalies, journal: opened.journal },
      structureViews: state?.structureViews ?? {},
      viewport: state?.viewport ?? null,
      restoredViewport: state?.viewport ?? null,
      explorerGenesisId: null,
      repoGenesisId: null,
      view: 'ideas'
    })
  },
  dismissSummary: () => set({ openSummary: null }),
  setViewport: (viewport) => set({ viewport }),
  takeRestoredViewport: () => {
    const restored = get().restoredViewport
    if (restored !== null) set({ restoredViewport: null })
    return restored
  },
  chatNeuronId: null,
  toast: null,
  bornId: null,
  // Les cartes ouvertes survivent à la navigation (des discussions peuvent tourner) : on les retrouve en revenant.
  show: (view) => set({ view }),
  // Une idée capturée s'ouvre directement sur sa conversation (spec 010 US2).
  navigate: ({ section, diveRootId }) => {
    if (diveRootId !== undefined && diveRootId !== null) useCards.getState().open(diveRootId, { side: 'chat' })
    set({ view: section })
  },
  openChat: (neuronId) => {
    useCards.getState().open(neuronId, { side: 'chat' })
    set({ view: 'ideas' })
  },
  closeChat: () => {
    const id = get().chatNeuronId
    if (id !== null) useCards.getState().setSide(id, null)
  },
  openGhost: (ghostId) => {
    useCards.getState().open(ghostNodeId(ghostId), { sheet: true })
    set({ view: 'ideas' })
  },
  openFinal: (neuronId) => {
    useCards.getState().open(neuronId, { sheet: true })
    set({ view: 'ideas' })
  },
  openViewer: (neuronId, path) => {
    useCards.getState().open(deliverableNodeId(neuronId), {
      side: 'reader',
      reader: { source: 'deliverable', path, tab: 'diff' }
    })
    set({ view: 'ideas' })
  },
  explorerGenesisId: null,
  repoGenesisId: null,
  structureViews: {},
  analysisLinks: false,
  chatDrafts: {},
  seedChatDraft: (neuronId, text) => set((state) => ({ chatDrafts: { ...state.chatDrafts, [neuronId]: text } })),
  takeChatDraft: (neuronId) =>
    set((state) => ({
      chatDrafts: Object.fromEntries(Object.entries(state.chatDrafts).filter(([id]) => id !== neuronId))
    })),
  toggleAnalysisLinks: () => set((state) => ({ analysisLinks: !state.analysisLinks })),
  setStructureView: (genesisId, view) =>
    set((state) => ({ structureViews: { ...state.structureViews, [genesisId]: view } })),
  openExplorer: (genesisId) => set({ view: 'ideas', explorerGenesisId: genesisId }),
  closeExplorer: () => set({ explorerGenesisId: null }),
  openRepo: (genesisId) => set({ view: 'ideas', repoGenesisId: genesisId }),
  closeRepo: () => set({ repoGenesisId: null }),
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

// La discussion ouverte suit les cartes (sonde de l'Analyste, suppression d'une idée, tests).
useCards.subscribe((cards) => {
  const chatNeuronId = chatOf(cards)
  if (useUiStore.getState().chatNeuronId !== chatNeuronId) useUiStore.setState({ chatNeuronId })
})
