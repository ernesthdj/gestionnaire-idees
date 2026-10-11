import { create } from 'zustand'
import type { DocumentView } from '@shared/ipc/documents'
import type { ReaderTarget } from '../cards/cardsStore'

/**
 * Panneau de droite de l'écran Idées (spec 027) : un onglet par conversation ouverte (nœud de la carte ou tâche
 * Workflow) et l'onglet Dépôt d'un genesis. Il vit hors de la carte : ni zoom, ni déplacement. Fermer une carte ne
 * ferme pas son onglet ; un onglet se ferme par son ×, quand son nœud disparaît, ou quand on quitte le canevas.
 * Règles pures (testées) + magasin zustand.
 */

/** Fichier lu dans l'onglet d'un nœud, à la place de la conversation (D5), avec ce qu'il faut à son lecteur. */
export interface TabReader extends ReaderTarget {
  /** Livrable d'une action finale (`FileViewer`). */
  readonly deliverableNeuronId?: string
  /** Élément d'une carte de structure (`ElementFileReader`). */
  readonly elementId?: string
  /** Genesis d'un projet lié en vue Workflow (`WorkflowFileReader`). */
  readonly genesisId?: string
  /** Document Markdown (`DocumentReader`) : instantané de sa vue. */
  readonly document?: DocumentView
}

export interface ChatTab {
  readonly kind: 'chat'
  readonly key: string
  readonly nodeId: string
  /** `null` : nœud sans conversation (document, livrable), ouvert pour son lecteur. */
  readonly neuronId: string | null
  readonly title: string
  readonly kindLabel: string
  readonly reader: TabReader | null
}

export interface WorkflowChatTab {
  readonly kind: 'workflowChat'
  readonly key: string
  readonly nodeId: string
  readonly genesisId: string
  /** Neurone de sa conversation, connu une fois retrouvé ou créé (`workflow:chat`) ; sert aux indicateurs. */
  readonly neuronId: string | null
  readonly title: string
  readonly kindLabel: string
  readonly reader: TabReader | null
}

export interface RepoTab {
  readonly kind: 'repo'
  readonly key: string
  readonly genesisId: string
  readonly title: string
}

export type SideTab = ChatTab | WorkflowChatTab | RepoTab

/** Ce qu'il faut pour ouvrir l'onglet d'un nœud. */
export interface ChatTabInput {
  readonly nodeId: string
  readonly neuronId: string | null
  readonly title: string
  readonly kindLabel: string
}

export interface WorkflowChatTabInput {
  readonly nodeId: string
  readonly genesisId: string
  readonly title: string
  readonly kindLabel: string
}

/** Demande « Centrer sur le nœud » (D4) : le canevas l'exécute ; un nonce nouveau à chaque demande. */
export interface FocusRequest {
  readonly nodeId: string
  readonly nonce: number
}

export interface SidePanelState {
  readonly tabs: readonly SideTab[]
  readonly shownKey: string | null
  readonly focus: FocusRequest | null
}

export const EMPTY_SIDE_PANEL: SidePanelState = { tabs: [], shownKey: null, focus: null }

export const TAB_TITLE_MAX = 200
const REPO_PREFIX = 'repo:'

export const repoKey = (genesisId: string): string => `${REPO_PREFIX}${genesisId}`
const titled = (title: string): string => title.slice(0, TAB_TITLE_MAX)

const replace = (state: SidePanelState, key: string, change: (tab: SideTab) => SideTab): SidePanelState => ({
  ...state,
  tabs: state.tabs.map((tab) => (tab.key === key ? change(tab) : tab))
})

/** Ajoute l'onglet s'il manque (sans doublon) et l'affiche. */
function add(state: SidePanelState, tab: SideTab): SidePanelState {
  const exists = state.tabs.some((entry) => entry.key === tab.key)
  return { ...state, tabs: exists ? state.tabs : [...state.tabs, tab], shownKey: tab.key }
}

/** Ouvre (ou affiche) l'onglet de la conversation d'un nœud ; un lecteur déjà ouvert y reste. */
export function openChat(state: SidePanelState, input: ChatTabInput): SidePanelState {
  const existing = state.tabs.find((tab) => tab.key === input.nodeId)
  // Un onglet ouvert pour un lecteur seul gagne sa conversation quand le nœud en a une.
  if (existing?.kind === 'chat' && existing.neuronId === null && input.neuronId !== null)
    return { ...replace(state, input.nodeId, (tab) => ({ ...tab, neuronId: input.neuronId })), shownKey: input.nodeId }
  return add(state, {
    kind: 'chat',
    key: input.nodeId,
    nodeId: input.nodeId,
    neuronId: input.neuronId,
    title: titled(input.title),
    kindLabel: input.kindLabel,
    reader: null
  })
}

/** Ouvre (ou affiche) l'onglet d'une tâche Workflow (sa conversation est retrouvée ou créée à l'affichage). */
export function openWorkflowChat(state: SidePanelState, input: WorkflowChatTabInput): SidePanelState {
  return add(state, {
    kind: 'workflowChat',
    key: input.nodeId,
    nodeId: input.nodeId,
    genesisId: input.genesisId,
    neuronId: null,
    title: titled(input.title),
    kindLabel: input.kindLabel,
    reader: null
  })
}

/** Neurone de la conversation d'une tâche Workflow, connu à l'ouverture de l'onglet. */
export function bindNeuron(state: SidePanelState, key: string, neuronId: string): SidePanelState {
  const tab = state.tabs.find((entry) => entry.key === key)
  if (tab?.kind !== 'workflowChat' || tab.neuronId === neuronId) return state
  return replace(state, key, (entry) => ({ ...entry, neuronId }))
}

/** Neurone de la conversation d'un onglet (indicateurs « Claude écrit », « ⏸ ») ; `null` pour le Dépôt. */
export function neuronOfTab(tab: SideTab): string | null {
  return tab.kind === 'repo' ? null : tab.neuronId
}

/** Ouvre un fichier dans l'onglet de son nœud (créé s'il manque), à la place de la conversation. */
export function openReader(
  state: SidePanelState,
  input: ChatTabInput | (WorkflowChatTabInput & { readonly workflow: true }),
  reader: TabReader
): SidePanelState {
  const opened = state.tabs.some((tab) => tab.key === input.nodeId)
    ? show(state, input.nodeId)
    : 'workflow' in input
      ? openWorkflowChat(state, input)
      : openChat(state, input)
  return replace(opened, input.nodeId, (tab) => (tab.kind === 'repo' ? tab : { ...tab, reader }))
}

/** « ← Conversation » : revient à la conversation ; un onglet sans conversation se ferme. */
export function closeReader(state: SidePanelState, key: string): SidePanelState {
  const tab = state.tabs.find((entry) => entry.key === key)
  if (tab === undefined || tab.kind === 'repo') return state
  if (tab.kind === 'chat' && tab.neuronId === null) return close(state, key)
  return replace(state, key, (entry) => (entry.kind === 'repo' ? entry : { ...entry, reader: null }))
}

export function show(state: SidePanelState, key: string): SidePanelState {
  return state.tabs.some((tab) => tab.key === key) ? { ...state, shownKey: key } : state
}

/** Ferme un onglet (aucun tour n'est interrompu) ; l'onglet affiché passe à son voisin de droite, sinon de gauche. */
export function close(state: SidePanelState, key: string): SidePanelState {
  const index = state.tabs.findIndex((tab) => tab.key === key)
  if (index === -1) return state
  const tabs = state.tabs.filter((tab) => tab.key !== key)
  if (state.shownKey !== key) return { ...state, tabs }
  const neighbour = tabs[index] ?? tabs[index - 1]
  return { ...state, tabs, shownKey: neighbour?.key ?? null }
}

/** Onglet « ⎇ Dépôt » d'un genesis (un seul à la fois : il remplace celui d'un autre genesis). */
export function openRepo(state: SidePanelState, genesisId: string): SidePanelState {
  const other = state.tabs.find((tab) => tab.kind === 'repo' && tab.genesisId !== genesisId)
  const cleared = other === undefined ? state : close(state, other.key)
  return add(cleared, { kind: 'repo', key: repoKey(genesisId), genesisId, title: 'Dépôt' })
}

export function closeRepo(state: SidePanelState): SidePanelState {
  const repo = state.tabs.find((tab) => tab.kind === 'repo')
  return repo === undefined ? state : close(state, repo.key)
}

/**
 * Suit la vue du canevas : les onglets de nœuds reprennent leur titre et leur sorte ; ceux dont le nœud n'existe plus
 * se ferment (`existing` absent : on ne ferme rien, la vue est filtrée). Les tâches Workflow et le Dépôt restent.
 */
export function syncWithView(
  state: SidePanelState,
  labels: ReadonlyMap<string, { readonly title: string; readonly kindLabel: string }>,
  existing?: ReadonlySet<string>
): SidePanelState {
  let next = state
  for (const tab of state.tabs) {
    if (tab.kind !== 'chat') continue
    if (existing !== undefined && !existing.has(tab.nodeId)) {
      next = close(next, tab.key)
      continue
    }
    const label = labels.get(tab.nodeId)
    if (label !== undefined && (label.title !== tab.title || label.kindLabel !== tab.kindLabel))
      next = replace(next, tab.key, (entry) => ({ ...entry, title: titled(label.title), kindLabel: label.kindLabel }))
  }
  return next
}

let nonce = 0
export function requestFocus(state: SidePanelState, nodeId: string): SidePanelState {
  nonce += 1
  return { ...state, focus: { nodeId, nonce } }
}

export function shownTab(state: SidePanelState): SideTab | null {
  return state.tabs.find((tab) => tab.key === state.shownKey) ?? null
}

/** Nœud de l'onglet affiché (anneau « conversation ouverte ») ; `null` pour le Dépôt ou sans onglet. */
export function shownNodeId(state: SidePanelState): string | null {
  const tab = shownTab(state)
  return tab === null || tab.kind === 'repo' ? null : tab.nodeId
}

/** Conversation affichée (pas un lecteur) : neurone d'un nœud, ou clé d'une tâche Workflow ; sinon `null`. */
export function shownChatId(state: SidePanelState): string | null {
  const tab = shownTab(state)
  if (tab === null || tab.kind === 'repo' || tab.reader !== null) return null
  return tab.kind === 'chat' ? tab.neuronId : tab.nodeId
}

export function repoGenesisId(state: SidePanelState): string | null {
  const repo = state.tabs.find((tab) => tab.kind === 'repo')
  return repo?.kind === 'repo' ? repo.genesisId : null
}

/** Clés des onglets de conversation (gardées dans l'état de vue du brainstorm, spec 024). */
export function chatKeys(state: SidePanelState): ReadonlySet<string> {
  return new Set(state.tabs.filter((tab) => tab.kind !== 'repo').map((tab) => tab.key))
}

interface SidePanelStore extends SidePanelState {
  openChat(input: ChatTabInput): void
  openWorkflowChat(input: WorkflowChatTabInput): void
  bindNeuron(key: string, neuronId: string): void
  openReader(input: ChatTabInput | (WorkflowChatTabInput & { readonly workflow: true }), reader: TabReader): void
  closeReader(key: string): void
  show(key: string): void
  close(key: string): void
  openRepo(genesisId: string): void
  closeRepo(): void
  syncWithView(
    labels: ReadonlyMap<string, { readonly title: string; readonly kindLabel: string }>,
    existing?: ReadonlySet<string>
  ): void
  requestFocus(nodeId: string): void
  reset(): void
}

export const useSidePanel = create<SidePanelStore>()((set) => ({
  ...EMPTY_SIDE_PANEL,
  openChat: (input) => set((state) => openChat(state, input)),
  openWorkflowChat: (input) => set((state) => openWorkflowChat(state, input)),
  bindNeuron: (key, neuronId) => set((state) => bindNeuron(state, key, neuronId)),
  openReader: (input, reader) => set((state) => openReader(state, input, reader)),
  closeReader: (key) => set((state) => closeReader(state, key)),
  show: (key) => set((state) => show(state, key)),
  close: (key) => set((state) => close(state, key)),
  openRepo: (genesisId) => set((state) => openRepo(state, genesisId)),
  closeRepo: () => set((state) => closeRepo(state)),
  syncWithView: (labels, existing) => set((state) => syncWithView(state, labels, existing)),
  requestFocus: (nodeId) => set((state) => requestFocus(state, nodeId)),
  reset: () => set(EMPTY_SIDE_PANEL)
}))
