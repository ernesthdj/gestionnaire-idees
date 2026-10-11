import { create } from 'zustand'
import type { NavigateEvent, Section } from '@shared/ipc/app'
import type { BrainstormOpenView, BrainstormView, HubAnomaly } from '@shared/ipc/brainstorms'
import type { ViewState } from '@shared/brainstorms/viewState'
import { useCards } from '../canvas/cards/cardsStore'
import { cardsOf, chatTabsOf } from '../home/viewState'
import { deliverableNodeId, ghostNodeId } from '../canvas/planLayout'
import { repoGenesisId, shownChatId, shownTab, useSidePanel } from '../canvas/side/sidePanelStore'

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
export type { StructureView } from '@shared/brainstorms/viewState'
import type { StructureView } from '@shared/brainstorms/viewState'

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
  /** Vue d'un point de sauvegarde (spec 024 US2) : appliquée, et la carte est remontée pour reprendre son cadrage. */
  applyViewState(state: ViewState | null): void
  /** Change à chaque remplacement du canevas (point de sauvegarde) : la carte se remonte. */
  readonly canvasEpoch: number
  setViewport(viewport: Viewport): void
  takeRestoredViewport(): Viewport | null
  /**
   * Conversation affichée (spec 008) : celle de l'onglet affiché du panneau de droite (spec 027), neurone d'un nœud ou
   * clé d'une tâche Workflow ; `null` sans conversation affichée (lecteur, Dépôt, panneau vide).
   */
  readonly chatNeuronId: string | null
  /** Étape proposée par Claude (fantôme, spec 011) : sa carte s'ouvre sur son détail (fiche). */
  openGhost(ghostId: string): void
  /** Action finale (spec 013) : la carte de l'étape s'ouvre sur sa fiche. */
  openFinal(neuronId: string): void
  /** Fichier du livrable d'une action finale (spec 013 D4) : lu dans l'onglet du livrable (panneau de droite). */
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
  /** Projet dont l'onglet « ⎇ Dépôt » est ouvert dans le panneau de droite (spec 021 US1, spec 027 D3) ; `null` : aucun. */
  readonly repoGenesisId: string | null
  openRepo(genesisId: string): void
  closeRepo(): void
  /** Fusion en cours dont la vue de résolution remplace la carte (spec 021 US4) ; `null` : aucune. */
  readonly conflictGenesisId: string | null
  openConflicts(genesisId: string): void
  closeConflicts(): void
  /**
   * Ouvre la carte du neurone et l'onglet de sa conversation (menu, historique, exécution d'une action…) ; titre et sorte
   * de l'onglet sont repris de la carte dès qu'elle est lue.
   */
  openChat(neuronId: string): void
  /** Ferme l'onglet de la conversation affichée (`chatNeuronId`). */
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

/** Ouvre la carte d'un neurone et l'onglet de sa conversation (titre définitif lu dans la carte par le canevas). */
function openNeuronChat(neuronId: string): void {
  useCards.getState().open(neuronId)
  useSidePanel.getState().openChat({ nodeId: neuronId, neuronId, title: 'Conversation', kindLabel: '' })
}

/** État d'interface (research R4) : navigation par état, sans routeur. */

export const useUiStore = create<UiState>()((set, get) => ({
  view: 'home',
  brainstorm: null,
  openSummary: null,
  viewport: null,
  restoredViewport: null,
  enterBrainstorm: (opened) => {
    const state = opened.viewState
    useCards.setState(cardsOf(state))
    // Un panneau par canevas (spec 027 FR-014) : les onglets du canevas quitté se ferment, ceux de celui-ci reviennent.
    useSidePanel.getState().reset()
    for (const tab of chatTabsOf(state)) {
      if (tab.kind === 'workflowChat') useSidePanel.getState().openWorkflowChat(tab)
      else useSidePanel.getState().openChat(tab)
    }
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
      view: 'ideas'
    })
  },
  dismissSummary: () => set({ openSummary: null }),
  canvasEpoch: 0,
  applyViewState: (state) => {
    if (state !== null) useCards.setState(cardsOf(state))
    set((current) => ({
      structureViews: state?.structureViews ?? current.structureViews,
      viewport: state?.viewport ?? current.viewport,
      restoredViewport: state?.viewport ?? null,
      canvasEpoch: current.canvasEpoch + 1
    }))
  },
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
    if (diveRootId !== undefined && diveRootId !== null) openNeuronChat(diveRootId)
    set({ view: section })
  },
  openChat: (neuronId) => {
    openNeuronChat(neuronId)
    set({ view: 'ideas' })
  },
  closeChat: () => {
    const tab = shownTab(useSidePanel.getState())
    if (tab !== null && get().chatNeuronId !== null) useSidePanel.getState().close(tab.key)
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
    const nodeId = deliverableNodeId(neuronId)
    useCards.getState().open(nodeId)
    useSidePanel
      .getState()
      .openReader(
        { nodeId, neuronId: null, title: 'Livrable', kindLabel: 'Livrable' },
        { source: 'deliverable', path, tab: 'diff', deliverableNeuronId: neuronId }
      )
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
  openRepo: (genesisId) => {
    useSidePanel.getState().openRepo(genesisId)
    set({ view: 'ideas' })
  },
  closeRepo: () => useSidePanel.getState().closeRepo(),
  conflictGenesisId: null,
  openConflicts: (genesisId) => set({ view: 'ideas', conflictGenesisId: genesisId }),
  closeConflicts: () => set({ conflictGenesisId: null }),
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

// La conversation affichée et le Dépôt ouvert suivent le panneau de droite (sonde de l'Analyste, badge, raccourci).
useSidePanel.subscribe((panel) => {
  const chatNeuronId = shownChatId(panel)
  const repo = repoGenesisId(panel)
  const current = useUiStore.getState()
  if (current.chatNeuronId !== chatNeuronId || current.repoGenesisId !== repo)
    useUiStore.setState({ chatNeuronId, repoGenesisId: repo })
})
