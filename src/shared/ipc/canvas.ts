import type { CategoryView, GaugeLevel, LinkView, Nature, RootView, SeedView } from './neurons'
import type { IoLinkView } from './widgetIo'

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
  /** Blocs posés sur la carte : vides, notes, widgets (spec 004) et cadres résultat (spec 005). */
  readonly blocks: readonly BlockView[]
  /** Prochaine étape de chaque idée qui en a une (document en cours). */
  readonly steps: readonly StepView[]
  /** Branchements d'entrée des widgets (spec 005) : idée ou prochaine étape → widget. */
  readonly io: readonly IoLinkView[]
  /** Liens libres entre blocs et idées (spec 007). */
  readonly mapLinks: readonly MapLinkView[]
}

/**
 * « Prochaine étape » d'une idée, posée sur la carte à côté d'elle (FR-037) : tirée du document, non modifiable ;
 * point de départ d'un nouveau brainstorming. `position` : place mémorisée si elle a été glissée (épinglée).
 */
/** Place de départ d'une étape jamais glissée, par rapport au centre de son idée : en bas à droite. */
export const STEP_START_OFFSET = { x: 190, y: 130 } as const

export interface StepView {
  readonly rootId: string
  readonly text: string
  readonly position: { readonly x: number; readonly y: number } | null
}

/** Blocs que l'utilisateur pose lui-même : bloc vide (003), note = étiquette de texte, widget (spec 004). */
export const CREATABLE_BLOCK_KINDS = ['empty', 'label', 'widget'] as const
export type CreatableBlockKind = (typeof CREATABLE_BLOCK_KINDS)[number]
/**
 * S'y ajoutent le cadre résultat (spec 005), créé par l'application à la première émission d'un widget, et la note
 * titrée et le cadre de regroupement (spec 007), posés par Claude Code par le pont MCP.
 */
export const BLOCK_KINDS = [...CREATABLE_BLOCK_KINDS, 'result', 'note', 'frame'] as const
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
  /** Widget dont un cadre résultat affiche la sortie ; `null` pour les autres blocs. */
  readonly sourceBlockId: string | null
  /** Titre d'une note titrée ou d'un cadre (spec 007) ; `null` sinon. */
  readonly title: string | null
  /** Note parente (arbre dessiné par Claude) ; `null` sinon. */
  readonly parentBlockId: string | null
  /** Cadre qui regroupe ce bloc ; `null` sinon. */
  readonly frameId: string | null
  /** Posé par mentalyas ou par Claude Code. */
  readonly origin: BlockOrigin
}

export type BlockOrigin = 'user' | 'claude'

/** Lien libre de la carte (spec 007) : entre blocs et idées, libellé, sans statut. */
export interface MapLinkView {
  readonly id: string
  readonly from: MapEnd
  readonly to: MapEnd
  readonly label: string | null
  readonly origin: BlockOrigin
}

export interface MapEnd {
  readonly kind: 'block' | 'idea'
  readonly id: string
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
  widget: { minWidth: 240, minHeight: 160, maxWidth: 1600, maxHeight: 1200 },
  result: { minWidth: 240, minHeight: 160, maxWidth: 1600, maxHeight: 1200 },
  note: { minWidth: 160, minHeight: 56, maxWidth: 800, maxHeight: 1200 },
  frame: { minWidth: 240, minHeight: 160, maxWidth: 20000, maxHeight: 20000 }
}

export const BLOCK_DEFAULT_SIZES: Readonly<Record<BlockKind, { width: number; height: number }>> = {
  empty: { width: 240, height: 160 },
  label: { width: 240, height: 72 },
  widget: { width: 520, height: 440 },
  result: { width: 400, height: 320 },
  note: { width: 240, height: 96 },
  frame: { width: 640, height: 480 }
}

/** Écart entre un widget et son cadre résultat, posé à sa droite. */
export const RESULT_GAP = 48

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
