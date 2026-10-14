import { EMPTY_VIEW_STATE, VIEW_STATE_LIMITS, type ViewState } from '@shared/brainstorms/viewState'
import { EMPTY_CARDS, type CardsState, type OpenCard } from '../canvas/cards/cardsStore'
import type { ChatTabInput, WorkflowChatTabInput } from '../canvas/side/sidePanelStore'

/**
 * État de vue d'un brainstorm ↔ état de l'interface (spec 024 R2) : règles pures, testées. Une carte garde `side:
 * 'chat'` quand l'onglet de sa conversation est ouvert dans le panneau de droite (spec 027) ; un lecteur ouvert (fichier)
 * n'est pas gardé.
 */

type StructureViews = ViewState['structureViews']

/** Instantané de la vue courante, borné comme le schéma. */
export function viewStateOf(
  structureViews: StructureViews,
  cards: readonly OpenCard[],
  viewport: ViewState['viewport'],
  chatKeys: ReadonlySet<string> = new Set(),
  progressionReadings: NonNullable<ViewState['progressionReadings']> = {}
): ViewState {
  return {
    ...EMPTY_VIEW_STATE,
    viewport,
    structureViews: Object.fromEntries(Object.entries(structureViews).slice(0, VIEW_STATE_LIMITS.genesis)),
    progressionReadings: Object.fromEntries(Object.entries(progressionReadings).slice(0, VIEW_STATE_LIMITS.genesis)),
    openCards: [...cards]
      .sort((a, b) => a.z - b.z)
      .slice(-VIEW_STATE_LIMITS.cards)
      .map((card) => ({
        id: card.id,
        offset: card.offset,
        sheet: card.sheet,
        side: chatKeys.has(card.id) ? 'chat' : null,
        pinned: card.pinned
      }))
  }
}

/** Cartes à rouvrir, dans leur ordre d'empilement ; aucune n'est active (le clic suivant décide). */
export function cardsOf(state: ViewState | null): CardsState {
  if (state === null) return EMPTY_CARDS
  return {
    activeId: null,
    cards: state.openCards.map((card, index) => ({
      id: card.id,
      offset: card.offset,
      sheet: card.sheet,
      pinned: card.pinned,
      z: index + 1
    }))
  }
}

/**
 * Onglets de conversation à rouvrir (cartes gardées avec `side: 'chat'`), dans l'ordre d'empilement ; leur titre et
 * leur sorte sont relus dans la carte. Une tâche Workflow se reconnaît à sa clé (`wf:<genesis>:…`).
 */
export function chatTabsOf(
  state: ViewState | null
): readonly (
  (ChatTabInput & { readonly kind: 'chat' }) | (WorkflowChatTabInput & { readonly kind: 'workflowChat' })
)[] {
  if (state === null) return []
  return state.openCards
    .filter((card) => card.side === 'chat')
    .map((card) => {
      const [prefix, genesisId] = card.id.split(':')
      return prefix === 'wf' && genesisId !== undefined && genesisId !== ''
        ? { kind: 'workflowChat' as const, nodeId: card.id, genesisId, title: 'Conversation', kindLabel: 'Workflow' }
        : { kind: 'chat' as const, nodeId: card.id, neuronId: card.id, title: 'Conversation', kindLabel: '' }
    })
}
