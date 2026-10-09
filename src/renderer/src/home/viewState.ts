import { EMPTY_VIEW_STATE, VIEW_STATE_LIMITS, type ViewState } from '@shared/brainstorms/viewState'
import { EMPTY_CARDS, type CardsState, type OpenCard } from '../canvas/cards/cardsStore'

/**
 * État de vue d'un brainstorm ↔ état de l'interface (spec 024 R2) : règles pures, testées. Le lecteur d'une carte
 * (fichier ouvert) n'est pas gardé : seule la discussion revient d'un côté.
 */

type StructureViews = ViewState['structureViews']

/** Instantané de la vue courante, borné comme le schéma. */
export function viewStateOf(
  structureViews: StructureViews,
  cards: readonly OpenCard[],
  viewport: ViewState['viewport']
): ViewState {
  return {
    ...EMPTY_VIEW_STATE,
    viewport,
    structureViews: Object.fromEntries(Object.entries(structureViews).slice(0, VIEW_STATE_LIMITS.genesis)),
    openCards: [...cards]
      .sort((a, b) => a.z - b.z)
      .slice(-VIEW_STATE_LIMITS.cards)
      .map((card) => ({
        id: card.id,
        offset: card.offset,
        sheet: card.sheet,
        side: card.side === 'chat' ? 'chat' : null,
        pinned: card.pinned
      }))
  }
}

/** Cartes à rouvrir, dans leur ordre d'empilement ; aucune n'est active (le clic suivant décide). */
export function cardsOf(state: ViewState | null): CardsState {
  if (state === null) return EMPTY_CARDS
  return {
    activeId: null,
    cards: state.openCards.map((card, index) => ({ ...card, reader: null, z: index + 1 }))
  }
}
