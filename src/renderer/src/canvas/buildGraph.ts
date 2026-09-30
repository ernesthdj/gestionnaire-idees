import type { Edge, Node } from '@xyflow/react'
import type { BlockView, CanvasNeuronView, IdeasCanvasView, StepView } from '@shared/ipc/canvas'
import type { LinkView, SeedView } from '@shared/ipc/neurons'
import type { BranchEdgeType } from './edges/BranchEdge'
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
/** Place réservée autour d'une idée en développement pour ses satellites (premiers sous-neurones). */
export const SATELLITE_MARGIN = 24

/** Aspect selon l'état : pointillés (brute), plein (en développement), double anneau + halo (éclose). */
type CanvasState = 'raw' | 'developing' | 'hatched'

export type NeuronNodeData = {
  readonly neuron: CanvasNeuronView
  /** Un filtre est actif et cette idée n'y correspond pas : estompée, toujours présente. */
  readonly dimmed: boolean
}
export type NeuronNodeType = Node<NeuronNodeData, 'neuron'>

export type LinkEdgeData = {
  readonly link: LinkView
  readonly dimmed: boolean
  /** Graine en attente sur ce lien accepté (FR-028). */
  readonly seed: SeedView | null
}
export type LinkEdgeType = Edge<LinkEdgeData, 'link'>

export type BlockNodeData = { readonly block: BlockView }
export type BlockNodeType = Node<BlockNodeData, 'block'>
/** Note posée sur la carte (spec 004). Type React Flow « label » : « note » désigne déjà le texte d'un sous-neurone. */
export type LabelNodeType = Node<BlockNodeData, 'label'>
export type WidgetNodeType = Node<BlockNodeData, 'widget'>

/** « Prochaine étape » d'une idée (FR-037) : non modifiable, reliée à son idée. */
export type StepNodeData = { readonly step: StepView; readonly dimmed: boolean }
export type StepNodeType = Node<StepNodeData, 'step'>

export type CanvasNode = NeuronNodeType | BlockNodeType | LabelNodeType | WidgetNodeType | StepNodeType

/** Identifiant du nœud (et du corps physique) de la prochaine étape d'une idée. */
export const stepNodeId = (rootId: string): string => `step-${rootId}`
/** Idée dont ce nœud est la prochaine étape ; `null` si ce n'est pas un nœud d'étape. */
export const stepRootId = (nodeId: string): string | null =>
  nodeId.startsWith('step-') ? nodeId.slice('step-'.length) : null
/** Place de départ d'une étape jamais glissée : en bas à droite de son idée. */
export const STEP_OFFSET = { x: 190, y: 130 } as const

const BLOCK_NODE_TYPES = { empty: 'block', label: 'label', widget: 'widget' } as const

function blockAriaLabel(block: BlockView): string {
  if (block.kind === 'label') return block.text === '' || block.text === null ? 'Note vide' : `Note : ${block.text}`
  return block.kind === 'widget' ? 'Widget IA' : 'Bloc vide'
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

/** Rayon occupé pour la disposition : le cercle, et ses satellites s'il en a. */
function layoutRadius(neuron: CanvasNeuronView): number {
  const satellites = canvasState(neuron) === 'developing' && neuron.subNeurons.length > 0
  return TIER_SIZE[tierOf(neuron)] / 2 + (satellites ? SATELLITE_MARGIN : 0)
}

/** Parents d'une idée née d'une graine, par identifiant de l'idée née. */
export function bornFrom(view: IdeasCanvasView): Map<string, SeedView['parents']> {
  return new Map(
    view.seeds.flatMap((seed) => (seed.bornRootId === null ? [] : [[seed.bornRootId, seed.parents] as const]))
  )
}

/** Texte lu par les lecteurs d'écran (état, contexte, titre, nature, catégorie, origine IA, parents). */
export function neuronAriaLabel(neuron: CanvasNeuronView, parents?: SeedView['parents']): string {
  const level =
    neuron.state === 'hatched' || neuron.contextLevel === null ? '' : `, contexte ${LEVEL_LABELS[neuron.contextLevel]}`
  const parts = [`${STATE_LABELS[canvasState(neuron)]}${level} : ${neuron.title}`]
  if (parents !== undefined) parts.push(`née de ${parents[0].title} × ${parents[1].title}`)
  parts.push(`${NATURE_LABELS[neuron.nature]}${neuron.natureSource === 'ai' ? ' (proposée par l’IA)' : ''}`)
  parts.push(
    neuron.category === null
      ? 'à classer'
      : `catégorie ${neuron.category.label}${neuron.categorySource === 'ai' ? ' (proposée par l’IA)' : ''}`
  )
  if (neuron.subCount > 0) parts.push(`${neuron.subCount} sous-neurone${neuron.subCount > 1 ? 's' : ''}`)
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
  const links = view.links.map((link) => ({ source: link.a.id, target: link.b.id }))
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
  /** Idée qui vient de naître (graine ou double-clic) : elle pousse (250 ms). */
  bornId: string | null = null,
  /** Idée ouverte dans le volet : mise en avant, les autres estompées (elles restent cliquables). */
  openRootId: string | null = null
): { nodes: CanvasNode[]; edges: LinkEdgeType[]; stepEdges: BranchEdgeType[] } {
  const highlighted = view.highlighted === null ? null : new Set(view.highlighted)
  const isDimmed = (id: string): boolean =>
    (highlighted !== null && !highlighted.has(id)) || (openRootId !== null && id !== openRootId)
  const parentsOf = bornFrom(view)
  const pendingSeeds = new Map(
    view.seeds.filter((seed) => seed.status === 'suggested').map((seed) => [seed.linkId, seed] as const)
  )
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
    ariaLabel: neuronAriaLabel(neuron, parentsOf.get(neuron.id)),
    deletable: false
  }))
  const edges = view.links.map((link): LinkEdgeType => ({
    id: link.id,
    type: 'link',
    source: link.a.id,
    target: link.b.id,
    data: {
      link,
      dimmed: isDimmed(link.a.id) && isDimmed(link.b.id),
      seed: link.status === 'accepted' ? (pendingSeeds.get(link.id) ?? null) : null
    },
    ariaLabel: `Lien${link.label === '' ? '' : ` « ${link.label} »`} entre ${link.a.title} et ${link.b.title}${link.status === 'suggested' ? ', suggéré par l’IA' : ''}`,
    deletable: false,
    selectable: false
  }))
  const blockNodes = view.blocks.map((block): BlockNodeType | LabelNodeType | WidgetNodeType => ({
    id: block.id,
    type: BLOCK_NODE_TYPES[block.kind],
    position: { x: block.x, y: block.y },
    width: block.width,
    height: block.height,
    data: { block },
    ariaLabel: blockAriaLabel(block),
    deletable: false
  }))
  const titles = new Map(view.ideas.map((neuron) => [neuron.id, neuron.title] as const))
  const stepNodes = view.steps.map((step): StepNodeType => {
    const root = layout.positions.get(step.rootId) ?? { x: 0, y: 0 }
    return {
      id: stepNodeId(step.rootId),
      type: 'step',
      position: layout.positions.get(stepNodeId(step.rootId)) ??
        step.position ?? { x: root.x + STEP_OFFSET.x, y: root.y + STEP_OFFSET.y },
      data: { step, dimmed: isDimmed(step.rootId) },
      ariaLabel: `Prochaine étape de « ${titles.get(step.rootId) ?? 'l’idée'} », non modifiable : ${step.text}`,
      deletable: false
    }
  })
  const stepEdges = view.steps.map((step): BranchEdgeType => ({
    id: `step-line-${step.rootId}`,
    type: 'branch',
    source: step.rootId,
    target: stepNodeId(step.rootId),
    data: { style: 'step' },
    deletable: false,
    selectable: false,
    focusable: false
  }))
  const ioEdges = view.io.map((link): BranchEdgeType => ({
    id: `io-${link.id}`,
    type: 'branch',
    source: link.sourceKind === 'idea' ? link.sourceId : stepNodeId(link.sourceId),
    target: link.blockId,
    data: { style: 'io' },
    deletable: false,
    selectable: false,
    focusable: false
  }))
  return { nodes: [...neuronNodes, ...blockNodes, ...stepNodes], edges, stepEdges: [...stepEdges, ...ioEdges] }
}
