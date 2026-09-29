/** Vues de l'historique (spec 003 data-model `HistoryEntryView`). */

export type HistoryKind = 'confirm_synthesis' | 'manual_edit' | 'link' | 'seed' | 'delete' | 'promote' | 'undo'

export interface HistoryEntryView {
  readonly batchId: string
  readonly kind: HistoryKind
  /** Idée concernée (pour y aller depuis l'historique), si connue. */
  readonly rootId: string | null
  /** Phrase lisible, ex. « Éclosion de « Deuxième écran » ». */
  readonly summary: string
  readonly at: string
  readonly undoable: boolean
  /** Déjà annulé (par un lot plus récent). */
  readonly undone: boolean
}

export interface HistoryPageView {
  readonly items: readonly HistoryEntryView[]
  readonly nextCursor: string | null
}
