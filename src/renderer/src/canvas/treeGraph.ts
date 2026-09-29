import type { BranchEdgeData, BranchEdgeType } from './edges/BranchEdge'
import type { PlacedItem } from './ideaTreeLayout'
import {
  isIdeaItem,
  treeAriaLabel,
  treeRadius,
  TREE_RADIUS,
  TREE_SIZE,
  type DocNodeType,
  type NoteNodeType,
  type TreeNodeType
} from './nodes/TreeNodes'
import type { Body, Point, Spring } from './physics'
import type { OpenTree } from './treeStore'

/** Longueur des ressorts de l'arbre : branches, questions « + », texte accroché à son idée. */
const BRANCH = { neuron: 160, slot: 112, note: 128 } as const
/** Largeur de la fiche d'une idée (ouverte à côté d'elle). */
const DOC_WIDTH = 320

/** Texte complet d'une idée (conseils), accroché à elle sur la carte. */
function noteOf(placed: PlacedItem): string | null {
  const { item } = placed
  const text =
    item.type === 'ghost'
      ? item.suggestion.content
      : item.type === 'neuron' && item.kind === 'idea'
        ? item.content
        : null
  return text === null || text === '' ? null : text
}

const noteId = (itemId: string): string => `note-${itemId}`

/** Place de départ d'un élément : sa place mémorisée, sinon autour de l'idée (disposition radiale). */
function startOf(placed: PlacedItem, root: Point): Point {
  const saved = placed.item.type === 'neuron' ? placed.item.position : null
  return saved ?? { x: root.x + placed.point.x, y: root.y + placed.point.y }
}

/** Objets et ressorts de l'arbre ouvert pour la physique de la carte. */
export function treeBodies(tree: OpenTree, root: Point): { bodies: Body[]; springs: Spring[] } {
  const bodies: Body[] = []
  const springs: Spring[] = []
  for (const placed of tree.items) {
    const start = startOf(placed, root)
    const pinned = placed.item.type === 'neuron' && placed.item.pinned
    bodies.push({ id: placed.item.id, radius: treeRadius(placed), x: start.x, y: start.y, pinned, gravity: false })
    const slot = placed.item.type === 'slot'
    springs.push({
      source: placed.parentId,
      target: placed.item.id,
      distance: slot ? BRANCH.slot : BRANCH.neuron,
      strength: slot ? 0.9 : 0.6
    })
    if (noteOf(placed) !== null) {
      const id = noteId(placed.item.id)
      bodies.push({ id, radius: TREE_RADIUS.note, x: start.x + 64, y: start.y + 64, pinned: false, gravity: false })
      springs.push({ source: placed.item.id, target: id, distance: BRANCH.note, strength: 0.8 })
    }
  }
  return { bodies, springs }
}

function edgeStyle(placed: PlacedItem): BranchEdgeData {
  const dashed = placed.item.type !== 'neuron'
  if (isIdeaItem(placed)) return { style: dashed ? 'idea-dashed' : 'idea' }
  return { style: dashed ? 'dashed' : 'solid' }
}

export interface TreeGraphInput {
  readonly tree: OpenTree
  readonly positions: ReadonlyMap<string, Point>
  readonly root: Point
  readonly docId: string | null
  readonly expanded: ReadonlySet<string>
  readonly closeDoc: () => void
}

/** Nœuds et traits de l'arbre ouvert, placés par la physique ; pendant l'éclosion, tout glisse vers l'idée. */
export function treeGraph(input: TreeGraphInput): {
  nodes: (TreeNodeType | NoteNodeType | DocNodeType)[]
  edges: BranchEdgeType[]
} {
  const { tree, positions, root } = input
  const fusing = tree.fusing ? { className: 'tree-fusing' } : {}
  const at = (id: string, fallback: Point): Point => (tree.fusing ? root : (positions.get(id) ?? fallback))
  const nodes: (TreeNodeType | NoteNodeType | DocNodeType)[] = []
  const edges: BranchEdgeType[] = []
  for (const placed of tree.items) {
    const { item } = placed
    const start = startOf(placed, root)
    const focused = item.id === tree.focusId
    const selected = item.type === 'slot' && item.id === tree.selectedExtensionId
    nodes.push({
      id: item.id,
      type: 'tree',
      position: at(item.id, start),
      data: { placed, focused, selected, categoryColor: tree.categoryColor, onDismiss: tree.actions.dismissSuggestion },
      ariaLabel: treeAriaLabel(placed),
      // Élément activable (clic, Entrée) ; une idée suggérée contient son bouton « Ignorer » : c'est un groupe.
      ariaRole: item.type === 'ghost' ? 'group' : item.type === 'pending' ? 'status' : 'button',
      ...(item.type === 'neuron' || item.type === 'slot'
        ? { domAttributes: { 'aria-pressed': item.type === 'neuron' ? focused : selected } }
        : {}),
      deletable: false,
      ...fusing
    })
    edges.push({
      id: `branch-${item.id}`,
      type: 'branch',
      source: placed.parentId,
      target: item.id,
      data: edgeStyle(placed),
      deletable: false,
      selectable: false,
      focusable: false,
      ...fusing
    })
    const text = noteOf(placed)
    if (text !== null) {
      const id = noteId(item.id)
      nodes.push({
        id,
        type: 'note',
        position: at(id, { x: start.x + 64, y: start.y + 64 }),
        data: { itemId: item.id, text, open: input.expanded.has(item.id) },
        ariaLabel: `Texte de l’idée : ${text}`,
        ariaRole: 'button',
        domAttributes: { 'aria-expanded': input.expanded.has(item.id) },
        deletable: false,
        ...fusing
      })
    }
    if (input.docId === item.id && item.type === 'neuron' && !tree.fusing) {
      const center = positions.get(item.id) ?? start
      nodes.push({
        id: `doc-${item.id}`,
        type: 'doc',
        position: { x: center.x + TREE_SIZE.idea / 2 + 16 + DOC_WIDTH / 2, y: center.y },
        data: { title: item.title, content: item.content, sources: item.sources, onClose: input.closeDoc },
        draggable: false,
        selectable: false,
        focusable: false,
        deletable: false,
        zIndex: 1000
      })
    }
  }
  return { nodes, edges }
}
