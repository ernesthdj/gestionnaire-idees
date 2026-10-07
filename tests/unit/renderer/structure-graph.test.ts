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
  order: null,
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

const hierarchyOf = (graph: ReturnType<typeof structureGraph>): string[][] =>
  graph.edges.filter((edge) => edge.kind === 'hierarchy').map((edge) => [edge.source, edge.target])

/** Aucun rectangle de nœud ne recouvre un autre. */
const overlaps = (graph: ReturnType<typeof structureGraph>): boolean =>
  graph.placed.some((a, i) =>
    graph.placed.some(
      (b, j) => i < j && Math.abs(a.x - b.x) < ELEMENT_SIZE.width && Math.abs(a.y - b.y) < ELEMENT_SIZE.height
    )
  )

describe('carte de structure à l’écran : disposition alternée et progression (spec 017 D17)', () => {
  it('should_put_the_modules_in_a_column_under_the_genesis_linked_as_a_path', () => {
    const graph = structureGraph(elements, centers, [])
    const place = at(graph)
    expect(place.get('main')).toMatchObject({ x: 0, number: '1' })
    expect(place.get('renderer')).toMatchObject({ x: 0, number: '2' })
    expect(place.get('main')?.y).toBe(SPACING.genesis + ELEMENT_SIZE.height / 2)
    expect((place.get('renderer')?.y ?? 0) - (place.get('main')?.y ?? 0)).toBe(
      ELEMENT_SIZE.height + SPACING.down + SPACING.module
    )
    expect(hierarchyOf(graph)).toEqual([
      [G, 'main'],
      ['main', 'renderer']
    ])
  })

  it('should_put_the_children_of_a_module_in_a_row_to_its_right_and_theirs_in_a_column_below', () => {
    const rows = unfold(
      [...elements, element('a1', 'a', { type: 'composant' }), element('a2', 'a', { type: 'composant' })],
      'main',
      'a'
    )
    const graph = structureGraph(rows, centers, [])
    const place = at(graph)
    // Niveau 2 : en ligne à droite du module, sur sa hauteur.
    expect(place.get('a')).toMatchObject({ y: place.get('main')?.y, number: '1.1' })
    expect((place.get('a')?.x ?? 0) - (place.get('main')?.x ?? 0)).toBe(ELEMENT_SIZE.width + SPACING.across)
    expect(place.get('b')?.y).toBe(place.get('main')?.y)
    // Niveau 3 : en colonne sous leur parent, alignés sur lui.
    expect(place.get('a1')).toMatchObject({ x: place.get('a')?.x, number: '1.1.1' })
    expect((place.get('a1')?.y ?? 0) - (place.get('a')?.y ?? 0)).toBe(ELEMENT_SIZE.height + SPACING.down)
    // La boîte de « a » (avec sa colonne) repousse « b » et le module suivant : rien ne se chevauche.
    expect(place.get('b')?.x).toBeGreaterThan(place.get('a')?.x ?? 0)
    expect(place.get('renderer')?.y).toBeGreaterThan(place.get('a2')?.y ?? 0)
    expect(overlaps(graph)).toBe(false)
    expect(hierarchyOf(graph)).toEqual(
      expect.arrayContaining([
        ['main', 'a'],
        ['a', 'b'],
        ['a', 'a1'],
        ['a1', 'a2']
      ])
    )
  })

  it('should_follow_the_order_of_claude_then_the_dependencies_then_the_drawing', () => {
    const rows = [element('ui', G), element('core', G), element('db', G, { order: 1 }), element('api', G)]
    const dependsOn = (id: string, from: string, to: string): MapLinkView => ({
      ...link(id, from, to),
      relation: 'depend_de'
    })
    const graph = structureGraph(rows, centers, [dependsOn('l1', 'ui', 'core'), dependsOn('l2', 'ui', 'api')])
    const numbers = Object.fromEntries(graph.placed.map((entry) => [entry.element.id, entry.number]))
    // « db » numéroté par Claude d'abord ; puis « core » et « api » avant « ui » qui en dépend.
    expect(numbers).toEqual({ db: '1', core: '2', api: '3', ui: '4' })
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
      ariaLabel: 'Étape 1 : module « Processus principal », 2 éléments repliés',
      data: expect.objectContaining({ number: '1' })
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

  it('should_say_what_an_element_contains_in_its_accessible_label_when_its_content_is_known', () => {
    const view = {
      ...canvasView(),
      elements: [
        element('d', RAW_ID, {
          genesisId: RAW_ID,
          title: 'Docs',
          status: 'bloquee',
          content: { kind: 'doc', code: 0, doc: 3 }
        }),
        element('c', RAW_ID, { genesisId: RAW_ID, title: 'Main', content: { kind: 'code', code: 9, doc: 2 } }),
        element('n', RAW_ID, { genesisId: RAW_ID, title: 'Vision', content: null })
      ]
    }
    const labels = new Map(buildGraph(view, computeLayout(view)).nodes.map((node) => [node.id, node.ariaLabel]))
    expect(labels.get('d')).toContain('« Docs », bloquée, contient de la documentation')
    expect(labels.get('c')).toContain('« Main », contient du code et 2 fichiers de documentation')
    expect(labels.get('n')).toMatch(/« Vision »$/)
  })
})
