import { describe, expect, it } from 'vitest'
import { ITEM_SPACING, MIN_RADIUS, radialLayout, type Point } from '../../../src/renderer/src/dive/radialLayout'
import { diveModel } from '../../../src/renderer/src/dive/diveModel'
import type { TreeView } from '../../../src/shared/ipc/neurons'

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y)

describe('disposition radiale de la plongée', () => {
  it.each([1, 3, 8, 20])('should_keep_%i_items_apart_from_each_other_the_center_and_the_parent', (count) => {
    const layout = radialLayout(count, true)
    const points = [...layout.items, layout.parent as Point]
    for (let i = 0; i < points.length; i++) {
      expect(distance(points[i] as Point, { x: 0, y: 0 })).toBeGreaterThanOrEqual(MIN_RADIUS - 0.1)
      for (let j = i + 1; j < points.length; j++) {
        expect(distance(points[i] as Point, points[j] as Point)).toBeGreaterThanOrEqual(ITEM_SPACING - 0.1)
      }
    }
  })

  it('should_place_the_parent_on_the_left_and_the_items_on_the_right_side_arc', () => {
    const layout = radialLayout(5, true)
    expect(layout.parent).toEqual({ x: -layout.radius, y: 0 })
    for (const item of layout.items) expect(distance(item, { x: 0, y: 0 })).toBeCloseTo(layout.radius, 0)
    expect(layout.items[2]).toEqual({ x: layout.radius, y: 0 })
  })

  it('should_put_a_single_item_straight_to_the_right_and_no_parent_at_the_root', () => {
    expect(radialLayout(1, false)).toEqual({ radius: MIN_RADIUS, items: [{ x: MIN_RADIUS, y: 0 }], parent: null })
    expect(radialLayout(0, false).items).toEqual([])
  })
})

describe('vue de plongée', () => {
  const root = {
    id: 'r',
    title: 'Deuxième écran',
    content: null,
    nature: 'action',
    natureSource: 'user',
    category: null,
    categorySource: null,
    state: 'developing',
    version: 3,
    position: null,
    createdAt: '',
    updatedAt: ''
  } as const
  const neuron = (id: string, parentId: string, depth: number) => ({
    id,
    parentId,
    depth,
    kind: 'answer' as const,
    title: `titre ${id}`,
    content: null,
    amountCents: null,
    dueDate: null,
    origin: 'user' as const
  })
  const tree: TreeView = {
    root,
    neurons: [neuron('a', 'r', 1), neuron('b', 'r', 1), neuron('a1', 'a', 2), neuron('a11', 'a1', 3)],
    extensions: [
      {
        id: 'e1',
        neuronId: 'r',
        question: 'Budget ?',
        quickReplies: [],
        dimension: 'budget',
        origin: 'ai',
        outsideNature: false
      },
      {
        id: 'e2',
        neuronId: 'a',
        question: 'Quand ?',
        quickReplies: [],
        dimension: 'quand',
        origin: 'ai',
        outsideNature: false
      }
    ],
    suggestions: [{ id: 's1', neuronId: 'a', title: 'Piste', content: '...', research: 'none', sources: [] }],
    gauge: { level: 'insufficient', covered: [], missing: ['budget'], answered: 2 }
  }

  it('should_center_the_root_with_its_children_when_no_focus_is_given', () => {
    const model = diveModel(tree, null)
    expect(model.focus).toMatchObject({ id: 'r', kind: 'root', depth: 0, descendants: 4 })
    expect(model.parent).toBeNull()
    expect(model.children.map((child) => child.id)).toEqual(['a', 'b'])
    expect(model.extensions.map((extension) => extension.id)).toEqual(['e1'])
    expect(model.breadcrumb).toEqual([{ id: 'r', title: 'Deuxième écran' }])
  })

  it('should_give_breadcrumb_parent_children_and_own_questions_when_focused_deeper', () => {
    const model = diveModel(tree, 'a1')
    expect(model.breadcrumb.map((step) => step.id)).toEqual(['r', 'a', 'a1'])
    expect(model.parent?.id).toBe('a')
    expect(model.children.map((child) => child.id)).toEqual(['a11'])
    expect(model.extensions).toEqual([])
    expect(diveModel(tree, 'a').suggestions.map((suggestion) => suggestion.id)).toEqual(['s1'])
    expect(diveModel(tree, 'a').children[0]?.descendants).toBe(1)
  })

  it('should_come_back_to_the_root_when_the_focused_neuron_no_longer_exists', () => {
    expect(diveModel(tree, 'supprimé').focus.id).toBe('r')
  })
})
