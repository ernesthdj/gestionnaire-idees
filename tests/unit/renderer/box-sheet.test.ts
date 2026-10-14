import { describe, expect, it } from 'vitest'
import type { ExplorerMapView, MapCallView, MapFileView, MapModuleView } from '../../../src/shared/ipc/reprise'
import { fileSheet, moduleSheet, searchMap } from '../../../src/renderer/src/explorer/boxes/sheet'

const mod = (key: string, extra: Partial<MapModuleView> = {}): MapModuleView => ({
  key,
  title: key.slice(6),
  layer: 'rules',
  plumbing: false,
  role: null,
  column: 0,
  files: 1,
  lines: 10,
  ...extra
})
const file = (moduleKey: string, name: string, extra: Partial<MapFileView> = {}): MapFileView => ({
  key: `f:${moduleKey.slice(6)}/${name}`,
  path: `${moduleKey.slice(6)}/${name}`,
  moduleKey,
  title: name,
  folder: '',
  lang: 'cs',
  lines: 10,
  role: null,
  functions: [],
  depth: 0,
  external: false,
  plumbing: false,
  ...extra
})
const call = (from: string, to: string, count: number, extra: Partial<MapCallView> = {}): MapCallView => ({
  from: `f:${from}`,
  to: `f:${to}`,
  count,
  provenance: 'syntax',
  sentences: [{ from, to, kind: 'call', provenance: 'syntax', alternatives: 0 }],
  ...extra
})
const MAP: ExplorerMapView = {
  modules: [mod('m:dir:Api'), mod('m:dir:Core'), mod('m:dir:Data')],
  files: [
    file('m:dir:Api', 'Orders.cs', { functions: ['Post', 'Get'] }),
    file('m:dir:Core', 'OrderService.cs', { functions: ['Place', 'Résumé'] }),
    file('m:dir:Core', 'Prices.cs', { functions: ['Total'] }),
    file('m:dir:Data', 'Repository.cs', { functions: ['Save', 'Placeholder'] })
  ],
  calls: [
    call('Api/Orders.cs', 'Core/OrderService.cs', 3),
    call('Core/OrderService.cs', 'Core/Prices.cs', 2),
    call('Core/OrderService.cs', 'Data/Repository.cs', 1, {
      provenance: 'uncertain',
      sentences: [
        { from: 'OrderService.Place', to: 'Repository.Save', kind: 'call', provenance: 'uncertain', alternatives: 3 }
      ]
    }),
    call('Core/Prices.cs', 'Data/Repository.cs', 4)
  ],
  truncated: false,
  confidentiality: 'local',
  folderMissing: false
}

describe('fiche et recherche de l’explorateur en boîtes (spec 031 lot 4)', () => {
  it('should_list_the_modules_a_module_uses_and_is_used_by_without_its_internal_calls', () => {
    const sheet = moduleSheet(MAP, 'm:dir:Core')
    expect(sheet.usedBy.map((link) => [link.title, link.count])).toEqual([['Api', 3]])
    // Deux appels vers Data (1 deviné + 4 sûrs) : regroupés, la fiabilité la plus faible gardée.
    expect(sheet.uses).toHaveLength(1)
    expect(sheet.uses[0]).toMatchObject({ key: 'm:dir:Data', count: 5, provenance: 'uncertain' })
    expect(sheet.uses[0]?.sentences).toHaveLength(2)
  })

  it('should_list_the_files_a_file_calls_and_is_called_by_most_called_first', () => {
    const sheet = fileSheet(MAP, 'f:Core/OrderService.cs')
    expect(sheet.uses.map((link) => link.title)).toEqual(['Prices.cs', 'Repository.cs'])
    expect(sheet.usedBy.map((link) => link.key)).toEqual(['f:Api/Orders.cs'])
  })

  it('should_return_an_empty_sheet_when_nothing_calls_or_is_called', () => {
    const sheet = moduleSheet({ ...MAP, calls: [] }, 'm:dir:Core')
    expect(sheet).toEqual({ uses: [], usedBy: [] })
  })

  it('should_find_files_and_functions_closest_first_ignoring_case_and_accents', () => {
    const hits = searchMap(MAP, 'pla')
    expect(hits.map((hit) => hit.fn ?? hit.file.title)).toEqual(['Place', 'Placeholder'])
    expect(searchMap(MAP, 'RESUME')[0]).toMatchObject({ fn: 'Résumé', file: { title: 'OrderService.cs' } })
    // Le nom exact d'abord, puis le début d'un nom, puis le milieu, puis le chemin.
    expect(searchMap(MAP, 'orders.cs').map((hit) => hit.file.title)).toEqual(['Orders.cs'])
    expect(searchMap(MAP, 'order').map((hit) => hit.fn ?? hit.file.title)).toEqual(['Orders.cs', 'OrderService.cs'])
    expect(searchMap(MAP, 'core').map((hit) => hit.file.title)).toEqual(['Prices.cs', 'OrderService.cs'])
  })

  it('should_find_nothing_when_the_query_is_blank_and_cap_the_results', () => {
    expect(searchMap(MAP, '   ')).toEqual([])
    expect(searchMap(MAP, 'e', 2)).toHaveLength(2)
  })
})
