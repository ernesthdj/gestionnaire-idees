/**
 * Vues IPC des idées (spec 002 contracts/ipc-neurons.md). L'arbre, les questions et le document éclos sont ceux de
 * l'ancien moteur, gardés en archive (spec 010) : lus par les widgets branchés et par le pont MCP.
 */

export type Nature = 'action' | 'reflection'
export type RootState = 'raw' | 'developing' | 'hatched' | 'archived'
export type Source = 'ai' | 'user'
/** Origine d'un neurone : s'y ajoute Claude Code, par le pont MCP (spec 007). */
export type NeuronOrigin = Source | 'claude'
/** `idea` : suggestion de l'IA acceptée — une idée à creuser, avec ses conseils et ses sources. */
export type NeuronKind =
  | 'root'
  | 'answer'
  | 'condition'
  | 'branch'
  | 'opportunity'
  | 'investigation'
  | 'user_branch'
  | 'idea'
  | 'element'
  | 'step'
export type GaugeLevel = 'insufficient' | 'sufficient' | 'complete'

export interface CategoryView {
  readonly id: string
  readonly slug: string
  readonly label: string
  readonly color: string
}

export interface RootView {
  readonly id: string
  readonly title: string
  readonly content: string | null
  readonly nature: Nature
  readonly natureSource: Source | null
  readonly category: CategoryView | null
  readonly categorySource: Source | null
  readonly state: RootState
  readonly version: number
  readonly position: { readonly x: number; readonly y: number } | null
  /** Glissée à la main : la physique de la carte la garde à sa place. */
  readonly pinned: boolean
  /** Saisie par mentalyas, née d'une suggestion de l'IA, ou posée par Claude Code (spec 007). */
  readonly origin?: NeuronOrigin
  readonly createdAt: string
  readonly updatedAt: string
}

export interface NeuronView {
  readonly id: string
  readonly parentId: string | null
  readonly depth: number
  readonly kind: NeuronKind
  readonly title: string
  readonly content: string | null
  readonly amountCents: number | null
  readonly dueDate: string | null
  readonly origin: NeuronOrigin
  /** Sources web vérifiées d'une idée née d'une suggestion (vide sinon). */
  readonly sources?: readonly WebSourceView[]
  /** Place mémorisée sur la carte et épinglage (sous-neurone glissé à la main). */
  readonly position?: { readonly x: number; readonly y: number } | null
  readonly pinned?: boolean
}

export interface ExtensionView {
  readonly id: string
  readonly neuronId: string
  readonly question: string
  readonly quickReplies: readonly string[]
  readonly dimension: string
  readonly origin: Source
  /** La question ne relève d'aucune dimension de référence de la nature actuelle (signalée, pas retirée). */
  readonly outsideNature: boolean
}

export interface WebSourceView {
  readonly url: string
  readonly title: string
}

/** Neurone fantôme : suggestion de l'IA rattachée à un neurone, à accepter ou ignorer. */
export interface SuggestionView {
  readonly id: string
  readonly neuronId: string
  readonly title: string
  readonly content: string
  /** `pending` : vérification web en cours ; `done` : `sources` renseignées ; `failed` : non vérifiée. */
  /** `available` : vérifiable sur le web, à la demande de l'utilisateur (plus de vérification automatique). */
  readonly research: 'none' | 'available' | 'pending' | 'done' | 'failed'
  readonly sources: readonly WebSourceView[]
}

export interface GaugeView {
  readonly level: GaugeLevel
  readonly covered: readonly string[]
  readonly missing: readonly string[]
  readonly answered: number
}

export interface TreeView {
  readonly root: RootView
  readonly neurons: readonly NeuronView[]
  readonly extensions: readonly ExtensionView[]
  readonly suggestions: readonly SuggestionView[]
  readonly gauge: GaugeView | null
}

export interface RootListView {
  readonly items: readonly RootView[]
  readonly nextCursor: string | null
}

/** Tâche, condition ou opportunité du plan en cours d'une idée éclose Action. */
export interface PlanNodeView {
  readonly id: string
  readonly parentId: string | null
  readonly type: 'task' | 'condition' | 'opportunity'
  readonly title: string
  readonly question: string | null
  readonly branchLabel: string | null
  /** Branche retenue d'une condition (les autres sont grisées, réactivables). */
  readonly activeBranch: boolean
  readonly amountCents: number | null
  readonly dueDate: string | null
  readonly status: 'blocked' | 'ready' | 'in_progress' | 'done' | 'abandoned'
  readonly investigation: boolean
  readonly toSchedule: boolean
}

export interface PlanDependencyView {
  readonly id: string
  readonly fromNodeId: string
  readonly toNodeId: string
  readonly kind: 'after_done' | 'on_trigger'
  readonly triggerLabel: string | null
  readonly triggerReachedAt: string | null
}

export interface SourcedPointView {
  /** Titre court du point (fiche éditoriale) ; `null` pour les synthèses plus anciennes. */
  readonly headline: string | null
  readonly text: string
  /** Sous-neurones d'où vient le point (peuvent avoir été supprimés depuis). */
  readonly sources: readonly { readonly id: string; readonly title: string }[]
}

/** Résultat en cours d'une idée éclose : plan d'action ou synthèse de réflexion (spec 003 US5). */
export type HatchedResultView =
  | {
      readonly type: 'action_plan'
      readonly nodes: readonly PlanNodeView[]
      readonly dependencies: readonly PlanDependencyView[]
    }
  | {
      readonly type: 'reflection_summary'
      /** « En bref » et prochaine étape conseillée ; `null` pour les synthèses plus anciennes. */
      readonly overview: string | null
      readonly nextStep: string | null
      readonly keyPoints: readonly SourcedPointView[]
      readonly decisions: readonly SourcedPointView[]
      readonly pros: readonly SourcedPointView[]
      readonly cons: readonly SourcedPointView[]
      readonly openQuestions: readonly { readonly text: string }[]
    }
