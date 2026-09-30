import type { CategoryView, GaugeLevel, LinkView, Nature, RootView, SeedView } from './neurons'

/** Vues de l'écran Idées (spec 003 data-model § Vues d'interface). */

export interface CanvasNeuronView extends RootView {
  /** Premiers sous-neurones directs (aperçu autour d'une idée en développement). */
  readonly subNeurons: readonly { readonly id: string; readonly title: string }[]
  readonly subCount: number
  /** Dernier niveau de contexte évalué ; `null` tant que l'idée n'a pas été travaillée (taille du neurone). */
  readonly contextLevel: GaugeLevel | null
}

export interface IdeasCanvasView {
  readonly counts: { readonly raw: number; readonly developing: number; readonly hatched: number }
  /** Toutes les idées, quel que soit leur état, dans un seul espace (FR-029). */
  readonly ideas: readonly CanvasNeuronView[]
  /** Liens acceptés et suggérés entre idées visibles. */
  readonly links: readonly LinkView[]
  /** Graines en attente sur les liens visibles, et graines acceptées (« née de A × B ») des idées visibles. */
  readonly seeds: readonly SeedView[]
  readonly categories: readonly CategoryView[]
  /** Idées correspondant au filtre ; `null` sans filtre (toutes normales). */
  readonly highlighted: readonly string[] | null
  /** Blocs posés sur la carte : vides, notes et widgets (spec 004). */
  readonly blocks: readonly BlockView[]
}

export const BLOCK_KINDS = ['empty', 'label', 'widget'] as const
/** Bloc vide (003), note = étiquette de texte, widget généré par Claude (spec 004). */
export type BlockKind = (typeof BLOCK_KINDS)[number]

/** Bloc posé sur la carte : position (centre) et taille. */
export interface BlockView {
  readonly id: string
  readonly kind: BlockKind
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  /** Texte d'une note ; `null` pour les autres blocs. */
  readonly text: string | null
  /** Version affichée d'un widget ; `null` tant qu'aucune n'a été générée. */
  readonly versionId: string | null
}

export interface SizeLimits {
  readonly minWidth: number
  readonly minHeight: number
  readonly maxWidth: number
  readonly maxHeight: number
}

/** Bornes de taille par type de bloc (spec 004 FR-002, FR-003) : appliquées par l'interface ET par le main. */
export const BLOCK_LIMITS: Readonly<Record<BlockKind, SizeLimits>> = {
  empty: { minWidth: 96, minHeight: 96, maxWidth: 1600, maxHeight: 1600 },
  label: { minWidth: 120, minHeight: 48, maxWidth: 800, maxHeight: 600 },
  widget: { minWidth: 240, minHeight: 160, maxWidth: 1600, maxHeight: 1200 }
}

export const BLOCK_DEFAULT_SIZES: Readonly<Record<BlockKind, { width: number; height: number }>> = {
  empty: { width: 240, height: 160 },
  label: { width: 240, height: 72 },
  widget: { width: 520, height: 440 }
}

/** Longueur maximale du texte d'une note. */
export const LABEL_MAX_CHARS = 2000

export interface CanvasFilterInput {
  readonly nature?: Nature
  readonly categoryId?: string
  readonly search?: string
}

/** Position d'une idée ou d'un sous-neurone sur la carte ; `pinned` : glissé à la main (gardé en place). */
export interface CanvasPosition {
  readonly neuronId: string
  readonly x: number
  readonly y: number
  readonly pinned?: boolean
}
