/**
 * Réduction des croisements de liens (demande de mentalyas : des traits qui ne se croisent pas). Zéro croisement
 * n'est pas toujours possible (réseau non planaire) : on échange les positions d'idées de même taille tant que le
 * nombre de croisements — et de traits passant sous une idée — diminue. Un échange ne crée aucun chevauchement.
 */

export interface Point {
  readonly x: number
  readonly y: number
}

export interface CrossingLink {
  readonly source: string
  readonly target: string
}

export interface Obstacle {
  readonly id: string
  /** Rayon visible de l'idée : un trait qui le traverse passe « sous » elle. */
  readonly radius: number
}

const EPSILON = 1e-9

function orientation(a: Point, b: Point, c: Point): number {
  const value = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  return Math.abs(value) < EPSILON ? 0 : value > 0 ? 1 : -1
}

/** Les segments [p1 p2] et [p3 p4] se coupent strictement (toucher une extrémité commune ne compte pas). */
export function segmentsCross(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const o1 = orientation(p1, p2, p3)
  const o2 = orientation(p1, p2, p4)
  const o3 = orientation(p3, p4, p1)
  const o4 = orientation(p3, p4, p2)
  return o1 * o2 < 0 && o3 * o4 < 0
}

/** Le segment passe à moins de `radius` du centre. */
export function segmentHitsCircle(a: Point, b: Point, center: Point, radius: number): boolean {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = dx * dx + dy * dy
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((center.x - a.x) * dx + (center.y - a.y) * dy) / length))
  return Math.hypot(a.x + t * dx - center.x, a.y + t * dy - center.y) < radius
}

interface Graph {
  readonly links: readonly CrossingLink[]
  readonly obstacles: readonly Obstacle[]
  readonly positions: Map<string, Point>
  /** Liens touchant chaque idée. */
  readonly incident: Map<string, number[]>
}

function sharesEnd(a: CrossingLink, b: CrossingLink): boolean {
  return a.source === b.source || a.source === b.target || a.target === b.source || a.target === b.target
}

function crosses(graph: Graph, i: number, j: number): boolean {
  const a = graph.links[i] as CrossingLink
  const b = graph.links[j] as CrossingLink
  if (sharesEnd(a, b)) return false
  const pos = graph.positions
  return segmentsCross(
    pos.get(a.source) as Point,
    pos.get(a.target) as Point,
    pos.get(b.source) as Point,
    pos.get(b.target) as Point
  )
}

function hits(graph: Graph, linkIndex: number, obstacle: Obstacle): boolean {
  const link = graph.links[linkIndex] as CrossingLink
  if (obstacle.id === link.source || obstacle.id === link.target) return false
  const pos = graph.positions
  return segmentHitsCircle(
    pos.get(link.source) as Point,
    pos.get(link.target) as Point,
    pos.get(obstacle.id) as Point,
    obstacle.radius
  )
}

function buildGraph(
  links: readonly CrossingLink[],
  obstacles: readonly Obstacle[],
  positions: Map<string, Point>
): Graph {
  const usable = links.filter((link) => positions.has(link.source) && positions.has(link.target))
  const incident = new Map<string, number[]>()
  usable.forEach((link, index) => {
    for (const end of [link.source, link.target]) incident.set(end, [...(incident.get(end) ?? []), index])
  })
  return { links: usable, obstacles: obstacles.filter((o) => positions.has(o.id)), positions, incident }
}

/** Coût total : paires de liens qui se croisent + traits passant sous une idée. */
export function crossingCost(
  links: readonly CrossingLink[],
  obstacles: readonly Obstacle[],
  positions: Map<string, Point>
): number {
  const graph = buildGraph(links, obstacles, positions)
  let cost = 0
  for (let i = 0; i < graph.links.length; i++) {
    for (let j = i + 1; j < graph.links.length; j++) if (crosses(graph, i, j)) cost++
    for (const obstacle of graph.obstacles) if (hits(graph, i, obstacle)) cost++
  }
  return cost
}

/** Coût des éléments qui dépendent de la position de `u` ou de `v` (le reste ne change pas lors d'un échange). */
function localCost(graph: Graph, u: string, v: string): number {
  const affected = new Set([...(graph.incident.get(u) ?? []), ...(graph.incident.get(v) ?? [])])
  let cost = 0
  for (const i of affected) {
    for (let j = 0; j < graph.links.length; j++) {
      if (j === i || (affected.has(j) && j < i)) continue
      if (crosses(graph, i, j)) cost++
    }
    for (const obstacle of graph.obstacles) if (hits(graph, i, obstacle)) cost++
  }
  // Liens non touchés qui passent désormais sous `u` ou `v`.
  const moved = graph.obstacles.filter((obstacle) => obstacle.id === u || obstacle.id === v)
  for (let i = 0; i < graph.links.length; i++) {
    if (affected.has(i)) continue
    for (const obstacle of moved) if (hits(graph, i, obstacle)) cost++
  }
  return cost
}

export interface Relocation {
  /** Emplacements candidats pour une idée (dans sa zone). */
  readonly candidates: (id: string) => readonly Point[]
  /** L'idée peut-elle se poser là sans toucher une voisine ? */
  readonly fits: (id: string, point: Point, positions: ReadonlyMap<string, Point>) => boolean
}

/**
 * Améliorations gloutonnes et déterministes tant que le coût baisse : échanges entre idées interchangeables
 * (`groups` : même zone, même encombrement), puis déplacement d'une idée fautive vers un emplacement libre.
 * Renvoie les nouvelles positions (l'entrée n'est pas modifiée).
 */
export function reduceCrossings(
  groups: readonly (readonly string[])[],
  links: readonly CrossingLink[],
  obstacles: readonly Obstacle[],
  initial: ReadonlyMap<string, Point>,
  relocation?: Relocation,
  maxPasses = 40
): Map<string, Point> {
  const positions = new Map(initial)
  const graph = buildGraph(links, obstacles, positions)
  if (graph.links.length === 0) return positions
  const swap = (u: string, v: string): void => {
    const pu = positions.get(u) as Point
    positions.set(u, positions.get(v) as Point)
    positions.set(v, pu)
  }
  const trySwaps = (): boolean => {
    let improved = false
    for (const group of groups) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const u = group[i] as string
          const v = group[j] as string
          // Deux idées sans aucun lien : l'échange ne change rien.
          if (!graph.incident.has(u) && !graph.incident.has(v)) continue
          const before = localCost(graph, u, v)
          if (before === 0) continue
          swap(u, v)
          if (localCost(graph, u, v) < before) improved = true
          else swap(u, v)
        }
      }
    }
    return improved
  }
  const tryMoves = (): boolean => {
    if (relocation === undefined) return false
    let improved = false
    for (const group of groups) {
      for (const id of group) {
        const before = localCost(graph, id, id)
        if (before === 0) continue
        const origin = positions.get(id) as Point
        let best: { point: Point; cost: number } = { point: origin, cost: before }
        for (const point of relocation.candidates(id)) {
          if (!relocation.fits(id, point, positions)) continue
          positions.set(id, point)
          const cost = localCost(graph, id, id)
          if (cost < best.cost) best = { point, cost }
        }
        positions.set(id, best.point)
        if (best.cost < before) improved = true
      }
    }
    return improved
  }
  for (let pass = 0; pass < maxPasses; pass++) {
    const swapped = trySwaps()
    const moved = tryMoves()
    if (!swapped && !moved) break
  }
  return positions
}
