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
  readonly gauge: GaugeView | null
}

export interface RootListView {
  readonly items: readonly RootView[]
  readonly nextCursor: string | null
}
