import type { ActionPlanOut, ReflectionSummaryOut } from '../ai/neurons'

/** Vues et entrées IPC du moteur de neurones (spec 002 contracts/ipc-neurons.md). */

export type Nature = 'action' | 'reflection'
export type RootState = 'raw' | 'developing' | 'hatched' | 'archived'
export type Source = 'ai' | 'user'
export type NeuronKind = 'root' | 'answer' | 'condition' | 'branch' | 'opportunity' | 'investigation' | 'user_branch'
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
  readonly research: 'none' | 'pending' | 'done' | 'failed'
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
}

export type LinkStatus = 'suggested' | 'accepted' | 'rejected'

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
