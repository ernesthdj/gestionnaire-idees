import { describe, expect, it } from 'vitest'
import {
  aggregateView,
  breadcrumbOf,
  buildIndex,
  FILE_SYMBOL,
  levelOf,
  openableKey,
  placeOf,
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
    expect(levelOf(ROOT_KEY)).toBe(1)
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

  it('should_open_a_module_on_its_folders_with_their_files_in_the_node_and_a_racine_for_direct_files', () => {
    expect(levelOf('m:dir:src/core')).toBe(2)
    const core = aggregateView(index, edges, 'm:dir:src/core', DEFAULT)
    expect(core.nodes.map((node) => [node.key, node.kind, node.childCount])).toEqual([
      ['d:src/core/orders', 'folder', 0],
      ['r:m:dir:src/core', 'folder', 0]
    ])
    expect(core.nodes[0]?.files.map((file) => file.path)).toEqual(['src/core/orders/orderService.ts'])
    expect(core.nodes[1]).toMatchObject({ title: 'Racine · core', files: [{ key: 'f:src/core/discount.ts' }] })
    // Un appel incertain rend le lien regroupé incertain (la plus faible des fiabilités).
    expect(core.edges).toEqual([
      { from: 'd:src/core/orders', to: 'r:m:dir:src/core', count: 1, provenance: 'uncertain' }
    ])
    const top = aggregateView(index, edges, ROOT_KEY, DEFAULT)
    expect(top.nodes.find((node) => node.key === 'm:dir:src/core')).toMatchObject({
      childCount: 2,
      files: [],
      folders: [{ key: 'd:src/core/orders', title: 'orders' }]
    })
    expect(breadcrumbOf(index, 'd:src/core/orders').map((crumb) => crumb.title)).toEqual(['Projet', 'core', 'orders'])
  })

  it('should_place_files_and_symbols_in_their_folder_node_and_open_only_modules_or_folders', () => {
    const pathOf = (id: string): string | undefined => symbols.find((entry) => entry.id === id)?.path
    expect(placeOf(index, 's:place', pathOf)).toEqual({
      parentKey: 'm:dir:src/core',
      nodeKey: 'd:src/core/orders',
      path: 'src/core/orders/orderService.ts',
      symbolId: 'place'
    })
    expect(placeOf(index, 'f:src/core/discount.ts', pathOf)).toEqual({
      parentKey: 'm:dir:src/core',
      nodeKey: 'r:m:dir:src/core',
      path: 'src/core/discount.ts',
      symbolId: null
    })
    expect(placeOf(index, 'd:src/core/orders', pathOf)).toMatchObject({ parentKey: 'm:dir:src/core', path: null })
    expect(placeOf(index, 's:inconnu', pathOf)).toBeNull()
    expect(openableKey(index, 's:place')).toBe('d:src/core/orders')
    expect(openableKey(index, 'f:src/core/discount.ts')).toBe('m:dir:src/core')
  })

  it('should_never_show_the_file_symbol_and_count_its_calls_on_the_racine', () => {
    const api = aggregateView(index, edges, 'm:dir:src/api', DEFAULT)
    expect(api.nodes.map((node) => node.files.map((file) => file.title))).toEqual([['orderController.ts']])
    expect(aggregateView(index, edges, ROOT_KEY, DEFAULT).edges[0]?.count).toBe(3)
  })

  it('should_drop_uncertain_links_when_asked_and_filter_languages', () => {
    expect(aggregateView(index, edges, 'm:dir:src/core', { ...DEFAULT, hideUncertain: true }).edges).toEqual([])
    expect(aggregateView(index, edges, ROOT_KEY, { ...DEFAULT, langs: ['cs'] }).nodes).toHaveLength(2)
    expect(aggregateView(index, edges, 'm:dir:src/core', { ...DEFAULT, langs: ['cs'] }).nodes).toEqual([
      expect.objectContaining({ kind: 'folder', files: [], hiddenFiles: 1 }),
      expect.objectContaining({ key: 'r:m:dir:src/core', files: [], hiddenFiles: 1 })
    ])
  })

  it('should_isolate_a_node_with_its_neighbours', () => {
    const view = aggregateView(index, edges, ROOT_KEY, ALL, { key: 'm:dir:src/utils', depth: 1 })
    expect(view.nodes.map((node) => node.key).sort()).toEqual(['m:dir:src/api', 'm:dir:src/utils'])
  })

  it('should_group_the_least_connected_children_beyond_one_hundred_fifty', () => {
    const many = Array.from({ length: 200 }, (_, n) => ({
      path: `src/core/d${n}/f.ts`,
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
