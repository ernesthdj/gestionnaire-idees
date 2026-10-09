import { create } from 'zustand'

/**
 * Cartes de détails ouvertes (spec 022 D15, D16, D18, D28) : un clic à l'extérieur ferme les cartes, sauf celles
 * épinglées (plusieurs discussions à la fois) ; la dernière touchée est active (au premier plan, Échap n'agit que sur
 * elle). Décalage en unités de la carte : la carte suit son
 * nœud et le zoom. À droite, la discussion et le lecteur se remplacent l'un l'autre ; la fiche (bas) est indépendante.
 * Règles pures (testées) + magasin zustand.
 */

export interface Offset {
  readonly x: number
  readonly y: number
}

/** Fichier ouvert dans le lecteur de la carte. */
export interface ReaderTarget {
  readonly source: 'deliverable' | 'element' | 'document' | 'skill' | 'workflow'
  readonly path: string
  readonly tab: 'diff' | 'file'
}

export interface OpenCard {
  readonly id: string
  readonly offset: Offset
  readonly sheet: boolean
  readonly side: 'chat' | 'reader' | null
  readonly reader: ReaderTarget | null
  /** Ordre d'empilement : la plus grande valeur est devant. */
  readonly z: number
  /** Épinglée (D28) : elle reste ouverte malgré un clic à l'extérieur (travail à plusieurs discussions). */
  readonly pinned: boolean
}

/** Ouverture directe sur la discussion, le lecteur ou la fiche (action finale, étape proposée). */
export interface OpenOptions {
  readonly side?: 'chat' | 'reader'
  readonly reader?: ReaderTarget
  readonly sheet?: boolean
}

export interface CardsState {
  readonly cards: readonly OpenCard[]
  readonly activeId: string | null
}

export const EMPTY_CARDS: CardsState = { cards: [], activeId: null }

const topZ = (state: CardsState): number => state.cards.reduce((max, card) => Math.max(max, card.z), 0)

const update = (state: CardsState, id: string, change: (card: OpenCard) => OpenCard): CardsState => ({
  ...state,
  cards: state.cards.map((card) => (card.id === id ? change(card) : card))
})

/** Passe une carte devant et la rend active (sans effet si elle n'est pas ouverte). */
export function activate(state: CardsState, id: string): CardsState {
  if (!state.cards.some((card) => card.id === id)) return state
  if (state.activeId === id && state.cards.find((card) => card.id === id)?.z === topZ(state)) return state
  const z = topZ(state) + 1
  return { ...update(state, id, (card) => ({ ...card, z })), activeId: id }
}

/** Ouvre la carte d'un nœud (ou l'active si elle l'est déjà) ; `side` ouvre directement la discussion ou le lecteur. */
export function openCard(state: CardsState, id: string, options: OpenOptions = {}): CardsState {
  const opened = state.cards.some((card) => card.id === id)
    ? state
    : {
        ...state,
        cards: [
          ...state.cards,
          { id, offset: { x: 0, y: 0 }, sheet: false, side: null, reader: null, z: topZ(state) + 1, pinned: false }
        ]
      }
  const active = activate(opened, id)
  const sided = options.side === undefined ? active : setSide(active, id, options.side, options.reader)
  return options.sheet === true ? update(sided, id, (card) => ({ ...card, sheet: true })) : sided
}

/** Ferme une carte ; la plus haute des restantes devient active. */
export function closeCard(state: CardsState, id: string): CardsState {
  const cards = state.cards.filter((card) => card.id !== id)
  if (cards.length === state.cards.length) return state
  const activeId =
    state.activeId !== id
      ? state.activeId
      : (cards.reduce<OpenCard | null>((top, card) => (top === null || card.z > top.z ? card : top), null)?.id ?? null)
  return { cards, activeId }
}

/** Épingle ou détache une carte (D28). */
export function togglePin(state: CardsState, id: string): CardsState {
  return update(state, id, (card) => ({ ...card, pinned: !card.pinned }))
}

/** Clic à l'extérieur (D28) : les cartes non épinglées se ferment, sauf `keep` (la carte qu'on ouvre). */
export function closeUnpinned(state: CardsState, keep?: string): CardsState {
  return state.cards
    .filter((card) => !card.pinned && card.id !== keep)
    .reduce((next, card) => closeCard(next, card.id), state)
}

export function closeAll(): CardsState {
  return EMPTY_CARDS
}

export function moveCard(state: CardsState, id: string, offset: Offset): CardsState {
  return update(state, id, (card) => ({ ...card, offset }))
}

export function toggleSheet(state: CardsState, id: string): CardsState {
  return update(state, id, (card) => ({ ...card, sheet: !card.sheet }))
}

/** Ouvre la discussion ou le lecteur à droite (l'un remplace l'autre) ; `null` replie le côté. */
export function setSide(
  state: CardsState,
  id: string,
  side: 'chat' | 'reader' | null,
  reader?: ReaderTarget
): CardsState {
  return update(state, id, (card) => ({
    ...card,
    side,
    reader: side === 'reader' ? (reader ?? card.reader) : null
  }))
}

interface CardsStore extends CardsState {
  open(id: string, options?: OpenOptions): void
  close(id: string): void
  closeAll(): void
  activate(id: string): void
  move(id: string, offset: Offset): void
  toggleSheet(id: string): void
  togglePin(id: string): void
  closeUnpinned(keep?: string): void
  setSide(id: string, side: 'chat' | 'reader' | null, reader?: ReaderTarget): void
}

export const useCards = create<CardsStore>()((set) => ({
  ...EMPTY_CARDS,
  open: (id, options) => set((state) => openCard(state, id, options)),
  close: (id) => set((state) => closeCard(state, id)),
  closeAll: () => set(closeAll()),
  activate: (id) => set((state) => activate(state, id)),
  move: (id, offset) => set((state) => moveCard(state, id, offset)),
  toggleSheet: (id) => set((state) => toggleSheet(state, id)),
  togglePin: (id) => set((state) => togglePin(state, id)),
  closeUnpinned: (keep) => set((state) => closeUnpinned(state, keep)),
  setSide: (id, side, reader) => set((state) => setSide(state, id, side, reader))
}))
