import { describe, expect, it } from 'vitest'
import {
  crossingCost,
  reduceCrossings,
  segmentHitsCircle,
  segmentsCross,
  type CrossingLink,
  type Point
} from '../../../src/renderer/src/canvas/crossings'
import { areaFor, forceLayout, type LayoutLink, type LayoutNode } from '../../../src/renderer/src/canvas/forceLayout'

const p = (x: number, y: number): Point => ({ x, y })

/** Réseau réaliste : 8 groupes de 5 idées proches (chaîne + 2 raccourcis) et 2 liens entre groupes = 50 liens. */
function clusteredLinks(): LayoutLink[] {
  const links: LayoutLink[] = []
  for (let group = 0; group < 8; group++) {
    const id = (k: number): string => `n${group * 5 + k}`
    for (let k = 0; k < 4; k++) links.push({ source: id(k), target: id(k + 1) })
    links.push({ source: id(0), target: id(2) }, { source: id(2), target: id(4) })
  }
  links.push({ source: 'n4', target: 'n5' }, { source: 'n19', target: 'n20' })
  return links
}

function networkNodes(count: number): LayoutNode[] {
  return Array.from({ length: count }, (_, i) => ({ id: `n${i}`, radius: 44, initial: null }))
}

const obstaclesOf = (nodes: readonly LayoutNode[]) => nodes.map((node) => ({ id: node.id, radius: node.radius }))

describe('croisements de liens', () => {
  it('should_detect_a_proper_crossing_but_not_a_shared_end_or_parallel_segments', () => {
    expect(segmentsCross(p(0, 0), p(10, 10), p(0, 10), p(10, 0))).toBe(true)
    expect(segmentsCross(p(0, 0), p(10, 10), p(10, 10), p(20, 0))).toBe(false)
    expect(segmentsCross(p(0, 0), p(10, 0), p(0, 5), p(10, 5))).toBe(false)
  })

  it('should_detect_a_link_passing_under_an_idea', () => {
    expect(segmentHitsCircle(p(0, 0), p(100, 0), p(50, 10), 20)).toBe(true)
    expect(segmentHitsCircle(p(0, 0), p(100, 0), p(50, 40), 20)).toBe(false)
  })

  it('should_leave_no_crossing_and_no_link_under_an_idea_when_the_network_is_realistic', () => {
    const nodes = networkNodes(40)
    const links = clusteredLinks()
    const positions = forceLayout(nodes, links, areaFor(40))
    expect(crossingCost(links, obstaclesOf(nodes), positions)).toBe(0)
  })

  it('should_leave_no_crossing_when_the_links_form_a_tree', () => {
    const nodes = networkNodes(30)
    const links = nodes.slice(1).map((node, i) => ({ source: `n${Math.floor(i / 3)}`, target: node.id }))
    const positions = forceLayout(nodes, links, areaFor(30))
    expect(crossingCost(links, obstaclesOf(nodes), positions)).toBe(0)
  })

  it('should_leave_no_crossing_when_the_links_form_a_binary_tree', () => {
    const nodes = networkNodes(40)
    const links = nodes.slice(1).map((node, i) => ({ source: `n${Math.floor(i / 2)}`, target: node.id }))
    expect(crossingCost(links, [], forceLayout(nodes, links, areaFor(40)))).toBe(0)
  })

  it('should_leave_no_crossing_even_when_50_links_are_drawn_at_random_between_40_ideas', () => {
    const nodes = networkNodes(40)
    const links = Array.from({ length: 50 }, (_, i) => ({ source: `n${i % 40}`, target: `n${(i * 7 + 3) % 40}` }))
    expect(crossingCost(links, [], forceLayout(nodes, links, areaFor(40)))).toBe(0)
  })

  it('should_at_least_halve_the_crossings_of_a_badly_tangled_arrangement', () => {
    const nodes = networkNodes(40)
    const links: CrossingLink[] = Array.from({ length: 50 }, (_, i) => ({
      source: `n${i % 40}`,
      target: `n${(i * 7 + 3) % 40}`
    }))
    // Grille où les voisins d'un lien sont placés loin les uns des autres.
    const scrambled = new Map(
      nodes.map((node, i) => [node.id, p(((i * 13) % 8) * 176, Math.floor(((i * 13) % 40) / 8) * 176)])
    )
    const before = crossingCost(links, obstaclesOf(nodes), scrambled)
    const after = reduceCrossings([nodes.map((node) => node.id)], links, obstaclesOf(nodes), scrambled)
    expect(crossingCost(links, obstaclesOf(nodes), after)).toBeLessThanOrEqual(before / 2)
  })

  it('should_only_swap_positions_so_that_no_new_overlap_can_appear', () => {
    const nodes = networkNodes(12)
    const links = nodes.slice(1).map((node) => ({ source: 'n0', target: node.id }))
    const start = new Map(nodes.map((node, i) => [node.id, p((i % 4) * 176, Math.floor(i / 4) * 176)]))
    const result = reduceCrossings([nodes.map((node) => node.id)], links, obstaclesOf(nodes), start)
    const key = (point: Point): string => `${point.x},${point.y}`
    expect(new Set([...result.values()].map(key))).toEqual(new Set([...start.values()].map(key)))
  })
})
