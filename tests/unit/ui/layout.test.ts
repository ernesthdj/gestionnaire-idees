import { describe, expect, it } from 'vitest'
import {
  driftActive,
  forceLayout,
  MIN_FOOTPRINT,
  areaFor,
  type LayoutLink,
  type LayoutNode,
  type Point
} from '../../../src/renderer/src/canvas/forceLayout'

/** 100 idées de toutes tailles (5 paliers de 40 à 104 px, satellites compris) dans un seul espace. */
function demoNodes(count: number): LayoutNode[] {
  const radii = [20, 28, 36 + 24, 44, 52]
  return Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    radius: radii[i % radii.length] ?? 44,
    initial: null
  }))
}

const LINKS: LayoutLink[] = Array.from({ length: 50 }, (_, i) => ({
  source: `n${i % 100}`,
  target: `n${(i * 7 + 3) % 100}`
}))

describe('disposition de l’écran Idées', () => {
  const nodes = demoNodes(100)
  const area = areaFor(100)
  const positions = forceLayout(nodes, LINKS, area)

  it('should_keep_every_idea_inside_the_single_space', () => {
    for (const node of nodes) {
      const point = positions.get(node.id) as Point
      const rect = area
      expect(point.x - node.radius).toBeGreaterThanOrEqual(rect.x - 0.1)
      expect(point.x + node.radius).toBeLessThanOrEqual(rect.x + rect.width + 0.1)
      expect(point.y - node.radius).toBeGreaterThanOrEqual(rect.y - 0.1)
      expect(point.y + node.radius).toBeLessThanOrEqual(rect.y + rect.height + 0.1)
    }
    expect(area.width / area.height).toBeGreaterThan(1.2)
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
    expect(forceLayout(nodes, LINKS, area)).toEqual(positions)
  })

  it('should_barely_move_ideas_when_reopened_with_the_saved_positions', () => {
    const reopened = forceLayout(
      nodes.map((node) => ({ ...node, initial: positions.get(node.id) ?? null })),
      LINKS,
      area
    )
    for (const node of nodes) {
      const before = positions.get(node.id) as Point
      const after = reopened.get(node.id) as Point
      expect(Math.hypot(before.x - after.x, before.y - after.y), node.id).toBeLessThan(12)
    }
  })

  it('should_keep_an_idea_where_the_user_put_it', () => {
    const placed: LayoutNode = { id: 'x', radius: 20, initial: { x: 300, y: 200 } }
    expect(forceLayout([placed], [], areaFor(1)).get('x')).toEqual({ x: 300, y: 200 })
  })

  it('should_replace_an_idea_whose_saved_position_is_outside_the_space', () => {
    const lost: LayoutNode = { id: 'x', radius: 20, initial: { x: -5000, y: 0 } }
    const point = forceLayout([lost], [], areaFor(1)).get('x') as Point
    expect(point.x).toBeGreaterThanOrEqual(0)
  })

  it('should_keep_a_minimum_space_when_there_is_no_idea', () => {
    const empty = areaFor(0)
    expect(empty.width).toBeGreaterThan(0)
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
