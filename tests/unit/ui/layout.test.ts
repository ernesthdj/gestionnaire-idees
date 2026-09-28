import { describe, expect, it } from 'vitest'
import {
  driftActive,
  forceLayout,
  MIN_FOOTPRINT,
  zonesFor,
  type LayoutLink,
  type LayoutNode,
  type Point
} from '../../../src/renderer/src/canvas/forceLayout'

function demoNodes(incubator: number, network: number): LayoutNode[] {
  return [
    ...Array.from({ length: incubator }, (_, i) => ({
      id: `i${i}`,
      zone: 'incubator' as const,
      radius: i % 2 === 0 ? 32 : 56,
      initial: null
    })),
    ...Array.from({ length: network }, (_, i) => ({ id: `n${i}`, zone: 'network' as const, radius: 44, initial: null }))
  ]
}

const LINKS: LayoutLink[] = Array.from({ length: 50 }, (_, i) => ({
  source: `n${i % 40}`,
  target: `n${(i * 7 + 3) % 40}`
}))

describe('disposition de l’écran Idées', () => {
  const nodes = demoNodes(60, 40)
  const zones = zonesFor(60, 40)
  const positions = forceLayout(nodes, LINKS, zones)

  it('should_keep_incubator_ideas_left_and_hatched_ideas_right_inside_their_zone', () => {
    for (const node of nodes) {
      const point = positions.get(node.id) as Point
      const rect = zones[node.zone]
      expect(point.x - node.radius).toBeGreaterThanOrEqual(rect.x - 0.1)
      expect(point.x + node.radius).toBeLessThanOrEqual(rect.x + rect.width + 0.1)
      expect(point.y - node.radius).toBeGreaterThanOrEqual(rect.y - 0.1)
      expect(point.y + node.radius).toBeLessThanOrEqual(rect.y + rect.height + 0.1)
    }
    expect(zones.incubator.x + zones.incubator.width).toBeLessThan(zones.network.x)
  })

  it('should_never_let_two_ideas_or_their_titles_touch_with_100_ideas_and_50_links', () => {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i] as LayoutNode
        const b = nodes[j] as LayoutNode
        const pa = positions.get(a.id) as Point
        const pb = positions.get(b.id) as Point
        const minimum = Math.max(a.radius, MIN_FOOTPRINT) + Math.max(b.radius, MIN_FOOTPRINT)
        expect(Math.hypot(pa.x - pb.x, pa.y - pb.y), `${a.id} / ${b.id}`).toBeGreaterThanOrEqual(minimum)
      }
    }
  })

  it('should_give_the_same_result_when_run_twice_with_the_same_input', () => {
    expect(forceLayout(nodes, LINKS, zones)).toEqual(positions)
  })

  it('should_barely_move_ideas_when_reopened_with_the_saved_positions', () => {
    const reopened = forceLayout(
      nodes.map((node) => ({ ...node, initial: positions.get(node.id) ?? null })),
      LINKS,
      zones
    )
    for (const node of nodes) {
      const before = positions.get(node.id) as Point
      const after = reopened.get(node.id) as Point
      expect(Math.hypot(before.x - after.x, before.y - after.y), node.id).toBeLessThan(12)
    }
  })

  it('should_move_a_newly_hatched_idea_into_the_network_even_with_an_old_incubator_position', () => {
    const hatched: LayoutNode = { id: 'x', zone: 'network', radius: 44, initial: { x: 100, y: 100 } }
    const point = forceLayout([hatched], [], zonesFor(0, 1)).get('x') as Point
    expect(point.x).toBeGreaterThan(zonesFor(0, 1).network.x)
  })

  it('should_keep_a_minimum_zone_size_when_there_is_no_idea', () => {
    const empty = zonesFor(0, 0)
    expect(empty.incubator.width).toBeGreaterThan(0)
    expect(forceLayout([], [], empty).size).toBe(0)
  })

  it.each([
    [false, false, true],
    [false, true, false],
    [true, false, false]
  ])(
    'should_drift_only_when_not_reduced_and_not_interacting_(reduced=%s,interacting=%s)',
    (reduced, interacting, expected) => {
      expect(driftActive(reduced, interacting)).toBe(expected)
    }
  )
})
