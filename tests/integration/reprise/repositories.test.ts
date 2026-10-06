import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  CodeGraphRepository,
  type AnalyzedFile
} from '../../../src/main/infrastructure/db/repositories/CodeGraphRepository'
import { RepriseRepository } from '../../../src/main/infrastructure/db/repositories/RepriseRepository'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

const AT = '2026-10-06T20:00:00.000Z'

const file = (genesisId: string, path: string, symbols: string[], hash = 'h1'): AnalyzedFile => {
  const fileId = `f:${path}`
  return {
    file: { id: fileId, genesisId, moduleId: null, path, lang: 'ts', hash, lines: 10, status: 'ok', error: null },
    symbols: symbols.map((name, index) => ({
      id: `s:${path}#${name}`,
      fileId,
      parentId: null,
      kind: 'function',
      name,
      qualifiedName: name,
      startLine: index + 1,
      endLine: index + 2,
      complexity: 1,
      category: 'domain',
      categorySource: 'rules',
      categoryReason: null
    })),
    entries: path === 'src/main.ts' ? [{ symbolId: `s:${path}#${symbols[0] ?? ''}`, kind: 'main', label: 'main' }] : []
  }
}

describe('dépôts de la reprise de projet (spec 017 data-model)', () => {
  let t: NeuronHarness
  let reprise: RepriseRepository
  let graph: CodeGraphRepository
  let genesis: string

  beforeEach(async () => {
    t = createNeuronHarness()
    reprise = new RepriseRepository(t.handle.db)
    graph = new CodeGraphRepository(t.handle.db)
    genesis = (await t.neurons.create({ text: 'Boutique reprise' })).id
    reprise.createProject({
      genesisId: genesis,
      rootDir: 'C:/projets/boutique',
      source: 'folder',
      remoteUrl: null,
      confidentiality: 'local',
      confidentialityChangedAt: AT
    })
  })
  afterEach(() => t.dispose())

  it('should_keep_one_project_per_folder_and_its_confidentiality', () => {
    expect(reprise.projectByRoot('C:/projets/boutique')).toMatchObject({
      genesisId: genesis,
      confidentiality: 'local',
      analysisState: 'idle'
    })
    expect(() =>
      reprise.createProject({
        genesisId: genesis,
        rootDir: 'C:/projets/boutique',
        source: 'git',
        remoteUrl: 'https://exemple.invalid/x.git',
        confidentiality: 'claude',
        confidentialityChangedAt: AT
      })
    ).toThrow()
    reprise.setConfidentiality(genesis, 'claude', AT)
    expect(reprise.project(genesis)?.confidentiality).toBe('claude')
  })

  it('should_mark_running_analyses_as_interrupted_at_startup', () => {
    reprise.setAnalysisState(genesis, 'running')
    reprise.startRun({ id: 'r1', genesisId: genesis, kind: 'analysis', at: AT })
    expect(reprise.interruptRunning(AT)).toBe(1)
    expect(reprise.project(genesis)?.analysisState).toBe('interrupted')
    expect(reprise.runs(genesis)[0]).toMatchObject({ state: 'interrupted', endedAt: AT })
  })

  it('should_store_only_numbers_when_a_run_ends', () => {
    reprise.startRun({ id: 'r1', genesisId: genesis, kind: 'analysis', at: AT })
    reprise.endRun('r1', 'done', AT, { files: 12, symbols: 40 })
    expect(JSON.parse(reprise.runs(genesis)[0]?.statsJson ?? '{}')).toEqual({ files: 12, symbols: 40 })
  })

  it('should_replace_the_symbols_of_a_rewritten_file_and_remove_vanished_files', () => {
    graph.writeFiles(genesis, [file(genesis, 'src/main.ts', ['main']), file(genesis, 'src/a.ts', ['a', 'b'])])
    expect(
      graph
        .symbols(genesis)
        .map((symbol) => symbol.name)
        .sort()
    ).toEqual(['a', 'b', 'main'])
    expect(graph.entryPoints(genesis)).toHaveLength(1)
    graph.writeFiles(genesis, [file(genesis, 'src/a.ts', ['c'], 'h2')])
    expect(graph.symbols(genesis).map((symbol) => [symbol.path, symbol.name])).toEqual(
      expect.arrayContaining([
        ['src/a.ts', 'c'],
        ['src/main.ts', 'main']
      ])
    )
    expect(graph.files(genesis).find((row) => row.path === 'src/a.ts')?.hash).toBe('h2')
    graph.removeFiles(genesis, ['src/main.ts'])
    expect(graph.files(genesis).map((row) => row.path)).toEqual(['src/a.ts'])
    expect(graph.entryPoints(genesis)).toEqual([])
  })

  it('should_write_large_batches_in_one_transaction', () => {
    const many = Array.from({ length: 450 }, (_, index) => file(genesis, `src/f${index}.ts`, ['x', 'y']))
    graph.writeFiles(genesis, many)
    expect(graph.files(genesis)).toHaveLength(450)
    expect(graph.symbols(genesis)).toHaveLength(900)
  })

  it('should_keep_module_summaries_for_a_key_that_stays_and_drop_vanished_modules', () => {
    graph.replaceModules(genesis, [
      { id: 'm1', genesisId: genesis, key: 'dir:src/core', name: 'core', rootPath: 'src/core', kind: 'folder' },
      { id: 'm2', genesisId: genesis, key: 'dir:src/old', name: 'old', rootPath: 'src/old', kind: 'folder' }
    ])
    graph.setModuleSummaries(genesis, [{ key: 'dir:src/core', summary: 'Le cœur', analogy: 'la cuisine' }])
    graph.replaceModules(genesis, [
      { id: 'm3', genesisId: genesis, key: 'dir:src/core', name: 'core', rootPath: 'src/core', kind: 'folder' }
    ])
    expect(graph.modules(genesis)).toEqual([expect.objectContaining({ key: 'dir:src/core', analogy: 'la cuisine' })])
  })

  it('should_recompute_edges_and_keep_corrections_of_mentalyas_by_target', () => {
    const edge = {
      id: 'e1',
      genesisId: genesis,
      fromSymbolId: 's1',
      toSymbolId: null,
      rawTarget: 'repo.save',
      kind: 'call' as const,
      provenance: 'uncertain' as const,
      reason: null,
      count: 1
    }
    graph.replaceEdges(genesis, [edge, { ...edge, id: 'e2' }])
    expect(graph.updateEdge(genesis, 'e1', { toSymbolId: 's2', provenance: 'user', reason: null })).toBe(true)
    expect(graph.edges(genesis).find((row) => row.id === 'e1')).toMatchObject({ toSymbolId: 's2', provenance: 'user' })
    graph.replaceEdges(genesis, [edge])
    expect(graph.edges(genesis)).toHaveLength(1)
    reprise.setOverride(genesis, 'edge:src/a.ts#f→repo.save', 's2')
    reprise.setOverride(genesis, 'edge:src/a.ts#f→repo.save', 's3')
    expect(reprise.overrides(genesis).get('edge:src/a.ts#f→repo.save')).toBe('s3')
  })

  it('should_remember_positions_and_the_explorer_state', () => {
    reprise.savePosition({ genesisId: genesis, level: 1, parentKey: '', nodeKey: 'm:core', x: 10, y: 20 })
    reprise.savePosition({ genesisId: genesis, level: 1, parentKey: '', nodeKey: 'm:core', x: 30, y: 40 })
    expect(reprise.positions(genesis, 1, '').get('m:core')).toEqual({ x: 30, y: 40 })
    reprise.saveExplorerState({ genesisId: genesis, filtersJson: '{}', lastLevel: 2, lastParentKey: 'm:core' })
    reprise.saveExplorerState({ genesisId: genesis, filtersJson: '{"a":1}', lastLevel: 3, lastParentKey: 'd:src' })
    expect(reprise.explorerState(genesis)).toMatchObject({ lastLevel: 3, lastParentKey: 'd:src' })
  })
})
