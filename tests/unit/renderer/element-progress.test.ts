import { describe, expect, it } from 'vitest'
import { progressOf } from '../../../src/renderer/src/canvas/progress'
import type { ElementView } from '../../../src/shared/ipc/canvas'

const element = (id: string, parentId: string, extra: Partial<ElementView> = {}): ElementView => ({
  id,
  genesisId: 'g',
  parentId,
  key: id,
  type: 'module',
  title: id,
  status: null,
  summary: null,
  paths: [],
  collapsed: false,
  childCount: 0,
  order: null,
  ...extra
})

describe('avancement mixte des éléments (spec 017 D21)', () => {
  it('should_show_the_declared_percent_of_a_leaf_and_100_when_it_is_delivered', () => {
    const progress = progressOf([
      element('a', 'g', { progress: 60 }),
      element('b', 'g', { status: 'livree', progress: 20 }),
      element('c', 'g')
    ])
    expect(progress.get('a')).toEqual({ percent: 60, fromChildren: false })
    expect(progress.get('b')).toEqual({ percent: 100, fromChildren: false })
    expect(progress.has('c')).toBe(false)
  })

  it('should_average_the_children_of_a_parent_counting_unknown_ones_as_zero', () => {
    const progress = progressOf([
      element('m', 'g', { progress: 10 }),
      element('m1', 'm', { status: 'livree' }),
      element('m2', 'm', { progress: 50 }),
      element('m3', 'm')
    ])
    expect(progress.get('m')).toEqual({ percent: 50, fromChildren: true })
  })

  it('should_roll_up_through_several_levels', () => {
    const progress = progressOf([
      element('root', 'g'),
      element('mid', 'root'),
      element('leaf1', 'mid', { status: 'faite' }),
      element('leaf2', 'mid', { progress: 0 }),
      element('other', 'root', { status: 'livree' })
    ])
    expect(progress.get('mid')?.percent).toBe(50)
    expect(progress.get('root')?.percent).toBe(75)
  })

  it('should_show_nothing_for_a_parent_whose_children_carry_no_information', () => {
    const progress = progressOf([element('p', 'g'), element('p1', 'p'), element('p2', 'p')])
    expect(progress.has('p')).toBe(false)
  })

  it('should_lower_a_delivered_parent_when_one_of_its_children_is_reopened', () => {
    const progress = progressOf([
      element('p', 'g', { status: 'livree' }),
      element('p1', 'p', { status: 'livree' }),
      element('p2', 'p', { status: 'en_cours', progress: 40 })
    ])
    expect(progress.get('p')).toEqual({ percent: 70, fromChildren: true })
  })

  it('should_keep_100_for_a_delivered_parent_whose_children_carry_no_information', () => {
    const progress = progressOf([element('p', 'g', { status: 'livree' }), element('p1', 'p')])
    expect(progress.get('p')).toEqual({ percent: 100, fromChildren: false })
  })
})
