import { useMemo, useRef } from 'react'
import type { IdeasCanvasView } from '@shared/ipc/canvas'
import { MIN_FOOTPRINT } from './forceLayout'
import { ideaLinks, TIER_SIZE, tierOf, type CanvasLayout } from './buildGraph'
import { CanvasPhysics, type Body, type Point, type Spring } from './physics'
import { treeReach } from './treeReach'

/** Ressort d'un lien entre idées : souple, il garde la disposition sans croisement du départ. */
const IDEA_LINK = { distance: 240, strength: 0.08 } as const

/**
 * Encombrement d'une idée : son cercle et son titre, ou la portée de son arbre (plan, carte de structure) s'il en a un
 * (spec 022) — une idée nouvelle ou libérée ne pose pas son arbre sur celui d'une voisine.
 */
function ideaRadius(neuron: IdeasCanvasView['ideas'][number], reach: number): number {
  return Math.max(TIER_SIZE[tierOf(neuron)] / 2 + 8, MIN_FOOTPRINT, reach)
}

interface PhysicsInput {
  readonly view: IdeasCanvasView | undefined
  /** Disposition de départ (sans croisement) des idées sans place mémorisée. */
  readonly seed: CanvasLayout | null
}

/**
 * Relie la carte à sa physique (FR-034) : à chaque changement de contenu, tous les objets (idées, blocs) sont mis à
 * jour puis stabilisés d'un coup. Renvoie les positions et le moteur
 * (pour le glisser en direct).
 */
export function useCanvasPhysics(input: PhysicsInput): {
  readonly positions: ReadonlyMap<string, Point>
  readonly physics: CanvasPhysics
} {
  const physicsRef = useRef<CanvasPhysics | null>(null)
  physicsRef.current ??= new CanvasPhysics()
  const physics = physicsRef.current

  const { view, seed } = input
  const bodies: Body[] = []
  const springs: Spring[] = []
  if (view !== undefined && seed !== null) {
    for (const neuron of view.ideas) {
      // Une idée déjà posée (place mémorisée) ne bouge plus d'elle-même : seules les nouvelles se placent.
      const start = neuron.position ?? seed.positions.get(neuron.id) ?? { x: 0, y: 0 }
      bodies.push({
        id: neuron.id,
        radius: ideaRadius(neuron, treeReach(view, neuron.id)),
        x: start.x,
        y: start.y,
        pinned: neuron.pinned || neuron.position !== null,
        gravity: true
      })
    }
    for (const block of view.blocks) {
      bodies.push({
        id: block.id,
        radius: Math.hypot(block.width, block.height) / 2,
        x: block.x,
        y: block.y,
        pinned: true,
        gravity: false
      })
    }
    for (const link of ideaLinks(view)) springs.push({ source: link.from.id, target: link.to.id, ...IDEA_LINK })
  }
  // Seul un changement de contenu relance la stabilisation (pas un simple nouveau rendu).
  const signature = [
    bodies.map((body) => `${body.id}:${Math.round(body.radius)}:${body.pinned ? 1 : 0}`).join(','),
    springs.map((spring) => `${spring.source}>${spring.target}`).join(','),
    seed === null ? '' : `${seed.area.width}x${seed.area.height}`
  ].join('|')

  const latest = useRef({ bodies, springs, seed })
  latest.current = { bodies, springs, seed }
  const positions = useMemo(() => {
    const { bodies: current, springs: currentSprings, seed: currentSeed } = latest.current
    if (currentSeed === null) return new Map<string, Point>()
    const known = physics.positions()
    const fresh = current.filter((body) => !known.has(body.id)).length
    physics.update(current, currentSprings, {
      x: currentSeed.area.x + currentSeed.area.width / 2,
      y: currentSeed.area.y + currentSeed.area.height / 2
    })
    // Ouverture : la disposition de départ est déjà bonne (sans croisement), on ne fait que séparer ce qui se
    // chevauche ; ajout d'objets : ajustement ; sinon, simple vérification.
    return physics.settle(known.size === 0 ? 0.3 : fresh > 0 ? 0.5 : 0.1)
  }, [signature, physics])

  return { positions, physics }
}
