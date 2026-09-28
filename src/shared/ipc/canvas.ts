import type { CategoryView, LinkView, Nature, RootView } from './neurons'

/** Vues de l'écran Idées (spec 003 data-model § Vues d'interface). */

export interface CanvasNeuronView extends RootView {
  /** Premiers sous-neurones directs (aperçu autour d'une idée en développement). */
  readonly subNeurons: readonly { readonly id: string; readonly title: string }[]
  readonly subCount: number
}

export interface IdeasCanvasView {
  readonly counts: { readonly raw: number; readonly developing: number; readonly hatched: number }
  /** Idées brutes et en développement (zone de gauche). */
  readonly incubator: readonly CanvasNeuronView[]
  /** Idées écloses (zone de droite). */
  readonly network: readonly CanvasNeuronView[]
  /** Liens acceptés et suggérés entre idées visibles. */
  readonly links: readonly LinkView[]
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

export interface CanvasPosition {
  readonly rootId: string
  readonly x: number
  readonly y: number
}
