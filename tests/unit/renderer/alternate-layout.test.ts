import { describe, expect, it } from 'vitest'
import { layoutUnder, type AlternateOptions, type Point } from '../../../src/renderer/src/canvas/layout/alternateLayout'

const CELL = { width: 100, height: 80 }

/** Arbre pseudo-aléatoire à graine fixe : `count` nœuds sous `root`, profondeur ≤ 5. */
function randomTree(seed: number, count: number): Map<string, string[]> {
  let state = seed
  const next = (): number => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
  const children = new Map<string, string[]>([['root', []]])
  const depthOf = new Map<string, number>([['root', 0]])
  for (let k = 0; k < count; k++) {
    const parents = [...children.keys()].filter((id) => (depthOf.get(id) ?? 0) < 5)
    const parent = parents[Math.floor(next() * parents.length)] as string
    const id = `n${k}`
    children.get(parent)?.push(id)
    children.set(id, [])
    depthOf.set(id, (depthOf.get(parent) ?? 0) + 1)
  }
  return children
}

function place(
  children: Map<string, string[]>,
  extra: Partial<AlternateOptions> = {}
): { centers: Map<string, Point>; depths: Map<string, number> } {
  const centers = new Map<string, Point>()
  const depths = new Map<string, number>()
  layoutUnder('root', { x: 0, y: 0 }, 120, 24, {
    childrenOf: (id) => children.get(id) ?? [],
    sizeOf: () => CELL,
    across: 32,
    down: 24,
    visit: (id, depth, center) => {
      centers.set(id, center)
      depths.set(id, depth)
    },
    ...extra
  })
  return { centers, depths }
}

const overlap = (a: Point, b: Point): boolean => Math.abs(a.x - b.x) < CELL.width && Math.abs(a.y - b.y) < CELL.height

describe('alternateLayout', () => {
  it('should_never_overlap_when_trees_are_random', () => {
    for (const seed of [1, 7, 42, 1234]) {
      for (const transposed of [false, true]) {
        const { centers } = place(randomTree(seed, 60), { transposed })
        const points = [...centers.values()]
        for (let i = 0; i < points.length; i++)
          for (let j = i + 1; j < points.length; j++)
            expect(overlap(points[i] as Point, points[j] as Point)).toBe(false)
      }
    }
  })

  it('should_stack_first_level_under_the_root_and_spread_the_next_in_a_row_when_not_transposed', () => {
    const tree = new Map([
      ['root', ['a', 'b']],
      ['a', ['a1', 'a2']],
      ['a1', ['a1x', 'a1y']]
    ])
    const { centers } = place(tree)
    const at = (id: string): Point => centers.get(id) as Point
    expect(at('a').x).toBe(0)
    expect(at('b').x).toBe(0)
    expect(at('b').y).toBeGreaterThan(at('a').y)
    expect(at('a1').y).toBe(at('a').y)
    expect(at('a2').x).toBeGreaterThan(at('a1').x)
    // Niveau 3 : repart en colonne sous son parent, et pousse « b » plus bas.
    expect(at('a1x').x).toBe(at('a1').x)
    expect(at('a1y').y).toBeGreaterThan(at('a1x').y)
    expect(at('b').y).toBeGreaterThan(at('a1y').y)
  })

  it('should_swap_rows_and_columns_when_transposed', () => {
    const tree = new Map([
      ['root', ['a', 'b']],
      ['a', ['a1', 'a2']]
    ])
    const { centers } = place(tree, { transposed: true })
    const at = (id: string): Point => centers.get(id) as Point
    expect(at('a').y).toBe(0)
    expect(at('b').x).toBeGreaterThan(at('a').x)
    expect(at('a1').x).toBe(at('a').x)
    expect(at('a2').y).toBeGreaterThan(at('a1').y)
  })

  it('should_bring_neighbours_closer_when_a_branch_is_folded', () => {
    const tree = new Map([
      ['root', ['a', 'b']],
      ['a', ['a1']],
      ['a1', ['a1x', 'a1y', 'a1z']]
    ])
    const open = place(tree).centers.get('b') as Point
    const folded = place(tree, {
      childrenOf: (id) => (id === 'a1' ? [] : (tree.get(id) ?? []))
    }).centers.get('b') as Point
    expect(folded.y).toBeLessThan(open.y)
  })

  it('should_report_depths_when_visiting', () => {
    const tree = new Map([
      ['root', ['a']],
      ['a', ['a1']]
    ])
    const { depths } = place(tree)
    expect(depths.get('a')).toBe(1)
    expect(depths.get('a1')).toBe(2)
    expect(depths.has('root')).toBe(false)
  })
})
