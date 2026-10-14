import { describe, expect, it } from 'vitest'
import type { CodeCategory } from '../../../src/shared/ipc/reprise'
import { buildBoxes, longestDepths, type BoxesInput, type BoxSymbolInput } from '../../../src/main/domain/reprise/boxes'

// Petite boutique fictive : démarrage, contrôleur, domaine (deux fichiers qui s'appellent), stockage et journal.
const sym = (
  id: string,
  path: string,
  name: string,
  kind: BoxSymbolInput['kind'],
  parentId: string | null = null,
  startLine = 1
): BoxSymbolInput => ({
  id,
  path,
  name,
  kind,
  parentId,
  startLine
})
const SYMBOLS: BoxSymbolInput[] = [
  sym('p0', 'Program.cs', '(fichier)', 'function'),
  sym('c1', 'Controllers/OrdersController.cs', 'OrdersController', 'class'),
  sym('c2', 'Controllers/OrdersController.cs', 'Post', 'method', 'c1', 10),
  sym('d1', 'Domain/OrderService.cs', 'OrderService', 'class'),
  sym('d2', 'Domain/OrderService.cs', 'Place', 'method', 'd1', 20),
  sym('d3', 'Domain/OrderService.cs', 'CalculateDiscount', 'method', 'd1', 12),
  sym('d4', 'Domain/OrderService.cs', 'Archive', 'method', 'd1', 30),
  sym('s1', 'Domain/Stores.cs', 'Stores', 'class'),
  sym('s2', 'Domain/Stores.cs', 'Resolve', 'method', 's1', 3),
  sym('i1', 'Infrastructure/SqlOrderRepository.cs', 'SqlOrderRepository', 'class'),
  sym('i2', 'Infrastructure/SqlOrderRepository.cs', 'Save', 'method', 'i1', 5),
  sym('i3', 'Infrastructure/Invoices/InvoiceRepository.cs', 'InvoiceRepository', 'class'),
  sym('i4', 'Infrastructure/Invoices/InvoiceRepository.cs', 'Save', 'method', 'i3', 5),
  sym('l1', 'Logging/AuditLog.cs', 'AuditLog', 'class'),
  sym('l2', 'Logging/AuditLog.cs', 'Save', 'method', 'l1', 3)
]
const CATEGORIES: Readonly<Record<string, CodeCategory>> = {
  'm:dir:Controllers': 'orchestration',
  'm:dir:Domain': 'domain',
  'm:dir:Infrastructure': 'infrastructure',
  'm:dir:Logging': 'plumbing',
  'f:Logging/AuditLog.cs': 'plumbing'
}
const edge = (from: string, to: string | null, extra: Partial<BoxesInput['edges'][number]> = {}) => ({
  fromSymbolId: from,
  toSymbolId: to,
  kind: 'call' as const,
  provenance: 'syntax' as const,
  count: 1,
  candidatesJson: null,
  ...extra
})

function input(over: Partial<BoxesInput> = {}): BoxesInput {
  return {
    modules: [
      {
        key: 'dir:Controllers',
        name: 'Controllers',
        rootPath: 'Controllers',
        summary: 'Reçoit les commandes du site.'
      },
      { key: 'dir:Domain', name: 'Domain', rootPath: 'Domain', summary: null },
      { key: 'dir:Infrastructure', name: 'Infrastructure', rootPath: 'Infrastructure', summary: null },
      { key: 'dir:Logging', name: 'Logging', rootPath: 'Logging', summary: null }
    ],
    files: [
      { path: 'Program.cs', lang: 'cs', lines: 14, moduleKey: null },
      { path: 'Controllers/OrdersController.cs', lang: 'cs', lines: 24, moduleKey: 'dir:Controllers' },
      { path: 'Domain/OrderService.cs', lang: 'cs', lines: 29, moduleKey: 'dir:Domain' },
      { path: 'Domain/Stores.cs', lang: 'cs', lines: 6, moduleKey: 'dir:Domain' },
      { path: 'Infrastructure/SqlOrderRepository.cs', lang: 'cs', lines: 14, moduleKey: 'dir:Infrastructure' },
      { path: 'Infrastructure/Invoices/InvoiceRepository.cs', lang: 'cs', lines: 12, moduleKey: 'dir:Infrastructure' },
      { path: 'Logging/AuditLog.cs', lang: 'cs', lines: 12, moduleKey: 'dir:Logging' }
    ],
    symbols: SYMBOLS,
    edges: [
      edge('p0', 'c1', { kind: 'injects' }),
      edge('c2', 'd2', { count: 2 }),
      edge('d2', 'i2', { provenance: 'deduced' }),
      edge('d4', 's2'),
      edge('d4', null, { provenance: 'uncertain', candidatesJson: JSON.stringify(['i4', 'l2', 'i2']) })
    ],
    entries: [{ symbolId: 'p0', kind: 'main' }],
    categoryOf: (key) => CATEGORIES[key] ?? 'domain',
    ...over
  }
}

describe('carte de l’explorateur en boîtes (spec 031 lot 1)', () => {
  it('should_name_each_module_by_its_layer_and_call_the_entry_point_start', () => {
    const { modules } = buildBoxes(input())
    const byKey = Object.fromEntries(modules.map((m) => [m.key, m]))
    expect(byKey['m:dir:']).toMatchObject({ title: 'Démarrage', layer: 'start', files: 1, lines: 14 })
    expect(byKey['m:dir:Controllers']).toMatchObject({ layer: 'entry', role: 'Reçoit les commandes du site.' })
    expect(byKey['m:dir:Domain']).toMatchObject({ layer: 'rules', role: null, files: 2, lines: 35 })
    expect(byKey['m:dir:Infrastructure']).toMatchObject({ layer: 'data', plumbing: false })
    expect(byKey['m:dir:Logging']).toMatchObject({ layer: 'data', plumbing: true })
  })

  it('should_name_a_root_without_entry_point_after_its_only_file_or_call_it_the_project_root', () => {
    const one = buildBoxes(input({ entries: [] })).modules.find((m) => m.key === 'm:dir:')
    expect(one).toMatchObject({ title: 'Program.cs', layer: 'rules' })
    const files = [...input().files, { path: 'README.ts', lang: 'ts' as const, lines: 3, moduleKey: null }]
    expect(buildBoxes(input({ entries: [], files })).modules.find((m) => m.key === 'm:dir:')?.title).toBe(
      'Racine du projet'
    )
  })

  it('should_order_the_modules_left_to_right_in_the_direction_of_the_calls', () => {
    const column = Object.fromEntries(buildBoxes(input()).modules.map((m) => [m.title, m.column]))
    expect(column).toMatchObject({ Démarrage: 0, Controllers: 1, Domain: 2, Infrastructure: 3, Logging: 3 })
  })

  it('should_tell_each_call_in_words_and_count_the_possible_targets_of_a_guessed_one', () => {
    const { calls } = buildBoxes(input())
    const call = (from: string, to: string) => calls.find((c) => c.from === `f:${from}` && c.to === `f:${to}`)
    expect(call('Controllers/OrdersController.cs', 'Domain/OrderService.cs')).toMatchObject({
      count: 2,
      provenance: 'syntax',
      sentences: [{ from: 'OrdersController.Post', to: 'OrderService.Place', kind: 'call', alternatives: 0 }]
    })
    expect(call('Program.cs', 'Controllers/OrdersController.cs')?.sentences[0]).toMatchObject({
      from: 'Program.cs',
      to: 'OrdersController',
      kind: 'injects'
    })
    // Sans cible retenue : un lien deviné vers chacune des cibles possibles, qui dit combien il y en a.
    for (const to of ['Logging/AuditLog.cs', 'Infrastructure/Invoices/InvoiceRepository.cs']) {
      expect(call('Domain/OrderService.cs', to)).toMatchObject({
        provenance: 'uncertain',
        sentences: [{ from: 'OrderService.Archive', to: expect.stringMatching(/\.Save$/), alternatives: 3 }]
      })
    }
    // Un appel sûr et un appel deviné vers le même fichier : la plus faible des fiabilités l'emporte.
    expect(call('Domain/OrderService.cs', 'Infrastructure/SqlOrderRepository.cs')).toMatchObject({
      count: 2,
      provenance: 'uncertain'
    })
  })

  it('should_list_functions_in_code_order_and_rank_files_by_call_depth_inside_their_module', () => {
    const { files } = buildBoxes(input())
    const file = (path: string) => files.find((f) => f.path === path)
    expect(file('Domain/OrderService.cs')).toMatchObject({
      functions: ['CalculateDiscount', 'Place', 'Archive'],
      depth: 0,
      external: true
    })
    expect(file('Domain/Stores.cs')).toMatchObject({ depth: 1, external: false, folder: '' })
    expect(file('Infrastructure/Invoices/InvoiceRepository.cs')).toMatchObject({
      folder: 'Invoices',
      title: 'InvoiceRepository.cs',
      moduleKey: 'm:dir:Infrastructure'
    })
    expect(file('Logging/AuditLog.cs')).toMatchObject({ plumbing: true, role: null })
  })

  it('should_break_a_loop_at_its_least_called_node_without_inflating_the_depths', () => {
    const depth = longestDepths(
      ['a', 'b', 'c', 'd', 'e'],
      [
        ['a', 'b'],
        ['b', 'c'],
        ['c', 'a'],
        ['c', 'd'],
        ['d', 'e']
      ],
      3
    )
    expect(Object.fromEntries(depth)).toEqual({ a: 0, b: 1, c: 2, d: 3, e: 3 })
  })

  it('should_order_columns_by_calls_only_not_by_implements_which_points_back', () => {
    // L'infrastructure implémente une interface du domaine : ce lien remonte et ne doit pas créer de boucle.
    const edges = [...input().edges, edge('i1', 'd1', { kind: 'implements' })]
    const column = Object.fromEntries(buildBoxes(input({ edges })).modules.map((m) => [m.title, m.column]))
    expect(column).toMatchObject({ Domain: 2, Infrastructure: 3 })
  })

  it('should_give_each_file_the_role_written_with_the_guide', () => {
    const files = input().files.map((f) =>
      f.path === 'Domain/Stores.cs' ? { ...f, summary: 'Trouve le magasin.' } : f
    )
    const boxes = buildBoxes(input({ files })).files
    expect(boxes.find((f) => f.path === 'Domain/Stores.cs')?.role).toBe('Trouve le magasin.')
    expect(boxes.find((f) => f.path === 'Domain/OrderService.cs')?.role).toBeNull()
  })

  it('should_not_list_a_constructor_among_the_functions', () => {
    const symbols = [...SYMBOLS, sym('d9', 'Domain/OrderService.cs', 'OrderService', 'method', 'd1', 5)]
    expect(
      buildBoxes(input({ symbols })).files.find((f) => f.path === 'Domain/OrderService.cs')?.functions
    ).not.toContain('OrderService')
  })

  it('should_skip_links_to_unknown_symbols_and_say_when_the_map_is_truncated', () => {
    const boxes = buildBoxes(input({ edges: [edge('c2', 'inconnu'), edge('inconnu', 'd2')] }))
    expect(boxes.calls).toEqual([])
    expect(boxes.truncated).toBe(false)
    const many = Array.from({ length: 5_001 }, (_, i) => ({
      path: `f${i}.ts`,
      lang: 'ts' as const,
      lines: 1,
      moduleKey: null
    }))
    expect(buildBoxes(input({ files: many, edges: [], entries: [] })).truncated).toBe(true)
  })
})
