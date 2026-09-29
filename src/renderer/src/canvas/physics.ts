import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum
} from 'd3-force'

/**
 * Physique de la carte (retour de test de mentalyas, 2026-09-29 : « une physique dominante », comme le graphe
 * d'Obsidian) : tous les objets — idées, sous-neurones, questions, textes, blocs — se repoussent et ne se
 * chevauchent jamais (collision sur un rayon qui englobe leur titre). Un objet épinglé (glissé à la main) reste à
 * sa place, les autres s'écartent. Stabilisation d'un coup et déterministe à chaque changement ; en direct pendant
 * un glisser.
 */

export interface Point {
  readonly x: number
  readonly y: number
}

/** Un objet de la carte : son encombrement (titre compris) et sa position de départ. */
export interface Body {
  readonly id: string
  readonly radius: number
  readonly x: number
  readonly y: number
  /** Gardé à sa place : glissé à la main, idée ouverte, bloc. */
  readonly pinned: boolean
  /** Attiré doucement vers le centre de la carte (les idées), pour que la carte ne se disperse pas. */
  readonly gravity: boolean
}

/** Ressort entre deux objets (lien entre idées, branche d'un arbre, texte accroché à son idée). */
export interface Spring {
  readonly source: string
  readonly target: string
  readonly distance: number
  readonly strength: number
}

interface PhysicsNode extends SimulationNodeDatum {
  readonly id: string
  radius: number
  gravity: boolean
}

interface PhysicsLink extends SimulationLinkDatum<PhysicsNode> {
  readonly distance: number
  readonly strength: number
}

/** Espace libre minimal entre deux objets. */
export const GAP = 12
const CHARGE = -260
const GRAVITY = 0.02
/** Stabilisation : au plus ce nombre de pas, arrêt dès que le mouvement devient imperceptible. */
const MAX_TICKS = 400
const ALPHA_REST = 0.02

/** Générateur pseudo-aléatoire à graine : même entrée, mêmes positions (d3 départage les objets superposés). */
function lcg(seed: number): () => number {
  let state = seed
  return () => (state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296
}

export class CanvasPhysics {
  private readonly simulation: Simulation<PhysicsNode, PhysicsLink>
  private nodes = new Map<string, PhysicsNode>()
  private center: Point = { x: 0, y: 0 }
  /** Épinglés pendant la session (glissés à la main), avant que les données rechargées le disent. */
  private readonly held = new Set<string>()

  constructor() {
    this.simulation = forceSimulation<PhysicsNode, PhysicsLink>([])
      .randomSource(lcg(42))
      .force('charge', forceManyBody<PhysicsNode>().strength(CHARGE).distanceMax(520))
      .force(
        'collide',
        forceCollide<PhysicsNode>((node) => node.radius + GAP / 2)
          .strength(1)
          .iterations(4)
      )
      .force(
        'x',
        forceX<PhysicsNode>(() => this.center.x).strength((node) => (node.gravity ? GRAVITY : 0))
      )
      .force(
        'y',
        forceY<PhysicsNode>(() => this.center.y).strength((node) => (node.gravity ? GRAVITY : 0))
      )
      .stop()
  }

  /**
   * Met à jour les objets et ressorts. Un objet déjà présent garde sa position et sa vitesse (la carte ne saute
   * pas) ; un nouvel objet part de la position fournie.
   */
  update(bodies: readonly Body[], springs: readonly Spring[], center: Point): void {
    this.center = center
    const next = new Map<string, PhysicsNode>()
    for (const body of bodies) {
      const existing = this.nodes.get(body.id)
      const node: PhysicsNode = existing ?? {
        id: body.id,
        radius: body.radius,
        gravity: body.gravity,
        x: body.x,
        y: body.y
      }
      node.radius = body.radius
      node.gravity = body.gravity
      if (body.pinned || this.held.has(body.id)) {
        node.fx = existing?.fx ?? body.x
        node.fy = existing?.fy ?? body.y
      } else {
        node.fx = null
        node.fy = null
      }
      next.set(body.id, node)
    }
    this.nodes = next
    this.simulation.nodes([...next.values()])
    this.simulation.force(
      'link',
      forceLink<PhysicsNode, PhysicsLink>(
        springs.filter((spring) => next.has(spring.source) && next.has(spring.target)).map((spring) => ({ ...spring }))
      )
        .id((node) => node.id)
        .distance((link) => link.distance)
        .strength((link) => link.strength)
    )
  }

  /** Épingle un objet à une position (objet glissé) ou le libère (`null`). */
  pin(id: string, at: Point | null): void {
    if (at === null) this.held.delete(id)
    else this.held.add(id)
    const node = this.nodes.get(id)
    if (node === undefined) return
    node.fx = at === null ? null : at.x
    node.fy = at === null ? null : at.y
    if (at !== null) {
      node.x = at.x
      node.y = at.y
    }
  }

  /** Stabilise d'un coup (synchrone, déterministe) : `energy` 1 pour une nouvelle carte, moins pour un ajustement. */
  settle(energy: number): Map<string, Point> {
    this.simulation.alpha(energy)
    for (let tick = 0; tick < MAX_TICKS && this.simulation.alpha() > ALPHA_REST; tick++) this.simulation.tick()
    return this.positions()
  }

  /** Un pas de simulation en direct (pendant un glisser) ; `false` quand tout est au repos. */
  step(dragging: boolean): boolean {
    this.simulation.alphaTarget(dragging ? 0.3 : 0)
    if (!dragging && this.simulation.alpha() < ALPHA_REST) return false
    this.simulation.tick()
    return true
  }

  /** Relance le mouvement (début d'un glisser). */
  wake(): void {
    this.simulation.alpha(Math.max(this.simulation.alpha(), 0.3))
  }

  positions(): Map<string, Point> {
    return new Map(
      [...this.nodes.values()].map((node) => [node.id, { x: round(node.x ?? 0), y: round(node.y ?? 0) }] as const)
    )
  }
}

const round = (value: number): number => Math.round(value * 10) / 10
