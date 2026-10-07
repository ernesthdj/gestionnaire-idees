import { describe, expect, it, vi } from 'vitest'
import type { ExplorerService } from '../../../src/main/application/reprise/ExplorerService'
import type { ElementFilesService } from '../../../src/main/application/reprise/ElementFilesService'
import type { StructureService } from '../../../src/main/application/structure/StructureService'
import { createExplorerRoutes } from '../../../src/main/ipc/explorerHandlers'
import { createDispatcher } from '../../../src/main/ipc/registry'
import { createStructureRoutes } from '../../../src/main/ipc/structureHandlers'

const ID = '00000000-0000-4000-8000-0000000000e2'
const FILTERS = { categories: ['domain'], langs: [], hideUncertain: false }

function setup() {
  const explorer = {
    view: vi.fn(() => ({ level: 1 })),
    node: vi.fn(),
    code: vi.fn(() => ({ lines: [] })),
    search: vi.fn(() => ({ results: [] })),
    locate: vi.fn(() => ({ results: [] })),
    file: vi.fn(() => ({ lines: [] })),
    savePosition: vi.fn(),
    state: vi.fn(),
    saveState: vi.fn()
  }
  return { explorer, dispatch: createDispatcher(createExplorerRoutes(explorer as unknown as ExplorerService)) }
}

describe('canaux explorer:* (spec 017 US2)', () => {
  it('should_read_a_project_file_by_its_relative_path_only', async () => {
    const { dispatch, explorer } = setup()
    expect(await dispatch('explorer:file', { genesisId: ID, path: 'Domain/OrderService.cs' })).toMatchObject({
      success: true
    })
    for (const path of ['../secret.txt', 'C:/Windows/win.ini', '/etc/passwd', 'a/../../b', 'a\\..\\b', '']) {
      expect(await dispatch('explorer:file', { genesisId: ID, path }), path).toMatchObject({ success: false })
    }
    expect(
      await dispatch('explorer:view', { genesisId: ID, parentKey: 'r:m:dir:src', filters: FILTERS })
    ).toMatchObject({ success: true })
    expect(explorer.file).toHaveBeenCalledTimes(1)
  })

  it('should_locate_at_most_a_hundred_cited_names_of_bounded_length', async () => {
    const { dispatch, explorer } = setup()
    expect(await dispatch('explorer:locate', { genesisId: ID, sources: ['Domain/A.cs'] })).toMatchObject({
      success: true
    })
    const many = Array.from({ length: 101 }, (_, index) => `f${index}.ts`)
    expect(await dispatch('explorer:locate', { genesisId: ID, sources: many })).toMatchObject({ success: false })
    expect(await dispatch('explorer:locate', { genesisId: ID, sources: ['x'.repeat(301)] })).toMatchObject({
      success: false
    })
    expect(explorer.locate).toHaveBeenCalledTimes(1)
  })

  it('should_open_a_node_with_its_filters_and_isolate_a_neighbourhood', async () => {
    const { dispatch, explorer } = setup()
    expect(await dispatch('explorer:view', { genesisId: ID, parentKey: '', filters: FILTERS })).toMatchObject({
      success: true
    })
    await dispatch('explorer:view', {
      genesisId: ID,
      parentKey: 'm:dir:src/core',
      filters: FILTERS,
      focusKey: 'f:src/core/a.ts',
      depth: 2
    })
    expect(explorer.view).toHaveBeenLastCalledWith(ID, {
      parentKey: 'm:dir:src/core',
      filters: FILTERS,
      focusKey: 'f:src/core/a.ts',
      depth: 2
    })
  })

  it.each([
    ['explorer:view', { genesisId: ID, parentKey: 'C:/Windows', filters: FILTERS }],
    ['explorer:view', { genesisId: ID, parentKey: '', filters: { ...FILTERS, categories: ['secret'] } }],
    ['explorer:view', { genesisId: ID, parentKey: '', filters: FILTERS, depth: 5 }],
    ['explorer:code', { genesisId: ID, symbolId: '../../.env' }],
    ['explorer:search', { genesisId: ID, query: 'a' }],
    ['explorer:savePosition', { genesisId: ID, parentKey: '', nodeKey: 'm:x', x: Number.NaN, y: 0 }]
  ] as const)('should_refuse_%s_with_an_invalid_payload_%#', async (channel, payload) => {
    const { dispatch, explorer } = setup()
    expect(await dispatch(channel, payload)).toMatchObject({ success: false, error: { code: 'VALIDATION' } })
    expect(explorer.view).not.toHaveBeenCalled()
    expect(explorer.code).not.toHaveBeenCalled()
  })
})

describe('canaux structure:files / structure:file (spec 017 US7)', () => {
  const ELEMENT = '00000000-0000-4000-8000-0000000000e3'
  const setupStructure = () => {
    const files = { files: vi.fn(() => ({ files: [] })), file: vi.fn(() => ({ lines: [] })) }
    const structure = { setCollapsed: vi.fn() }
    return {
      files,
      dispatch: createDispatcher(
        createStructureRoutes(structure as unknown as StructureService, files as unknown as ElementFilesService)
      )
    }
  }

  it('should_list_and_read_the_files_of_an_element', async () => {
    const { dispatch, files } = setupStructure()
    expect(await dispatch('structure:files', { elementId: ELEMENT })).toMatchObject({ success: true })
    await dispatch('structure:file', { elementId: ELEMENT, path: 'src/core/a.ts' })
    expect(files.file).toHaveBeenCalledWith(ELEMENT, 'src/core/a.ts')
  })

  it.each([
    '../secret.ts',
    'C:/Windows/win.ini',
    '/etc/passwd',
    'src/../../x.ts',
    '',
    '\\\\serveur\\x',
    'src\\..\\..\\x'
  ])('should_refuse_the_path_%s', async (path) => {
    const { dispatch, files } = setupStructure()
    expect(await dispatch('structure:file', { elementId: ELEMENT, path })).toMatchObject({
      success: false,
      error: { code: 'VALIDATION' }
    })
    expect(files.file).not.toHaveBeenCalled()
  })
})
