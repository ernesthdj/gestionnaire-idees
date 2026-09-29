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
  /** Blocs libres (supports des mini-widgets de la v2, vides en MVP-1). */
  readonly blocks: readonly BlockView[]
}

/** Bloc libre : position (centre) et taille sur la carte. */
export interface BlockView {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export const BLOCK_DEFAULT_SIZE = { width: 240, height: 160 } as const
export const BLOCK_SIZE_LIMITS = { min: 96, max: 1600 } as const

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
