import { useMemo, useRef } from 'react'
import type { IdeasCanvasView } from '@shared/ipc/canvas'
import { MIN_FOOTPRINT } from './forceLayout'
import { STEP_OFFSET, stepNodeId, TIER_SIZE, tierOf, type CanvasLayout } from './buildGraph'
import { STEP_RADIUS } from './nodes/StepNode'
import { CanvasPhysics, type Body, type Point, type Spring } from './physics'
import { treeBodies } from './treeGraph'
import type { OpenTree } from './treeStore'

/** Ressort d'un lien entre idées : souple, il garde la disposition sans croisement du départ. */
const IDEA_LINK = { distance: 240, strength: 0.08 } as const
/** Ressort qui garde une prochaine étape près de son idée. */
const STEP_LINK = { distance: 230, strength: 0.2 } as const

/** Encombrement d'une idée : son cercle, et son titre de 160 px sous le cercle. */
function ideaRadius(neuron: IdeasCanvasView['ideas'][number]): number {
  return Math.max(TIER_SIZE[tierOf(neuron)] / 2 + 8, MIN_FOOTPRINT)
}

interface PhysicsInput {
  readonly view: IdeasCanvasView | undefined
  /** Disposition de départ (sans croisement) des idées sans place mémorisée. */
  readonly seed: CanvasLayout | null
  readonly tree: OpenTree | null
  readonly openRootId: string | null
}

/**
 * Relie la carte à sa physique (FR-034) : à chaque changement de contenu, tous les objets (idées, blocs, arbre de
 * l'idée ouverte, textes d'idées) sont mis à jour puis stabilisés d'un coup. Renvoie les positions et le moteur
 * (pour le glisser en direct).
 */
export function useCanvasPhysics(input: PhysicsInput): {
  readonly positions: ReadonlyMap<string, Point>
  readonly physics: CanvasPhysics
} {
  const physicsRef = useRef<CanvasPhysics | null>(null)
  physicsRef.current ??= new CanvasPhysics()
  const physics = physicsRef.current

  const { view, seed, tree, openRootId } = input
  const bodies: Body[] = []
  const springs: Spring[] = []
  if (view !== undefined && seed !== null) {
    for (const neuron of view.ideas) {
      const start = seed.positions.get(neuron.id) ?? neuron.position ?? { x: 0, y: 0 }
      bodies.push({
        id: neuron.id,
        radius: ideaRadius(neuron),
        x: start.x,
        y: start.y,
        // L'idée ouverte reste en place : son arbre se déploie autour, le volet ne saute pas.
        pinned: neuron.pinned || neuron.id === openRootId,
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
    // Prochaines étapes (FR-037) : près de leur idée ; glissées à la main, elles restent à leur place.
    for (const step of view.steps) {
      const root = seed.positions.get(step.rootId) ?? { x: 0, y: 0 }
      const start = step.position ?? { x: root.x + STEP_OFFSET.x, y: root.y + STEP_OFFSET.y }
      bodies.push({
        id: stepNodeId(step.rootId),
        radius: STEP_RADIUS,
        x: start.x,
        y: start.y,
        pinned: step.position !== null,
        gravity: false
      })
      springs.push({ source: step.rootId, target: stepNodeId(step.rootId), ...STEP_LINK })
    }
    for (const link of view.links) springs.push({ source: link.a.id, target: link.b.id, ...IDEA_LINK })
    if (tree !== null) {
      const root = physics.positions().get(tree.rootId) ?? seed.positions.get(tree.rootId) ?? { x: 0, y: 0 }
      const branch = treeBodies(tree, root)
      bodies.push(...branch.bodies)
      springs.push(...branch.springs)
    }
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
