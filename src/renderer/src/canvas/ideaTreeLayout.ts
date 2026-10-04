import type {
  ExtensionView,
  NeuronKind,
  NeuronOrigin,
  SuggestionView,
  TreeView,
  WebSourceView
} from '@shared/ipc/neurons'

/**
 * Arbre d'une idée ouverte, dessiné sur la carte autour d'elle (FR-013 révisée) : disposition radiale — chaque
 * niveau sur un anneau, chaque branche dans un secteur proportionnel à son nombre de feuilles. Les questions « + »,
 * les suggestions de l'IA et le sous-neurone en attente s'accrochent au neurone ciblé. Fonction pure.
 */

export interface Point {
  readonly x: number
  readonly y: number
}

export type TreeItem =
  | {
      readonly type: 'neuron'
      readonly id: string
      readonly title: string
      readonly kind: NeuronKind
      readonly origin: NeuronOrigin
      readonly descendants: number
      /** Texte complet (conseils d'une idée suggérée) et sources web vérifiées. */
      readonly content: string | null
      readonly sources: readonly WebSourceView[]
      /** Place mémorisée (glissé à la main : épinglé). */
      readonly position: Point | null
      readonly pinned: boolean
    }
  | { readonly type: 'pending'; readonly id: string; readonly title: string }
  | { readonly type: 'ghost'; readonly id: string; readonly suggestion: SuggestionView }
  | { readonly type: 'slot'; readonly id: string; readonly extension: ExtensionView }

export interface PlacedItem {
  readonly item: TreeItem
  readonly point: Point
  /** Position du parent (l'idée elle-même = centre (0, 0)). */
  readonly from: Point
  /** Le parent est l'idée elle-même (le trait part du bord de son cercle). */
  readonly fromRoot: boolean
  /** Identifiant du parent (l'idée elle-même ou un sous-neurone) : ressort de la physique, trait de l'arbre. */
  readonly parentId: string
}

export interface IdeaTreeLayout {
  readonly items: readonly PlacedItem[]
  /** Rayon occupé (titres compris), pour la taille du calque. */
  readonly extent: number
}

/** Distance entre deux anneaux, et minimum entre deux éléments voisins d'un même anneau. */
export const RING = 136
export const ITEM_SPACING = 104

interface Branch {
  readonly item: TreeItem | null
  readonly children: Branch[]
}

export function ideaTreeLayout(
  tree: TreeView,
  focusId: string,
  pending: readonly { readonly extensionId: string; readonly title: string }[] = []
): IdeaTreeLayout {
  const rootId = tree.root.id
  const byParent = new Map<string, TreeView['neurons'][number][]>()
  for (const neuron of tree.neurons) {
    const parentId = neuron.parentId ?? rootId
    byParent.set(parentId, [...(byParent.get(parentId) ?? []), neuron])
  }
  const count = (id: string): number =>
    (byParent.get(id) ?? []).reduce((total, child) => total + 1 + count(child.id), 0)
  const focus = focusId === rootId || tree.neurons.some((neuron) => neuron.id === focusId) ? focusId : rootId

  const extrasOf = (id: string): Branch[] =>
    id !== focus
      ? []
      : [
          ...pending.map((entry) => leaf({ type: 'pending', id: `pending-${entry.extensionId}`, title: entry.title })),
          ...tree.suggestions
            .filter((suggestion) => suggestion.neuronId === id)
            .map((suggestion) => leaf({ type: 'ghost', id: suggestion.id, suggestion })),
          ...tree.extensions
            .filter((extension) => extension.neuronId === id)
            .map((extension) => leaf({ type: 'slot', id: extension.id, extension }))
        ]
  const build = (id: string, item: TreeItem | null): Branch => ({
    item,
    children: [
      ...(byParent.get(id) ?? []).map((neuron) =>
        build(neuron.id, {
          type: 'neuron',
          id: neuron.id,
          title: neuron.title,
          kind: neuron.kind,
          origin: neuron.origin,
          descendants: count(neuron.id),
          content: neuron.content,
          sources: neuron.sources ?? [],
          position: neuron.position ?? null,
          pinned: neuron.pinned ?? false
        })
      ),
      ...extrasOf(id)
    ]
  })
  const root = build(rootId, null)

  // Rayon de chaque anneau : assez grand pour que ses éléments ne se touchent pas.
  const perDepth: number[] = []
  const tally = (branch: Branch, depth: number): void => {
    for (const child of branch.children) {
      perDepth[depth] = (perDepth[depth] ?? 0) + 1
      tally(child, depth + 1)
    }
  }
  tally(root, 0)
  const radii: number[] = []
  perDepth.forEach((n, depth) => {
    const previous = depth === 0 ? 0 : (radii[depth - 1] ?? 0)
    radii[depth] = Math.max(RING * (depth + 1), previous + RING, (n * ITEM_SPACING) / (2 * Math.PI))
  })

  const leaves = (branch: Branch): number =>
    branch.children.length === 0 ? 1 : branch.children.reduce((total, child) => total + leaves(child), 0)
  const items: PlacedItem[] = []
  const place = (branch: Branch, from: Point, depth: number, start: number, span: number): void => {
    const parentId = branch.item?.id ?? rootId
    const total = leaves(branch)
    let cursor = start
    for (const child of branch.children) {
      const share = (span * leaves(child)) / total
      const angle = cursor + share / 2
      const radius = radii[depth] ?? RING
      const point = { x: round(radius * Math.cos(angle)), y: round(radius * Math.sin(angle)) }
      if (child.item !== null) items.push({ item: child.item, point, from, fromRoot: depth === 0, parentId })
      place(child, point, depth + 1, cursor, share)
      cursor += share
    }
  }
  // Premier élément en haut, puis dans le sens des aiguilles d'une montre.
  place(root, { x: 0, y: 0 }, 0, -Math.PI / 2, 2 * Math.PI)

  return { items, extent: (radii.at(-1) ?? 0) + 96 }
}

function leaf(item: TreeItem): Branch {
  return { item, children: [] }
}

const round = (value: number): number => Math.round(value * 10) / 10
