import { describe, expect, it } from 'vitest'
import { progression } from '../../../src/renderer/src/canvas/structureOrder'
import type { ElementView, MapLinkView } from '../../../src/shared/ipc/canvas'

const G = 'genesis'
const element = (id: string, parentId: string, order: number | null = null): ElementView => ({
  id,
  genesisId: G,
  parentId,
  key: id,
  type: 'module',
  title: id,
  status: null,
  summary: null,
  paths: [],
  collapsed: false,
  childCount: 0,
  order
})
const relation = (from: string, to: string, kind: NonNullable<MapLinkView['relation']>): MapLinkView => ({
  id: `${from}-${to}`,
  from: { kind: 'element', id: from },
  to: { kind: 'element', id: to },
  label: null,
  origin: 'claude',
  relation: kind
})
const ids = (rows: readonly ElementView[] | undefined): string[] => (rows ?? []).map((row) => row.id)

describe('ordre de progression d’une carte de structure (spec 017 D17)', () => {
  it('should_lift_measured_calls_between_descendants_onto_the_siblings_that_contain_them', () => {
    const rows = [element('ui', G), element('screen', 'ui'), element('core', G), element('service', 'core')]
    // Un écran de « ui » appelle un service de « core » : « core » se construit avant « ui ».
    const result = progression(rows, [], [{ from: 'screen', to: 'service', count: 3, provenance: 'syntax' }])
    expect(ids(result.children.get(G))).toEqual(['core', 'ui'])
    expect(result.numbers.get('service')).toBe('1.1')
    expect(result.numbers.get('screen')).toBe('2.1')
  })

  it('should_put_what_blocks_first_and_keep_the_drawing_order_when_dependencies_form_a_cycle', () => {
    const blocked = progression([element('b', G), element('a', G)], [relation('a', 'b', 'bloque')])
    expect(ids(blocked.children.get(G))).toEqual(['a', 'b'])
    const cycle = progression(
      [element('x', G), element('y', G)],
      [relation('x', 'y', 'depend_de'), relation('y', 'x', 'depend_de')]
    )
    expect(ids(cycle.children.get(G))).toEqual(['x', 'y'])
  })

  it('should_keep_the_order_of_claude_even_against_the_dependencies', () => {
    const rows = [element('api', G, 2), element('db', G, 1), element('ui', G)]
    const result = progression(rows, [relation('db', 'ui', 'depend_de')])
    expect(ids(result.children.get(G))).toEqual(['db', 'api', 'ui'])
    expect(result.numbers.get('ui')).toBe('3')
  })
})
