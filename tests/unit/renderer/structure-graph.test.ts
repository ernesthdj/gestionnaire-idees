import { describe, expect, it } from 'vitest'
import { ELEMENT_SIZE, structureGraph } from '../../../src/renderer/src/canvas/structureGraph'
import type { ElementView, MapLinkView } from '../../../src/shared/ipc/canvas'
import { buildGraph, computeLayout } from '../../../src/renderer/src/canvas/buildGraph'
import { canvasView, RAW_ID } from '../../fixtures/ui/canvas'

const G = 'genesis'
const element = (id: string, parentId: string, extra: Partial<ElementView> = {}): ElementView => ({
  id,
  genesisId: G,
  parentId,
  key: id,
  type: 'module',
  title: id,
  status: null,
  summary: null,
  paths: [],
  collapsed: true,
  childCount: 0,
  ...extra
})
const link = (id: string, from: string, to: string): MapLinkView => ({
  id,
  from: { kind: 'element', id: from },
  to: { kind: 'element', id: to },
  label: 'IPC',
  origin: 'claude',
  relation: 'appelle'
})

const elements = [
  element('main', G),
  element('a', 'main', { type: 'composant' }),
  element('b', 'main', { type: 'composant' }),
  element('renderer', G),
  element('c', 'renderer', { type: 'composant' })
]
const centers = new Map([[G, { x: 0, y: 0 }]])

describe('carte de structure à l’écran', () => {
  it('should_show_only_level_one_when_everything_is_folded', () => {
    const graph = structureGraph(elements, centers, [])
    expect(graph.placed.map((entry) => entry.element.id).sort()).toEqual(['main', 'renderer'])
    expect(graph.placed.every((entry) => entry.x > 0)).toBe(true)
  })

  it('should_show_the_children_of_an_unfolded_element_in_the_next_column_centered_on_them', () => {
    const unfolded = elements.map((row) => (row.id === 'main' ? { ...row, collapsed: false } : row))
    const graph = structureGraph(unfolded, centers, [])
    const at = new Map(graph.placed.map((entry) => [entry.element.id, entry] as const))
    expect(at.get('a')?.x).toBeGreaterThan(at.get('main')?.x ?? 0)
    expect(at.get('main')?.y).toBeCloseTo(((at.get('a')?.y ?? 0) + (at.get('b')?.y ?? 0)) / 2)
    const rows = graph.placed.filter((entry) => entry.depth === 2)
    expect(Math.abs((rows[0]?.y ?? 0) - (rows[1]?.y ?? 0))).toBeGreaterThanOrEqual(ELEMENT_SIZE.height)
    expect(
      graph.edges.filter((edge) => edge.kind === 'hierarchy').map((edge) => [edge.source, edge.target])
    ).toContainEqual(['main', 'a'])
  })

  it('should_attach_links_of_folded_elements_to_their_visible_ancestor_and_group_them', () => {
    const graph = structureGraph(elements, centers, [link('l1', 'a', 'c'), link('l2', 'b', 'c'), link('l3', 'a', 'b')])
    const relations = graph.edges.filter((edge) => edge.kind === 'relation')
    // a→c et b→c deviennent main→renderer (×2) ; a→b devient main→main et disparaît.
    expect(relations).toEqual([
      expect.objectContaining({ source: 'main', target: 'renderer', relation: 'appelle', count: 2 })
    ])
  })

  it('should_draw_nothing_for_a_genesis_that_is_not_on_the_map', () => {
    expect(structureGraph(elements, new Map(), []).placed).toEqual([])
  })

  it('should_turn_the_elements_of_a_visible_genesis_into_element_nodes_of_the_map', () => {
    const view = {
      ...canvasView(),
      elements: [element('m1', RAW_ID, { genesisId: RAW_ID, title: 'Processus principal', childCount: 2 })]
    }
    const graph = buildGraph(view, computeLayout(view))
    expect(graph.nodes.find((node) => node.id === 'm1')).toMatchObject({
      type: 'element',
      draggable: false,
      ariaLabel: 'module « Processus principal », 2 éléments repliés'
    })
    expect(graph.mapEdges).toContainEqual(expect.objectContaining({ source: RAW_ID, target: 'm1', type: 'branch' }))
  })
})
