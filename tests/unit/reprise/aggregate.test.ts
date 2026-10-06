import { describe, expect, it } from 'vitest'
import {
  aggregateView,
  breadcrumbOf,
  buildIndex,
  FILE_SYMBOL,
  levelOf,
  ROOT_KEY,
  type IndexEdge,
  type IndexSymbol
} from '../../../src/main/domain/reprise/aggregate'
import { columnLayout, COLUMN_WIDTH } from '../../../src/main/domain/reprise/layout'
import type { ExplorerFiltersView } from '../../../src/shared/ipc/reprise'

const DEFAULT: ExplorerFiltersView = {
  categories: ['domain', 'orchestration', 'infrastructure'],
  langs: [],
  hideUncertain: false
}
const ALL: ExplorerFiltersView = { ...DEFAULT, categories: [...DEFAULT.categories, 'plumbing'] }

const modules = [
  { key: 'dir:src/api', name: 'api', rootPath: 'src/api' },
  { key: 'dir:src/core', name: 'core', rootPath: 'src/core' },
  { key: 'dir:src/utils', name: 'utils', rootPath: 'src/utils' }
]
const files = [
  { path: 'src/api/orderController.ts', lang: 'ts' as const, moduleKey: 'dir:src/api' },
  { path: 'src/core/orders/orderService.ts', lang: 'ts' as const, moduleKey: 'dir:src/core' },
  { path: 'src/core/discount.ts', lang: 'ts' as const, moduleKey: 'dir:src/core' },
  { path: 'src/utils/logger.ts', lang: 'ts' as const, moduleKey: 'dir:src/utils' }
]
const symbol = (id: string, path: string, name: string, extra: Partial<IndexSymbol> = {}): IndexSymbol => ({
  id,
  path,
  parentId: null,
  kind: 'function',
  name,
  category: 'domain',
  ...extra
})
const symbols = [
  symbol('ctrl', 'src/api/orderController.ts', 'OrderController', { kind: 'class', category: 'orchestration' }),
  symbol('post', 'src/api/orderController.ts', 'post', { kind: 'method', parentId: 'ctrl', category: 'orchestration' }),
  symbol('svc', 'src/core/orders/orderService.ts', 'OrderService', { kind: 'class' }),
  symbol('place', 'src/core/orders/orderService.ts', 'place', { kind: 'method', parentId: 'svc' }),
  symbol('disc', 'src/core/discount.ts', 'calculateDiscount'),
  symbol('log', 'src/utils/logger.ts', 'log', { category: 'plumbing' }),
  symbol('apiFile', 'src/api/orderController.ts', FILE_SYMBOL, { kind: 'namespace', category: 'orchestration' })
]
const edge = (
  from: string,
  to: string | null,
  provenance: IndexEdge['provenance'] = 'syntax',
  count = 1
): IndexEdge => ({
  fromSymbolId: from,
  toSymbolId: to,
  provenance,
  count
})
const edges = [
  edge('post', 'place'),
  edge('post', 'place'),
  edge('place', 'disc', 'uncertain'),
  edge('post', 'log', 'syntax', 3),
  edge('apiFile', 'svc'),
  edge('post', null, 'uncertain')
]

describe('explorateur : arbre, niveaux et appels regroupés (spec 017 US2)', () => {
  const index = buildIndex(modules, files, symbols)

  it('should_show_modules_at_level_one_with_calls_summed_and_plumbing_hidden_but_counted', () => {
    const view = aggregateView(index, edges, ROOT_KEY, DEFAULT)
    expect(levelOf(index, ROOT_KEY)).toBe(1)
    expect(view.nodes.map((node) => [node.key, node.category])).toEqual([
      ['m:dir:src/api', 'orchestration'],
      ['m:dir:src/core', 'domain']
    ])
    expect(view.edges).toEqual([{ from: 'm:dir:src/api', to: 'm:dir:src/core', count: 3, provenance: 'syntax' }])
    expect(view.hidden).toEqual({ plumbingCalls: 3, nodes: 1 })
    const everything = aggregateView(index, edges, ROOT_KEY, ALL)
    expect(everything.edges).toContainEqual({
      from: 'm:dir:src/api',
      to: 'm:dir:src/utils',
      count: 3,
      provenance: 'syntax'
    })
  })

  it('should_open_a_module_then_a_folder_then_a_file_down_to_the_methods', () => {
    expect(levelOf(index, 'm:dir:src/core')).toBe(2)
    const core = aggregateView(index, edges, 'm:dir:src/core', DEFAULT)
    expect(core.nodes.map((node) => [node.key, node.kind])).toEqual([
      ['d:src/core/orders', 'folder'],
      ['f:src/core/discount.ts', 'file']
    ])
    // Un appel incertain rend le lien regroupé incertain (la plus faible des fiabilités).
    expect(core.edges).toEqual([
      { from: 'd:src/core/orders', to: 'f:src/core/discount.ts', count: 1, provenance: 'uncertain' }
    ])
    expect(levelOf(index, 'd:src/core/orders')).toBe(3)
    expect(aggregateView(index, edges, 'd:src/core/orders', DEFAULT).nodes.map((node) => node.key)).toEqual([
      'f:src/core/orders/orderService.ts'
    ])
    expect(levelOf(index, 'f:src/core/orders/orderService.ts')).toBe(4)
    expect(aggregateView(index, edges, 's:svc', DEFAULT).nodes.map((node) => node.title)).toEqual(['place'])
    expect(breadcrumbOf(index, 's:svc').map((crumb) => crumb.title)).toEqual([
      'Projet',
      'core',
      'orders',
      'orderService.ts',
      'OrderService'
    ])
  })

  it('should_never_show_the_file_symbol_and_count_its_calls_on_the_file', () => {
    const api = aggregateView(index, edges, 'm:dir:src/api', DEFAULT)
    expect(api.nodes.map((node) => node.title)).toEqual(['orderController.ts'])
    expect(
      aggregateView(index, edges, 'f:src/api/orderController.ts', DEFAULT).nodes.map((node) => node.title)
    ).toEqual(['OrderController'])
    expect(aggregateView(index, edges, ROOT_KEY, DEFAULT).edges[0]?.count).toBe(3)
  })

  it('should_drop_uncertain_links_when_asked_and_filter_languages', () => {
    expect(aggregateView(index, edges, 'm:dir:src/core', { ...DEFAULT, hideUncertain: true }).edges).toEqual([])
    expect(aggregateView(index, edges, ROOT_KEY, { ...DEFAULT, langs: ['cs'] }).nodes).toHaveLength(2)
    expect(aggregateView(index, edges, 'm:dir:src/core', { ...DEFAULT, langs: ['cs'] }).nodes).toEqual([
      expect.objectContaining({ kind: 'folder' })
    ])
  })

  it('should_isolate_a_node_with_its_neighbours', () => {
    const view = aggregateView(index, edges, ROOT_KEY, ALL, { key: 'm:dir:src/utils', depth: 1 })
    expect(view.nodes.map((node) => node.key).sort()).toEqual(['m:dir:src/api', 'm:dir:src/utils'])
  })

  it('should_group_the_least_connected_children_beyond_one_hundred_fifty', () => {
    const many = Array.from({ length: 200 }, (_, n) => ({
      path: `src/core/f${n}.ts`,
      lang: 'ts' as const,
      moduleKey: 'dir:src/core'
    }))
    const big = buildIndex(modules, many, [])
    const view = aggregateView(big, [], 'm:dir:src/core', DEFAULT)
    expect(view.nodes).toHaveLength(149)
    expect(view.grouped).toEqual([{ key: 'm:dir:src/core#reste', title: '+ 51 éléments', count: 51 }])
  })

  it('should_lay_out_columns_by_category_and_keep_pinned_positions', () => {
    const positions = columnLayout(
      [
        { key: 'a', category: 'orchestration' },
        { key: 'b', category: 'domain' },
        { key: 'c', category: 'domain' },
        { key: 'd', category: 'infrastructure' }
      ],
      [
        { from: 'a', to: 'c' },
        { from: 'c', to: 'd' }
      ],
      new Map([['d', { x: 999, y: 7 }]])
    )
    expect(positions.get('a')).toEqual({ x: 0, y: 0 })
    expect(positions.get('c')).toEqual({ x: COLUMN_WIDTH, y: 0 })
    expect(positions.get('b')?.x).toBe(COLUMN_WIDTH)
    expect(positions.get('d')).toEqual({ x: 999, y: 7 })
  })
})
