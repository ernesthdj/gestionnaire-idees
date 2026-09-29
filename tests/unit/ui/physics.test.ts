import { describe, expect, it } from 'vitest'
import { CanvasPhysics, GAP, type Body, type Spring } from '../../../src/renderer/src/canvas/physics'

/** Un amas d'objets de toutes tailles posés presque au même endroit (le pire cas : tout se chevauche). */
function pile(count: number): Body[] {
  const radii = [24, 76, 80, 108]
  return Array.from({ length: count }, (_, i) => ({
    id: `b${i}`,
    radius: radii[i % radii.length] ?? 76,
    x: (i % 5) * 3,
    y: Math.floor(i / 5) * 3,
    pinned: false,
    gravity: true
  }))
}

function overlaps(bodies: readonly Body[], positions: ReadonlyMap<string, { x: number; y: number }>): string[] {
  const found: string[] = []
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i] as Body
      const b = bodies[j] as Body
      const pa = positions.get(a.id)
      const pb = positions.get(b.id)
      if (pa === undefined || pb === undefined) continue
      // Tolérance d'un pixel : la collision est résolue par itérations.
      if (Math.hypot(pa.x - pb.x, pa.y - pb.y) < a.radius + b.radius - 1) found.push(`${a.id}/${b.id}`)
    }
  }
  return found
}

describe('physique de la carte', () => {
  it('should_separate_every_object_so_that_nothing_overlaps', () => {
    const bodies = pile(30)
    const physics = new CanvasPhysics()
    physics.update(bodies, [], { x: 0, y: 0 })
    expect(overlaps(bodies, physics.settle(1))).toEqual([])
  })

  it('should_keep_a_pinned_object_in_place_and_push_the_others_around_it', () => {
    const bodies: Body[] = [
      { id: 'fixe', radius: 80, x: 0, y: 0, pinned: true, gravity: true },
      ...pile(8).map((body) => ({ ...body, x: body.x + 2, y: body.y + 2 }))
    ]
    const physics = new CanvasPhysics()
    physics.update(bodies, [], { x: 0, y: 0 })
    const positions = physics.settle(1)
    expect(positions.get('fixe')).toEqual({ x: 0, y: 0 })
    expect(overlaps(bodies, positions)).toEqual([])
  })

  it('should_keep_an_object_dragged_by_hand_pinned_after_an_update', () => {
    const bodies = pile(4)
    const physics = new CanvasPhysics()
    physics.update(bodies, [], { x: 0, y: 0 })
    physics.settle(1)
    physics.pin('b0', { x: 500, y: -300 })
    // Les données rechargées ne disent pas encore qu'il est épinglé : il reste quand même à sa place.
    physics.update(bodies, [], { x: 0, y: 0 })
    expect(physics.settle(0.5).get('b0')).toEqual({ x: 500, y: -300 })
    physics.pin('b0', null)
    physics.update(bodies, [], { x: 0, y: 0 })
    expect(physics.settle(1).get('b0')).not.toEqual({ x: 500, y: -300 })
  })

  it('should_keep_linked_objects_close_to_each_other', () => {
    const bodies: Body[] = [
      { id: 'idee', radius: 80, x: 0, y: 0, pinned: true, gravity: false },
      { id: 'enfant', radius: 76, x: 600, y: 0, pinned: false, gravity: false }
    ]
    const springs: Spring[] = [{ source: 'idee', target: 'enfant', distance: 160, strength: 0.6 }]
    const physics = new CanvasPhysics()
    physics.update(bodies, springs, { x: 0, y: 0 })
    const child = physics.settle(1).get('enfant') ?? { x: 0, y: 0 }
    const distance = Math.hypot(child.x, child.y)
    expect(distance).toBeGreaterThanOrEqual(80 + 76 + GAP / 2 - 1)
    expect(distance).toBeLessThan(400)
  })

  it('should_give_the_same_layout_for_the_same_input', () => {
    const run = (): Map<string, { x: number; y: number }> => {
      const physics = new CanvasPhysics()
      physics.update(pile(12), [], { x: 0, y: 0 })
      return physics.settle(1)
    }
    expect(run()).toEqual(run())
  })

  it('should_move_objects_live_while_dragging_then_come_to_rest', () => {
    const bodies = pile(6)
    const physics = new CanvasPhysics()
    physics.update(bodies, [], { x: 0, y: 0 })
    physics.settle(1)
    physics.wake()
    physics.pin('b0', { x: 200, y: 200 })
    expect(physics.step(true)).toBe(true)
    let steps = 0
    while (physics.step(false) && steps < 1000) steps++
    expect(steps).toBeLessThan(1000)
    expect(overlaps(bodies, physics.positions())).toEqual([])
  })
})
