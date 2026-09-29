import { crossingCost, reduceCrossings } from './crossings'
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationNodeDatum
} from 'd3-force'

/**
 * Disposition « organique » de l'écran Idées (research R2) : simulation physique douce (répulsion, attraction des
 * liens), toutes les idées dans un seul espace (FR-029). Fonction pure et déterministe : mêmes entrées, mêmes
 * positions.
 */

export interface Point {
  readonly x: number
  readonly y: number
}

export interface Rect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface LayoutNode {
  readonly id: string
  /** Rayon occupé (cercle + satellites éventuels). */
  readonly radius: number
  /** Position mémorisée ; ignorée si elle sort de l'espace de la carte. */
  readonly initial: Point | null
}

export interface LayoutLink {
  readonly source: string
  readonly target: string
}

/** Espace libre entre deux idées. */
export const NODE_GAP = 16
/** Encombrement minimal d'une idée : son titre (160 px de large sous le cercle) ne doit pas toucher le voisin. */
export const MIN_FOOTPRINT = 80
const CELL = 176
const TICKS = 300
/** Réglages choisis sur banc d'essai (arbres, groupes d'idées, réseau emmêlé) : le moins de croisements. */
const CHARGE = -40
const LINK_DISTANCE = 120
const LINK_STRENGTH = 0.7
/** Départs supplémentaires essayés si le premier laisse des croisements (seulement pour de nouvelles idées). */
const EXTRA_STARTS = 2

/** Proportion largeur/hauteur de l'espace : nombre d'or, comme un écran large. */
const PHI = 1.618

/** Espace dimensionné selon le nombre d'idées (≈ 1,6 cellule par idée), au format du nombre d'or. */
export function areaFor(count: number): Rect {
  const cells = 1.6 * Math.max(count, 1)
  const height = Math.max(640, CELL * Math.ceil(Math.sqrt(cells / PHI)))
  const width = Math.max(1040, CELL * Math.ceil(cells / (height / CELL)))
  return { x: 0, y: 0, width, height }
}

function inside(point: Point, rect: Rect, margin: number): boolean {
  return (
    point.x >= rect.x + margin &&
    point.x <= rect.x + rect.width - margin &&
    point.y >= rect.y + margin &&
    point.y <= rect.y + rect.height - margin
  )
}

function clampInto(node: SimNode, rect: Rect): void {
  const margin = node.radius
  node.x = Math.min(Math.max(node.x ?? 0, rect.x + margin), rect.x + rect.width - margin)
  node.y = Math.min(Math.max(node.y ?? 0, rect.y + margin), rect.y + rect.height - margin)
}

/** Générateur pseudo-aléatoire à graine : d3 s'en sert pour départager deux idées superposées. */
function lcg(seed: number): () => number {
  let state = seed
  return () => (state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296
}

interface SimNode extends SimulationNodeDatum {
  readonly id: string
  readonly radius: number
}

export function forceLayout(
  nodes: readonly LayoutNode[],
  links: readonly LayoutLink[],
  area: Rect
): Map<string, Point> {
  // Toute idée peut se trouver sous un trait : toutes sont des obstacles.
  const obstacles = nodes.map((node) => ({ id: node.id, radius: node.radius }))
  let best = layoutOnce(nodes, links, area, obstacles, 0)
  if (best.fresh === 0) return best.positions
  let bestCost = crossingCost(links, obstacles, best.positions)
  for (let start = 1; start <= EXTRA_STARTS && bestCost > 0; start++) {
    const candidate = layoutOnce(nodes, links, area, obstacles, start)
    const cost = crossingCost(links, obstacles, candidate.positions)
    if (cost < bestCost) {
      best = candidate
      bestCost = cost
    }
  }
  return best.positions
}

function layoutOnce(
  nodes: readonly LayoutNode[],
  links: readonly LayoutLink[],
  area: Rect,
  obstacles: readonly { readonly id: string; readonly radius: number }[],
  start: number
): { positions: Map<string, Point>; fresh: number } {
  // Départ : position mémorisée si elle est encore valable, sinon spirale au centre de l'espace (nombre d'or).
  let fresh = 0
  const simNodes: SimNode[] = nodes.map((node) => {
    if (node.initial !== null && inside(node.initial, area, node.radius)) {
      return { id: node.id, radius: node.radius, x: node.initial.x, y: node.initial.y }
    }
    const angle = fresh * 2.399963 + start * 2.1
    const distance = 24 * Math.sqrt(++fresh)
    return {
      id: node.id,
      radius: node.radius,
      x: area.x + area.width / 2 + distance * Math.cos(angle),
      y: area.y + area.height / 2 + distance * Math.sin(angle)
    }
  })

  const known = new Set(nodes.map((node) => node.id))
  const simLinks = links
    .filter((link) => known.has(link.source) && known.has(link.target))
    .map((link) => ({ source: link.source, target: link.target }))

  const simulation = forceSimulation(simNodes)
    .randomSource(lcg(42 + start))
    .force('collide', forceCollide<SimNode>((node) => footprint(node) + NODE_GAP / 2).iterations(3))
    .force('charge', forceManyBody<SimNode>().strength(CHARGE).distanceMax(600))
    .force('x', forceX<SimNode>(area.x + area.width / 2).strength(0.06))
    .force('y', forceY<SimNode>(area.y + area.height / 2).strength(0.06))
    .force(
      'link',
      forceLink<SimNode, { source: string; target: string }>(simLinks)
        .id((node) => node.id)
        .distance(LINK_DISTANCE)
        .strength(LINK_STRENGTH)
    )
    .stop()

  // Toutes les positions déjà connues : pas de simulation, la carte reste telle que l'utilisateur l'a laissée
  // (seuls les chevauchements et croisements éventuels sont corrigés, de façon déterministe).
  const ticks = fresh === 0 ? 0 : TICKS
  for (let tick = 0; tick < ticks; tick++) {
    simulation.tick()
    for (const node of simNodes) clampInto(node, area)
  }
  resolveOverlaps(simNodes, area)

  // Moins de traits qui se croisent : échanges entre idées de même encombrement.
  const groups = new Map<string, string[]>()
  for (const node of simNodes) {
    if (!obstacles.some((obstacle) => obstacle.id === node.id)) continue
    const key = String(footprint(node))
    groups.set(key, [...(groups.get(key) ?? []), node.id])
  }
  const byId = new Map(simNodes.map((node) => [node.id, node]))
  const untangled = reduceCrossings(
    [...groups.values()],
    links.filter((link) => known.has(link.source) && known.has(link.target)),
    obstacles,
    new Map(simNodes.map((node) => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }])),
    {
      candidates: (id) => slotsIn(area, (byId.get(id) as SimNode).radius),
      fits: (id, point, positions) => {
        const node = byId.get(id) as SimNode
        for (const [otherId, other] of positions) {
          if (otherId === id) continue
          const minimum = footprint(node) + footprint(byId.get(otherId) as SimNode) + NODE_GAP / 2
          if (Math.hypot(other.x - point.x, other.y - point.y) < minimum) return false
        }
        return true
      }
    }
  )

  return {
    positions: new Map([...untangled].map(([id, point]) => [id, { x: round(point.x), y: round(point.y) }])),
    fresh
  }
}

/** Dernière passe déterministe : écarte les paires encore trop proches (la simulation laisse de légers recouvrements). */
function resolveOverlaps(nodes: SimNode[], area: Rect): void {
  for (let pass = 0; pass < 20; pass++) {
    let moved = false
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i] as SimNode
        const b = nodes[j] as SimNode
        const dx = (b.x ?? 0) - (a.x ?? 0)
        const dy = (b.y ?? 0) - (a.y ?? 0)
        const distance = Math.hypot(dx, dy)
        const minimum = footprint(a) + footprint(b) + NODE_GAP / 2
        if (distance >= minimum) continue
        const push = (minimum - distance) / 2 + 0.5
        const ux = distance === 0 ? 1 : dx / distance
        const uy = distance === 0 ? 0 : dy / distance
        a.x = (a.x ?? 0) - ux * push
        a.y = (a.y ?? 0) - uy * push
        b.x = (b.x ?? 0) + ux * push
        b.y = (b.y ?? 0) + uy * push
        clampInto(a, area)
        clampInto(b, area)
        moved = true
      }
    }
    if (!moved) return
  }
}

/** Emplacements candidats : quadrillage d'une demi-cellule, à l'intérieur des bords. */
const slotCache = new Map<string, Point[]>()
function slotsIn(rect: Rect, margin: number): Point[] {
  const key = `${rect.x},${rect.y},${rect.width},${rect.height},${margin}`
  const cached = slotCache.get(key)
  if (cached !== undefined) return cached
  const step = CELL / 2
  const slots: Point[] = []
  for (let y = rect.y + margin; y <= rect.y + rect.height - margin; y += step) {
    for (let x = rect.x + margin; x <= rect.x + rect.width - margin; x += step) slots.push({ x, y })
  }
  slotCache.set(key, slots)
  return slots
}

function footprint(node: { readonly radius: number }): number {
  return Math.max(node.radius, MIN_FOOTPRINT)
}

const round = (value: number): number => Math.round(value * 10) / 10

/** La dérive des idées brutes s'arrête pendant une interaction et n'existe pas en mode animations réduites. */
export function driftActive(reduced: boolean, interacting: boolean): boolean {
  return !reduced && !interacting
}
