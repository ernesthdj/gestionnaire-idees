import type { Edge, Node } from '@xyflow/react'
import type { CanvasNeuronView, IdeasCanvasView } from '@shared/ipc/canvas'
import type { LinkView, SeedView } from '@shared/ipc/neurons'
import { forceLayout, zonesFor, type LayoutNode, type Point, type Zones } from './forceLayout'

/** Diamètre du cercle principal selon l'état ; rayon occupé (satellites compris) pour la disposition. */
export const CIRCLE = { raw: 64, developing: 72, hatched: 80 } as const
const LAYOUT_RADIUS = { raw: 32, developing: 60, hatched: 44 } as const

type CanvasState = keyof typeof CIRCLE

export type NeuronNodeData = {
  readonly neuron: CanvasNeuronView
  /** Un filtre est actif et cette idée n'y correspond pas : estompée, toujours présente. */
  readonly dimmed: boolean
}
export type NeuronNodeType = Node<NeuronNodeData, 'neuron'>

export type ZoneNodeData = { readonly label: string; readonly width: number; readonly height: number }
export type ZoneNodeType = Node<ZoneNodeData, 'zone'>

export type LinkEdgeData = {
  readonly link: LinkView
  readonly dimmed: boolean
  /** Graine en attente sur ce lien accepté (FR-028). */
  readonly seed: SeedView | null
}
export type LinkEdgeType = Edge<LinkEdgeData, 'link'>

export type BlockNodeType = Node<Record<string, never>, 'block'>

export type CanvasNode = NeuronNodeType | ZoneNodeType | BlockNodeType

const STATE_LABELS: Record<CanvasState, string> = {
  raw: 'Idée brute',
  developing: 'En développement',
  hatched: 'Idée éclose'
}
const NATURE_LABELS = { action: 'Action', reflection: 'Réflexion' } as const

export function canvasState(neuron: CanvasNeuronView): CanvasState {
  return neuron.state === 'hatched' ? 'hatched' : neuron.state === 'developing' ? 'developing' : 'raw'
}

/** Parents d'une idée née d'une graine, par identifiant de l'idée née. */
export function bornFrom(view: IdeasCanvasView): Map<string, SeedView['parents']> {
  return new Map(
    view.seeds.flatMap((seed) => (seed.bornRootId === null ? [] : [[seed.bornRootId, seed.parents] as const]))
  )
}

/** Texte lu par les lecteurs d'écran pour une idée (état, titre, nature, catégorie, origine IA, parents). */
export function neuronAriaLabel(neuron: CanvasNeuronView, parents?: SeedView['parents']): string {
  const parts = [`${STATE_LABELS[canvasState(neuron)]} : ${neuron.title}`]
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
  const network = new Set(view.network.map((neuron) => neuron.id))
  return [...view.incubator, ...view.network].map((neuron) => ({
    id: neuron.id,
    zone: network.has(neuron.id) ? 'network' : 'incubator',
    radius: LAYOUT_RADIUS[canvasState(neuron)],
    initial: neuron.position
  }))
}

export interface CanvasLayout {
  readonly zones: Zones
  readonly positions: Map<string, Point>
}

export function computeLayout(view: IdeasCanvasView): CanvasLayout {
  const zones = zonesFor(view.incubator.length, view.network.length)
  const links = view.links.map((link) => ({ source: link.a.id, target: link.b.id }))
  // Fils invisibles : une idée née d'une graine est attirée entre ses deux parents.
  for (const [id, parents] of bornFrom(view)) {
    for (const parent of parents) links.push({ source: id, target: parent.id })
  }
  return { zones, positions: forceLayout(layoutInput(view), links, zones) }
}

/** Idées dont la position calculée diffère de celle enregistrée (à mémoriser pour la prochaine ouverture). */
export function movedPositions(
  view: IdeasCanvasView,
  positions: ReadonlyMap<string, Point>
): { rootId: string; x: number; y: number }[] {
  return [...view.incubator, ...view.network].flatMap((neuron) => {
    const point = positions.get(neuron.id)
    if (point === undefined) return []
    const saved = neuron.position
    const moved = saved === null || Math.hypot(saved.x - point.x, saved.y - point.y) > 1
    return moved ? [{ rootId: neuron.id, x: point.x, y: point.y }] : []
  })
}

/** Vue de l'écran Idées → nœuds (zones + idées) et arêtes (liens) React Flow. Positions = centres (nodeOrigin 0.5). */
export function buildGraph(
  view: IdeasCanvasView,
  layout: CanvasLayout,
  /** Idée en train de migrer vers le réseau : sa position change avec une transition. */
  migratingId: string | null = null,
  /** Idée qui vient de naître d'une graine : elle pousse (250 ms). */
  bornId: string | null = null
): { nodes: CanvasNode[]; edges: LinkEdgeType[] } {
  const highlighted = view.highlighted === null ? null : new Set(view.highlighted)
  const isDimmed = (id: string): boolean => highlighted !== null && !highlighted.has(id)
  const parentsOf = bornFrom(view)
  const pendingSeeds = new Map(
    view.seeds.filter((seed) => seed.status === 'suggested').map((seed) => [seed.linkId, seed] as const)
  )
  const zoneNode = (id: 'incubator' | 'network', label: string): ZoneNodeType => {
    const rect = layout.zones[id]
    return {
      id: `zone-${id}`,
      type: 'zone',
      position: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
      data: { label, width: rect.width, height: rect.height },
      draggable: false,
      selectable: false,
      focusable: false,
      deletable: false,
      zIndex: -1
    }
  }
  const neuronNodes = [...view.incubator, ...view.network].map((neuron): NeuronNodeType => ({
    id: neuron.id,
    type: 'neuron',
    position: layout.positions.get(neuron.id) ?? { x: 0, y: 0 },
    data: { neuron, dimmed: isDimmed(neuron.id) },
    ...(neuron.id === migratingId ? { className: 'neuron-migrating' } : {}),
    ...(neuron.id === bornId ? { className: 'neuron-born' } : {}),
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
    ariaLabel: `Lien « ${link.label} » entre ${link.a.title} et ${link.b.title}${link.status === 'suggested' ? ', suggéré par l’IA' : ''}`,
    deletable: false,
    selectable: false
  }))
  const blockNodes = view.blocks.map((block): BlockNodeType => ({
    id: block.id,
    type: 'block',
    position: { x: block.x, y: block.y },
    width: block.width,
    height: block.height,
    data: {},
    ariaLabel: 'Bloc vide (mini-widgets en v2)',
    deletable: false
  }))
  return {
    nodes: [zoneNode('incubator', 'Incubateur'), zoneNode('network', 'Réseau'), ...neuronNodes, ...blockNodes],
    edges
  }
}
