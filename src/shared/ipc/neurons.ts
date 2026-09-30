import type { ActionPlanOut, ReflectionSummaryOut } from '../ai/neurons'

/** Vues et entrées IPC du moteur de neurones (spec 002 contracts/ipc-neurons.md). */

export type Nature = 'action' | 'reflection'
export type RootState = 'raw' | 'developing' | 'hatched' | 'archived'
export type Source = 'ai' | 'user'
/** `idea` : suggestion de l'IA acceptée — une idée à creuser, avec ses conseils et ses sources. */
export type NeuronKind =
  'root' | 'answer' | 'condition' | 'branch' | 'opportunity' | 'investigation' | 'user_branch' | 'idea'
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
  readonly origin: Source
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

/** Résumé de l'idée de départ par l'IA ; `null` tant qu'il n'y a rien à résumer ou que l'IA n'a pas répondu. */
export interface IdeaSummaryView {
  readonly summary: string | null
  /** L'idée a changé depuis ce résumé et l'IA n'a pas pu le refaire. */
  readonly stale: boolean
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

export type SynthesisStatus = 'proposed' | 'confirmed' | 'rejected' | 'superseded' | 'stale'

export type SynthesisContent =
  | { readonly type: 'action_plan'; readonly plan: ActionPlanOut }
  | { readonly type: 'reflection_summary'; readonly summary: ReflectionSummaryOut }

/** Synthèse proposée au verrouillage : rien n'est appliqué avant `fusion:confirm`. */
export type SynthesisView = SynthesisContent & {
  readonly id: string
  readonly rootId: string
  readonly status: SynthesisStatus
  readonly baseVersion: number
  readonly instruction: string | null
  /** Verrouillage demandé avant que le contexte soit suffisant : résultat possiblement non optimal. */
  readonly forced: boolean
  /** Produite par l'IA locale faute de Claude : qualité moindre. */
  readonly degraded: boolean
  /** Alias `sN` cités dans `sourceRefs` → identifiant du sous-neurone. */
  readonly sources: Readonly<Record<string, string>>
  readonly createdAt: string
}

export interface ConfirmView {
  readonly batchId: string
  readonly root: RootView
  /** Widgets créés pour les outils cochés (spec 006) ; Claude les génère ensuite en arrière-plan. */
  readonly toolBlockIds: readonly string[]
}

/** `superseded` : lien remplacé par l'idée née de sa graine (A — idée — B), masqué, restauré par l'annulation. */
export type LinkStatus = 'suggested' | 'accepted' | 'rejected' | 'superseded'

/** Lien libellé entre deux idées (réseau des neurones éclos). */
export interface LinkView {
  readonly id: string
  readonly a: { readonly id: string; readonly title: string }
  readonly b: { readonly id: string; readonly title: string }
  readonly label: string
  readonly justification: string | null
  readonly origin: Source
  readonly status: LinkStatus
  readonly createdAt: string
}

export type SeedStatus = 'suggested' | 'accepted' | 'rejected'

/** Graine d'un lien (spec 003 FR-028) : en attente sur un lien accepté, ou acceptée (`bornRootId`). */
export interface SeedView {
  readonly id: string
  readonly linkId: string
  readonly title: string
  readonly why: string
  readonly status: SeedStatus
  readonly bornRootId: string | null
  /** Les deux idées reliées : l'idée née est « née de A × B ». */
  readonly parents: readonly [
    { readonly id: string; readonly title: string },
    { readonly id: string; readonly title: string }
  ]
}

/** Réponse des canaux `growth:*` : l'arbre à jour et, éventuellement, un avertissement à montrer. */
export interface GrowthResultView {
  readonly tree: TreeView
  /** Ex. `FEW_EXTENSIONS`, `OUT_OF_SCOPE`, `DEPTH_LIMIT`, `AI_UNAVAILABLE`, `BUDGET_EXCEEDED`. */
  readonly notice?: { readonly code: string; readonly message: string }
}

/**
 * Correction d'un élément d'une synthèse proposée (`fusion:editProposed`) : `ref` d'un nœud de plan (titre,
 * montant, date ; `null` efface) ou `section.index` d'un point de synthèse de réflexion (texte).
 */
export interface SynthesisPatch {
  readonly ref: string
  readonly title?: string
  readonly amountCents?: number | null
  readonly dueDate?: string | null
  readonly text?: string
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
