import type { Node } from '@xyflow/react'
import type {
  BlockView,
  ElementRelation,
  ElementView,
  CanvasNeuronView,
  IdeasCanvasView,
  MapLinkView
} from '@shared/ipc/canvas'
import type { BranchEdgeType } from './edges/BranchEdge'
import type { MapLinkEdgeType } from './edges/MapLinkEdge'
import { structureGraph } from './structureGraph'
import { areaFor, forceLayout, type LayoutNode, type Point, type Rect } from './forceLayout'

/**
 * Taille d'une idée selon son niveau de contexte (FR-029) : plus elle est complète, plus elle est grande.
 * Cinq paliers nets, multiples de 8 : brute (jamais travaillée), insuffisant, suffisant, complet, éclose.
 */
export type Tier = 'raw' | 'insufficient' | 'sufficient' | 'complete' | 'hatched'
export const TIER_SIZE: Readonly<Record<Tier, number>> = {
  raw: 40,
  insufficient: 56,
  sufficient: 72,
  complete: 88,
  hatched: 104
}
/** Aspect selon l'état : pointillés (brute), plein (en développement), double anneau + halo (éclose). */
type CanvasState = 'raw' | 'developing' | 'hatched'

export type NeuronNodeData = {
  readonly neuron: CanvasNeuronView
  /** Un filtre est actif et cette idée n'y correspond pas : estompée, toujours présente. */
  readonly dimmed: boolean
}
export type NeuronNodeType = Node<NeuronNodeData, 'neuron'>

export type BlockNodeData = { readonly block: BlockView }
export type BlockNodeType = Node<BlockNodeData, 'block'>
/** Note posée sur la carte (spec 004). Type React Flow « label » : « note » désigne déjà le texte d'un sous-neurone. */
export type LabelNodeType = Node<BlockNodeData, 'label'>
export type WidgetNodeType = Node<BlockNodeData, 'widget'>
/** Cadre résultat d'un widget (spec 005). */
export type ResultNodeType = Node<BlockNodeData, 'result'>
/** Note titrée et cadre de regroupement (spec 007, pont MCP). « mapNote » : « note » désigne le texte d'un sous-neurone. */
export type MapNoteNodeType = Node<BlockNodeData, 'mapNote'>
export type FrameNodeType = Node<BlockNodeData, 'frame'>
/** Élément d'une carte de structure de projet (spec 009). */
export type ElementNodeType = Node<{ readonly element: ElementView }, 'element'>

export type CanvasNode =
  | NeuronNodeType
  | BlockNodeType
  | LabelNodeType
  | WidgetNodeType
  | ResultNodeType
  | MapNoteNodeType
  | FrameNodeType
  | ElementNodeType

const BLOCK_NODE_TYPES = {
  empty: 'block',
  label: 'label',
  widget: 'widget',
  result: 'result',
  note: 'mapNote',
  frame: 'frame'
} as const

function blockAriaLabel(block: BlockView): string {
  if (block.kind === 'label') return block.text === '' || block.text === null ? 'Note vide' : `Note : ${block.text}`
  if (block.kind === 'result') return 'Résultat d’un widget'
  const byClaude = block.origin === 'claude' ? ', par Claude' : ''
  if (block.kind === 'note') return `Note « ${block.title ?? 'Note'} »${byClaude}`
  if (block.kind === 'frame') return `Cadre « ${block.title ?? 'Cadre'} »${byClaude}`
  return block.kind === 'widget' ? 'Widget IA' : 'Bloc vide'
}

/** Relations d'une carte de structure, en clair (L1e §3). */
const RELATION_LABELS: Readonly<Record<ElementRelation, string>> = {
  depend_de: 'dépend de',
  appelle: 'appelle',
  lit_ecrit: 'lit / écrit',
  implemente: 'implémente',
  teste: 'teste',
  bloque: 'bloque'
}

const STATE_LABELS: Record<CanvasState, string> = {
  raw: 'Idée brute',
  developing: 'En développement',
  hatched: 'Idée éclose'
}
const LEVEL_LABELS = { insufficient: 'insuffisant', sufficient: 'suffisant', complete: 'complet' } as const
const NATURE_LABELS = { action: 'Action', reflection: 'Réflexion' } as const

export function canvasState(neuron: CanvasNeuronView): CanvasState {
  return neuron.state === 'hatched' ? 'hatched' : neuron.state === 'developing' ? 'developing' : 'raw'
}

export function tierOf(neuron: CanvasNeuronView): Tier {
  if (neuron.state === 'hatched') return 'hatched'
  return neuron.contextLevel ?? 'raw'
}

/** Rayon occupé pour la disposition : le cercle. */
function layoutRadius(neuron: CanvasNeuronView): number {
  return TIER_SIZE[tierOf(neuron)] / 2
}

/** Liens libres entre deux idées (les autres relient des blocs ou des éléments). */
export function ideaLinks(view: IdeasCanvasView): MapLinkView[] {
  return view.mapLinks.filter((link) => link.from.kind === 'idea' && link.to.kind === 'idea')
}

/** Texte lu par les lecteurs d'écran (état, contexte, titre, nature, catégorie, origine IA). */
export function neuronAriaLabel(neuron: CanvasNeuronView): string {
  const level =
    neuron.state === 'hatched' || neuron.contextLevel === null ? '' : `, contexte ${LEVEL_LABELS[neuron.contextLevel]}`
  const parts = [`${STATE_LABELS[canvasState(neuron)]}${level} : ${neuron.title}`]
  parts.push(`${NATURE_LABELS[neuron.nature]}${neuron.natureSource === 'ai' ? ' (proposée par l’IA)' : ''}`)
  parts.push(
    neuron.category === null
      ? 'à classer'
      : `catégorie ${neuron.category.label}${neuron.categorySource === 'ai' ? ' (proposée par l’IA)' : ''}`
  )
  return parts.join(', ')
}

export function layoutInput(view: IdeasCanvasView): LayoutNode[] {
  return view.ideas.map((neuron) => ({ id: neuron.id, radius: layoutRadius(neuron), initial: neuron.position }))
}

export interface CanvasLayout {
  readonly area: Rect
  readonly positions: ReadonlyMap<string, Point>
}

/** Marge autour des idées posées à la main, pour qu'elles restent dans l'espace (et ne soient pas replacées). */
const AREA_MARGIN = 128

/** Espace de la carte : dimensionné selon le nombre d'idées, agrandi pour englober toutes les positions connues. */
function areaOf(view: IdeasCanvasView): Rect {
  const base = areaFor(view.ideas.length)
  const known = view.ideas.flatMap((neuron) => (neuron.position === null ? [] : [neuron.position]))
  if (known.length === 0) return base
  const left = Math.min(base.x, ...known.map((point) => point.x - AREA_MARGIN))
  const top = Math.min(base.y, ...known.map((point) => point.y - AREA_MARGIN))
  const right = Math.max(base.x + base.width, ...known.map((point) => point.x + AREA_MARGIN))
  const bottom = Math.max(base.y + base.height, ...known.map((point) => point.y + AREA_MARGIN))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

export function computeLayout(view: IdeasCanvasView): CanvasLayout {
  const area = areaOf(view)
  const links = ideaLinks(view).map((link) => ({ source: link.from.id, target: link.to.id }))
  return { area, positions: forceLayout(layoutInput(view), links, area) }
}

/** Idées dont la position calculée diffère de celle enregistrée (à mémoriser pour la prochaine ouverture). */
export function movedPositions(
  view: IdeasCanvasView,
  positions: ReadonlyMap<string, Point>
): { rootId: string; x: number; y: number }[] {
  return view.ideas.flatMap((neuron) => {
    const point = positions.get(neuron.id)
    if (point === undefined) return []
    const saved = neuron.position
    const moved = saved === null || Math.hypot(saved.x - point.x, saved.y - point.y) > 1
    return moved ? [{ rootId: neuron.id, x: point.x, y: point.y }] : []
  })
}

/** Vue de l'écran Idées → nœuds (idées, blocs) et arêtes (liens) React Flow. Positions = centres (nodeOrigin 0.5). */
export function buildGraph(
  view: IdeasCanvasView,
  layout: CanvasLayout,
  /** Idée qui vient de naître (double-clic, capture) : elle pousse (250 ms). */
  bornId: string | null = null,
  /** Idée ouverte dans le volet : mise en avant, les autres estompées (elles restent cliquables). */
  openRootId: string | null = null
): {
  nodes: CanvasNode[]
  edges: BranchEdgeType[]
  mapEdges: (MapLinkEdgeType | BranchEdgeType)[]
} {
  const highlighted = view.highlighted === null ? null : new Set(view.highlighted)
  const isDimmed = (id: string): boolean =>
    (highlighted !== null && !highlighted.has(id)) || (openRootId !== null && id !== openRootId)
  const neuronNodes = view.ideas.map((neuron): NeuronNodeType => ({
    id: neuron.id,
    type: 'neuron',
    position: layout.positions.get(neuron.id) ?? { x: 0, y: 0 },
    data: { neuron, dimmed: isDimmed(neuron.id) },
    ...(neuron.id === bornId
      ? { className: 'neuron-born' }
      : neuron.id === openRootId
        ? { className: 'neuron-open' }
        : {}),
    ariaLabel: neuronAriaLabel(neuron),
    deletable: false
  }))
  const blockNodes = view.blocks.map((block): CanvasNode => ({
    id: block.id,
    type: BLOCK_NODE_TYPES[block.kind],
    // Un cadre se dessine sous ce qu'il regroupe.
    ...(block.kind === 'frame' ? { zIndex: -1 } : {}),
    position: { x: block.x, y: block.y },
    width: block.width,
    height: block.height,
    data: { block },
    ariaLabel: blockAriaLabel(block),
    deletable: false
  }))
  const ioEdges = view.io.map((link): BranchEdgeType => ({
    id: `io-${link.id}`,
    type: 'branch',
    source: link.sourceId,
    target: link.blockId,
    data: { style: 'io' },
    deletable: false,
    selectable: false,
    focusable: false
  }))
  // Un cadre résultat est relié au widget dont il affiche la sortie.
  const resultEdges = view.blocks.flatMap((block): BranchEdgeType[] =>
    block.sourceBlockId === null
      ? []
      : [
          {
            id: `result-line-${block.id}`,
            type: 'branch',
            source: block.sourceBlockId,
            target: block.id,
            data: { style: 'io' },
            deletable: false,
            selectable: false,
            focusable: false
          }
        ]
  )
  // Arbre de notes dessiné par Claude (spec 007) : trait plein du parent à l'enfant.
  const visibleBlocks = new Set(view.blocks.map((block) => block.id))
  const noteEdges = view.blocks.flatMap((block): BranchEdgeType[] =>
    block.parentBlockId === null || !visibleBlocks.has(block.parentBlockId)
      ? []
      : [
          {
            id: `note-line-${block.id}`,
            type: 'branch',
            source: block.parentBlockId,
            target: block.id,
            data: { style: 'solid' },
            deletable: false,
            selectable: false,
            focusable: false
          }
        ]
  )
  const visible = new Set([...visibleBlocks, ...view.ideas.map((neuron) => neuron.id)])
  const mapEdges = view.mapLinks
    .filter((link) => link.relation === null && visible.has(link.from.id) && visible.has(link.to.id))
    .map((link): MapLinkEdgeType => ({
      id: `map-${link.id}`,
      type: 'mapLink',
      source: link.from.id,
      target: link.to.id,
      data: { label: link.label },
      deletable: false,
      selectable: false,
      focusable: false
    }))
  // Cartes de structure des projets liés (spec 009) : éléments dépliés autour de leur genesis, liens typés regroupés.
  const genesisCenters = new Map(neuronNodes.map((node) => [node.id, node.position] as const))
  const structure = structureGraph(view.elements, genesisCenters, view.mapLinks)
  const elementNodes = structure.placed.map((entry): ElementNodeType => ({
    id: entry.element.id,
    type: 'element',
    position: { x: entry.x, y: entry.y },
    data: { element: entry.element },
    draggable: false,
    ariaLabel: `${entry.element.type} « ${entry.element.title} »${entry.element.childCount > 0 ? `, ${entry.element.childCount} éléments ${entry.element.collapsed ? 'repliés' : 'dépliés'}` : ''}`,
    deletable: false
  }))
  const structureEdges = structure.edges.map((edge): MapLinkEdgeType | BranchEdgeType =>
    edge.kind === 'hierarchy'
      ? {
          id: edge.id,
          type: 'branch',
          source: edge.source,
          target: edge.target,
          data: { style: 'solid' },
          deletable: false,
          selectable: false,
          focusable: false
        }
      : {
          id: edge.id,
          type: 'mapLink',
          source: edge.source,
          target: edge.target,
          data: {
            label: [
              edge.relation === null ? null : RELATION_LABELS[edge.relation],
              edge.label,
              edge.count > 1 ? `×${edge.count}` : null
            ]
              .filter((part) => part !== null)
              .join(' · '),
            relation: edge.relation
          },
          deletable: false,
          selectable: false,
          focusable: false
        }
  )
  return {
    nodes: [...neuronNodes, ...blockNodes, ...elementNodes],
    edges: [...ioEdges, ...resultEdges, ...noteEdges],
    mapEdges: [...mapEdges, ...structureEdges]
  }
}
