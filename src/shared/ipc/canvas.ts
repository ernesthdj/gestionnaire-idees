import type { ArchitectureKind } from '../structure/architecture'
import type { CategoryView, GaugeLevel, Nature, RootView } from './neurons'
import type { IoLinkView } from './widgetIo'
import type { DocumentView } from './documents'
import type { DeliverableView, StepFinalView } from './finals'
import type { LinkProvenance } from './reprise'

/** Vues de l'écran Idées (spec 003 data-model § Vues d'interface). */

export interface CanvasNeuronView extends RootView {
  /** Dernier niveau de contexte évalué ; `null` tant que l'idée n'a pas été travaillée (taille du neurone). */
  readonly contextLevel: GaugeLevel | null
  /** Résumé de la fiche tenue par Claude dans la conversation du neurone (spec 008) ; absent sans fiche. */
  readonly sheetSummary?: string
  /** Verrouillé (spec 011) : fiche, titre et description figés. */
  readonly locked: boolean
  /** Claude propose de le verrouiller ; en attente de la décision de mentalyas. */
  readonly lockProposed: boolean
  /** Tout son plan d'attaque est replié sur la carte (spec 022 D14) ; absent sinon. */
  readonly planCollapsed?: boolean
}

/** Statuts d'avancement d'une étape (spec 011 FR-009). */
export const STEP_STATUSES = ['a_faire', 'en_cours', 'fait', 'bloque'] as const
export type StepStatus = (typeof STEP_STATUSES)[number]

/** Étape d'un plan d'attaque (spec 011) : un neurone de l'arbre d'un genesis, rangé parmi ses sœurs. */
export interface StepView {
  readonly id: string
  readonly genesisId: string
  /** Genesis ou étape parente. */
  readonly parentId: string
  /** 1 : enfant du genesis ; jusqu'à 4. */
  readonly depth: number
  /** Rang parmi ses sœurs, à partir de 1. */
  readonly rank: number
  readonly title: string
  readonly status: StepStatus
  readonly locked: boolean
  readonly lockProposed: boolean
  /** Étapes sœurs attendues. */
  readonly waitsFor: readonly string[]
  /** Décalage manuel (glissé) de l'étape et de sa branche par rapport à sa place calculée. */
  readonly offset: { readonly x: number; readonly y: number }
  /** Ses sous-étapes sont repliées sur la carte (spec 022 D14) ; absent sinon. */
  readonly collapsed?: boolean
  readonly sheetSummary?: string
  /** Action finale (spec 013) : proposée ou acceptée ; absente pour une étape ordinaire. */
  readonly final?: StepFinalView
}

/** Couche proposée par Claude (fantômes), en attente de la décision de mentalyas. */
export interface ProposalView {
  readonly id: string
  readonly parentId: string
  readonly items: readonly {
    readonly id: string
    readonly title: string
    readonly why: string
    readonly rank: number
    /** Autres fantômes de la proposition ou étapes sœurs existantes attendus. */
    readonly waitsFor: readonly string[]
  }[]
}

/** Appels mesurés d'un élément à un autre (spec 017 FR-033) : nombre, fiabilité la plus faible. */
export interface MeasuredLinkView {
  readonly from: string
  readonly to: string
  readonly count: number
  readonly provenance: LinkProvenance
}

export interface IdeasCanvasView {
  readonly counts: { readonly raw: number; readonly developing: number; readonly hatched: number }
  /** Toutes les idées, quel que soit leur état, dans un seul espace (FR-029). */
  readonly ideas: readonly CanvasNeuronView[]
  readonly categories: readonly CategoryView[]
  /** Idées correspondant au filtre ; `null` sans filtre (toutes normales). */
  readonly highlighted: readonly string[] | null
  /** Blocs posés sur la carte : vides, notes, widgets (spec 004) et cadres résultat (spec 005). */
  readonly blocks: readonly BlockView[]
  /** Branchements d'entrée des widgets (spec 005) : idée → widget. */
  readonly io: readonly IoLinkView[]
  /** Liens libres entre blocs et idées (spec 007, 010), et liens typés des cartes de structure (spec 009). */
  readonly mapLinks: readonly MapLinkView[]
  /** Éléments des cartes de structure des projets liés (spec 009). */
  readonly elements: readonly ElementView[]
  /** Architecture de chaque carte de structure qui en a une (D20). */
  readonly architectures?: readonly StructureArchitectureView[]
  /** Appels mesurés par l'analyse entre éléments d'une carte de projet repris (spec 017 US7). */
  readonly measuredLinks: readonly MeasuredLinkView[]
  /** Étapes des plans d'attaque des genesis visibles (spec 011). */
  readonly steps: readonly StepView[]
  /** Couches proposées par Claude, en attente (fantômes). */
  readonly proposals: readonly ProposalView[]
  /** Documents Markdown rattachés aux neurones visibles (spec 012). */
  readonly documents: readonly DocumentView[]
  /** Livrables des actions finales exécutées ou en cours (spec 013). */
  readonly deliverables: readonly DeliverableView[]
}

/** Libellé court d'un lien entre deux idées (1 à 3 mots en pratique). */
export const LINK_LABEL_MAX = 40

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
  /** Relation typée d'une carte de structure (spec 009) ; `null` : lien libre. */
  readonly relation: ElementRelation | null
}

export interface MapEnd {
  readonly kind: 'block' | 'idea' | 'element'
  readonly id: string
}

/** Types d'éléments d'une carte de structure de projet (spec 009, L1e §3). */
export const ELEMENT_TYPES = [
  'module',
  'fonctionnalite',
  'composant',
  'donnee',
  'interface',
  'tache',
  'decision',
  'operation'
] as const
export type ElementType = (typeof ELEMENT_TYPES)[number]

/** Statuts possibles d'un élément (selon son type). */
export const ELEMENT_STATUSES = ['idee', 'specifiee', 'en_cours', 'livree', 'a_faire', 'faite', 'bloquee'] as const
export type ElementStatus = (typeof ELEMENT_STATUSES)[number]

/** Relations typées entre éléments (L1e §3). */
export const ELEMENT_RELATIONS = ['depend_de', 'appelle', 'lit_ecrit', 'implemente', 'teste', 'bloque'] as const
export type ElementRelation = (typeof ELEMENT_RELATIONS)[number]

/** Élément de la carte de structure d'un projet : un neurone typé, avec sa conversation et sa fiche (spec 009). */
export interface ElementView {
  readonly id: string
  readonly genesisId: string
  /** Parent : un autre élément, ou le genesis (niveau 1). */
  readonly parentId: string
  readonly key: string
  readonly type: ElementType
  readonly title: string
  readonly status: ElementStatus | null
  /** Résumé de sa fiche (ou celui donné à la cartographie). */
  readonly summary: string | null
  /** Chemins relatifs au dossier du projet. */
  readonly paths: readonly string[]
  /** Ses enfants sont repliés sur la carte. */
  readonly collapsed: boolean
  readonly childCount: number
  /** Rang de progression parmi ses frères donné par Claude (D17) ; `null` : non donné. */
  readonly order: number | null
  /** Contenu réel de ses fichiers (spec 017 D18), calculé par l'app ; absent : aucun fichier couvert. */
  readonly content?: ElementContentView | null
  /** Couche d'architecture (D20) : donnée par Claude, corrigée par mentalyas ou déduite par l'app ; `null` : non classé. */
  readonly layer?: string | null
  readonly layerSource?: LayerSource | null
  /** Avancement déclaré par Claude (D21), 0–100, et ce qui reste à faire ; la moyenne des enfants est calculée à l'écran. */
  readonly progress?: number | null
  readonly progressNote?: string | null
}

/** Origine d'une couche ou d'une architecture (D20) ; « deduite » : repère de l'app, jamais stocké. */
export type LayerSource = 'claude' | 'user' | 'deduite'

/** Architecture d'une carte de structure (D20), portée par son genesis. */
export interface StructureArchitectureView {
  readonly genesisId: string
  readonly kind: ArchitectureKind
  readonly reason: string | null
  readonly source: 'claude' | 'user'
}

/** Ce que contient un élément (D18) : de la doc seulement, ou du code (configuration comprise). */
export interface ElementContentView {
  readonly kind: 'doc' | 'code'
  readonly code: number
  readonly doc: number
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
