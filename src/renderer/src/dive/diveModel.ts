import type {
  ExtensionView,
  GaugeView,
  NeuronKind,
  RootView,
  NeuronOrigin,
  SuggestionView,
  TreeView
} from '@shared/ipc/neurons'

/** Un neurone tel que la plongée l'affiche (racine comprise, profondeur 0). */
export interface DiveNeuron {
  readonly id: string
  readonly title: string
  readonly content: string | null
  readonly kind: NeuronKind
  readonly depth: number
  readonly origin: NeuronOrigin
  /** Nombre de descendants (suppression : confirmation s'il y en a). */
  readonly descendants: number
}

/** Vue de la plongée (spec 003 data-model `DiveView`), calculée à partir de l'arbre du moteur (002). */
export interface DiveModel {
  readonly root: RootView
  readonly focus: DiveNeuron
  readonly breadcrumb: readonly { readonly id: string; readonly title: string }[]
  readonly parent: DiveNeuron | null
  readonly children: readonly DiveNeuron[]
  /** Questions proposées pour le neurone ciblé. */
  readonly extensions: readonly ExtensionView[]
  /** Suggestions de l'IA (neurones fantômes) rattachées au neurone ciblé. */
  readonly suggestions: readonly SuggestionView[]
  readonly gauge: GaugeView | null
}

/** Profondeur maximale développée par l'IA (spec 002, garde-fou). */
export const MAX_AI_DEPTH = 6

interface RawNode {
  readonly id: string
  readonly parentId: string | null
  readonly title: string
  readonly content: string | null
  readonly kind: NeuronKind
  readonly depth: number
  readonly origin: NeuronOrigin
}

/** Construit la vue de plongée ; un neurone ciblé introuvable (supprimé entre-temps) ramène à la racine. */
export function diveModel(tree: TreeView, focusId: string | null): DiveModel {
  const rootNode: RawNode = {
    id: tree.root.id,
    parentId: null,
    title: tree.root.title,
    content: tree.root.content,
    kind: 'root',
    depth: 0,
    origin: 'user'
  }
  const nodes = new Map<string, RawNode>([[rootNode.id, rootNode], ...tree.neurons.map((n) => [n.id, n] as const)])
  const childrenOf = new Map<string, RawNode[]>()
  for (const node of tree.neurons) {
    const parentId = node.parentId ?? rootNode.id
    childrenOf.set(parentId, [...(childrenOf.get(parentId) ?? []), node])
  }
  const descendants = (id: string): number =>
    (childrenOf.get(id) ?? []).reduce((total, child) => total + 1 + descendants(child.id), 0)
  const view = (node: RawNode): DiveNeuron => ({
    id: node.id,
    title: node.title,
    content: node.content,
    kind: node.kind,
    depth: node.depth,
    origin: node.origin,
    descendants: descendants(node.id)
  })

  const focusNode = (focusId === null ? undefined : nodes.get(focusId)) ?? rootNode
  const path: RawNode[] = []
  for (let current: RawNode | undefined = focusNode; current !== undefined;) {
    path.unshift(current)
    current = current.parentId === null ? undefined : nodes.get(current.parentId)
  }
  // Un sous-neurone sans parent enregistré est rattaché à la racine.
  if (path[0]?.id !== rootNode.id) path.unshift(rootNode)
  const parentNode = path.length > 1 ? path[path.length - 2] : undefined

  return {
    root: tree.root,
    focus: view(focusNode),
    breadcrumb: path.map((node) => ({ id: node.id, title: node.title })),
    parent: parentNode === undefined ? null : view(parentNode),
    children: (childrenOf.get(focusNode.id) ?? []).map(view),
    extensions: tree.extensions.filter((extension) => extension.neuronId === focusNode.id),
    suggestions: tree.suggestions.filter((suggestion) => suggestion.neuronId === focusNode.id),
    gauge: tree.gauge
  }
}
