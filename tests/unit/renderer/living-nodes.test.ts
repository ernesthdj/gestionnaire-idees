import { describe, expect, it } from 'vitest'
import { hash, rhythm, rhythmStyle } from '../../../src/renderer/src/canvas/living/rhythm'
import {
  BRANCH_COUNT,
  nodeVisuals,
  subNodeSize,
  type TreeNodeInput
} from '../../../src/renderer/src/canvas/living/nodeVisual'
import { NODE_ICONS } from '../../../src/renderer/src/canvas/living/icons'

describe('rhythm', () => {
  it('should_give_the_same_rhythm_when_the_id_is_the_same', () => {
    expect(rhythm('n-42')).toEqual(rhythm('n-42'))
  })

  it('should_give_different_rhythms_when_ids_differ', () => {
    expect(rhythm('n-1')).not.toEqual(rhythm('n-2'))
  })

  it('should_stay_within_gentle_bounds_when_any_id_is_given', () => {
    for (const id of ['', 'a', 'éclose', '0123456789abcdef', 'x'.repeat(500)]) {
      const r = rhythm(id)
      expect(r.dur).toBeGreaterThanOrEqual(5)
      expect(r.dur).toBeLessThanOrEqual(9)
      expect(r.delay).toBeLessThanOrEqual(0)
      expect(r.delay).toBeGreaterThanOrEqual(-9)
      expect(r.ax).toBeGreaterThanOrEqual(2)
      expect(r.ax).toBeLessThanOrEqual(6)
      expect(r.ay).toBeGreaterThanOrEqual(3)
      expect(r.ay).toBeLessThanOrEqual(8)
      expect(Math.abs(r.rot)).toBeLessThanOrEqual(1.2)
    }
  })

  it('should_map_to_unit_interval_when_hashing', () => {
    for (const id of ['a', 'b', 'longer id']) {
      expect(hash(id)).toBeGreaterThanOrEqual(0)
      expect(hash(id)).toBeLessThanOrEqual(1)
    }
  })

  it('should_expose_css_variables_with_units_when_styling', () => {
    const style = rhythmStyle('n-1')
    expect(style['--float-dur']).toMatch(/s$/)
    expect(style['--float-ax']).toMatch(/px$/)
    expect(style['--float-rot']).toMatch(/deg$/)
  })
})

describe('nodeVisuals', () => {
  const tree: TreeNodeInput[] = [
    { id: 'g', parentId: null, icon: 'idea' },
    { id: 's1', parentId: 'g', icon: 'step', status: 'done' },
    { id: 's1a', parentId: 's1', icon: 'step', status: 'doing' },
    { id: 's1a1', parentId: 's1a', icon: 'document' },
    { id: 's1a1x', parentId: 's1a1', icon: 'final' },
    { id: 's2', parentId: 'g', icon: 'step', status: 'todo' }
  ]

  it('should_make_the_root_an_orb_without_branch_when_it_has_no_parent', () => {
    const root = nodeVisuals(tree).get('g')
    expect(root).toMatchObject({ depth: 0, branch: null, orb: true, size: 0 })
  })

  it('should_give_each_top_child_its_own_branch_when_siblings_follow_each_other', () => {
    const visuals = nodeVisuals(tree)
    expect(visuals.get('s1')?.branch).toBe(1)
    expect(visuals.get('s2')?.branch).toBe(2)
  })

  it('should_pass_the_branch_down_to_descendants_when_nested', () => {
    const visuals = nodeVisuals(tree)
    expect(visuals.get('s1a')?.branch).toBe(1)
    expect(visuals.get('s1a1x')?.branch).toBe(1)
  })

  it('should_shrink_with_depth_when_going_down', () => {
    const visuals = nodeVisuals(tree)
    const sizes = ['s1', 's1a', 's1a1', 's1a1x'].map((id) => visuals.get(id)?.size ?? 0)
    expect(sizes).toEqual([58, 44, 36, 30])
    expect(subNodeSize(9)).toBe(30)
  })

  it('should_keep_icon_and_status_when_given', () => {
    expect(nodeVisuals(tree).get('s1a')).toMatchObject({ icon: 'step', status: 'doing' })
    expect(nodeVisuals(tree).get('s1a1')?.status).toBeUndefined()
  })

  it('should_cycle_branches_when_there_are_more_top_children_than_colors', () => {
    const many: TreeNodeInput[] = [
      { id: 'r', parentId: null, icon: 'project' },
      ...Array.from({ length: BRANCH_COUNT + 2 }, (_, k) => ({ id: `c${k}`, parentId: 'r', icon: 'module' as const }))
    ]
    const visuals = nodeVisuals(many)
    expect(visuals.get(`c${BRANCH_COUNT}`)?.branch).toBe(1)
    expect(visuals.get(`c${BRANCH_COUNT + 1}`)?.branch).toBe(2)
  })

  it('should_treat_a_node_as_root_when_its_parent_is_missing', () => {
    const visuals = nodeVisuals([{ id: 'lost', parentId: 'nowhere', icon: 'step' }])
    expect(visuals.get('lost')).toMatchObject({ orb: true, depth: 0 })
  })

  it('should_not_loop_forever_when_the_tree_has_a_cycle', () => {
    const visuals = nodeVisuals([
      { id: 'a', parentId: 'b', icon: 'step' },
      { id: 'b', parentId: 'a', icon: 'step' }
    ])
    expect(visuals.get('a')?.orb).toBe(true)
  })

  it('should_have_an_icon_for_every_key_when_rendering', () => {
    for (const icon of Object.values(NODE_ICONS)) expect(icon).toBeTruthy()
  })
})
