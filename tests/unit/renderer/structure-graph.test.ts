import { describe, expect, it } from 'vitest'
import { ELEMENT_SIZE, focusEdges, SPACING, structureGraph } from '../../../src/renderer/src/canvas/structureGraph'
import { borderPoint } from '../../../src/renderer/src/canvas/edges/useCenter'
import type { ElementView, MapLinkView, MeasuredLinkView } from '../../../src/shared/ipc/canvas'
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
const unfold = (rows: readonly ElementView[], ...ids: string[]): ElementView[] =>
  rows.map((row) => (ids.includes(row.id) ? { ...row, collapsed: false } : row))

const at = (graph: ReturnType<typeof structureGraph>) =>
  new Map(graph.placed.map((entry) => [entry.element.id, entry] as const))

describe('carte de structure à l’écran : arbre aéré (spec 017 D14)', () => {
  it('should_show_only_level_one_when_everything_is_folded_linked_to_the_genesis', () => {
    const graph = structureGraph(elements, centers, [])
    expect(graph.placed.map((entry) => entry.element.id).sort()).toEqual(['main', 'renderer'])
    expect(graph.placed.every((entry) => entry.x > 0)).toBe(true)
    expect(graph.edges.filter((edge) => edge.kind === 'hierarchy').map((edge) => [edge.source, edge.target])).toEqual([
      [G, 'main'],
      [G, 'renderer']
    ])
  })

  it('should_put_the_children_in_the_next_column_centered_with_air_between_nodes', () => {
    const graph = structureGraph(unfold(elements, 'main'), centers, [])
    const place = at(graph)
    expect((place.get('a')?.x ?? 0) - (place.get('main')?.x ?? 0)).toBe(SPACING.column)
    expect(place.get('main')?.y).toBeCloseTo(((place.get('a')?.y ?? 0) + (place.get('b')?.y ?? 0)) / 2)
    expect((place.get('b')?.y ?? 0) - (place.get('a')?.y ?? 0)).toBe(ELEMENT_SIZE.height + SPACING.row)
    expect(
      graph.edges.filter((edge) => edge.kind === 'hierarchy').map((edge) => [edge.source, edge.target])
    ).toContainEqual(['main', 'a'])
  })

  it('should_separate_two_level_one_modules_more_than_two_siblings', () => {
    const place = at(structureGraph(unfold(elements, 'main', 'renderer'), centers, []))
    // Dernier enfant de « main » (b) puis premier de « renderer » (c) : écart de module en plus.
    expect((place.get('c')?.y ?? 0) - (place.get('b')?.y ?? 0)).toBe(ELEMENT_SIZE.height + SPACING.row + SPACING.module)
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

describe('carte de structure à l’écran : liens selon le focus (spec 017 D15)', () => {
  const links = [link('l1', 'a', 'c'), link('l2', 'b', 'c'), link('l3', 'a', 'b')]
  const measured: MeasuredLinkView[] = [
    { from: 'a', to: 'c', count: 3, provenance: 'syntax' },
    { from: 'b', to: 'c', count: 2, provenance: 'uncertain' },
    { from: 'a', to: 'b', count: 7, provenance: 'syntax' }
  ]

  it('should_aggregate_links_between_level_one_elements_at_rest_even_when_unfolded', () => {
    const graph = structureGraph(unfold(elements, 'main', 'renderer'), centers, links, measured)
    expect(graph.edges.filter((edge) => edge.kind !== 'hierarchy')).toEqual([
      expect.objectContaining({ source: 'main', target: 'renderer', relation: 'appelle', count: 2, focused: false }),
      expect.objectContaining({
        source: 'main',
        target: 'renderer',
        kind: 'measured',
        count: 5,
        provenance: 'uncertain'
      })
    ])
  })

  it('should_detail_the_links_of_the_focused_element_attached_to_the_visible_other_end', () => {
    const open = unfold(elements, 'main')
    const edges = focusEdges(open, links, measured, 'a')
    expect(edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'a', target: 'renderer', kind: 'relation', focused: true }),
        expect.objectContaining({ source: 'a', target: 'b', kind: 'relation', focused: true }),
        expect.objectContaining({ source: 'a', target: 'b', kind: 'measured', count: 7, focused: true })
      ])
    )
    expect(edges.some((edge) => edge.source === 'b' && edge.target === 'renderer')).toBe(false)
    expect(focusEdges(open, links, measured, null)).toEqual([])
    expect(focusEdges(open, links, measured, 'inconnu')).toEqual([])
  })

  it('should_include_the_links_of_the_descendants_of_a_focused_unfolded_element', () => {
    const edges = focusEdges(unfold(elements, 'main'), links, [], 'main')
    expect(edges.map((edge) => [edge.source, edge.target])).toEqual(
      expect.arrayContaining([
        ['a', 'renderer'],
        ['b', 'renderer'],
        ['a', 'b']
      ])
    )
  })

  it('should_render_measured_calls_as_labelled_map_links', () => {
    const view = {
      ...canvasView(),
      elements: [element('m1', RAW_ID, { genesisId: RAW_ID }), element('m2', RAW_ID, { genesisId: RAW_ID })],
      measuredLinks: [{ from: 'm1', to: 'm2', count: 1, provenance: 'syntax' } as const]
    }
    expect(buildGraph(view, computeLayout(view)).mapEdges).toContainEqual(
      expect.objectContaining({
        source: 'm1',
        target: 'm2',
        type: 'mapLink',
        data: { label: '1 appel mesuré · sûr', measured: 'syntax', layer: 'rest' }
      })
    )
  })

  it('should_stop_a_link_at_the_border_of_a_rectangle', () => {
    expect(borderPoint({ x: 0, y: 0 }, 200, 100, { x: 400, y: 0 })).toEqual({ x: 100, y: 0 })
    expect(borderPoint({ x: 0, y: 0 }, 200, 100, { x: 0, y: -300 })).toEqual({ x: 0, y: -50 })
    expect(borderPoint({ x: 0, y: 0 }, 200, 100, { x: 10, y: 10 })).toEqual({ x: 0, y: 0 })
  })
})
