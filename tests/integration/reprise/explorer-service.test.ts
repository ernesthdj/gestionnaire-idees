import { cpSync, mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { loadEngine, type Engine } from '../../../src/analysis-worker/engine'
import { processBatch } from '../../../src/analysis-worker/process'
import { AnalysisService } from '../../../src/main/application/reprise/AnalysisService'
import { DEFAULT_FILTERS, ExplorerService } from '../../../src/main/application/reprise/ExplorerService'
import { CodeGraphRepository } from '../../../src/main/infrastructure/db/repositories/CodeGraphRepository'
import { RepriseRepository } from '../../../src/main/infrastructure/db/repositories/RepriseRepository'
import { scanProject } from '../../../src/main/infrastructure/reprise/ProjectScanner'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'
import { GRAMMARS_DIR, REPRISE_FIXTURES } from '../../support/reprise'

describe('explorateur d’un projet repris (spec 017 US2)', () => {
  let engine: Engine
  let t: NeuronHarness
  let root: string
  let reprise: RepriseRepository
  let graph: CodeGraphRepository
  let explorer: ExplorerService
  let analysis: AnalysisService
  let genesis: string

  beforeAll(async () => {
    engine = await loadEngine(GRAMMARS_DIR)
  })
  beforeEach(async () => {
    t = createNeuronHarness()
    reprise = new RepriseRepository(t.handle.db)
    graph = new CodeGraphRepository(t.handle.db)
    explorer = new ExplorerService({ reprise, graph })
    analysis = new AnalysisService({
      reprise,
      graph,
      scan: (folder) => scanProject(folder),
      runWorker: (request, onMessage) => {
        void processBatch(engine, request, (message) => onMessage(JSON.parse(JSON.stringify(message))))
        return { cancel: () => undefined }
      },
      emit: (event) => {
        if (event.type === 'reprise:changed') explorer.invalidate(event.payload.genesisId)
      }
    })
    root = realpathSync(mkdtempSync(join(tmpdir(), 'gi-explorer-')))
    cpSync(join(REPRISE_FIXTURES, 'cs-app'), join(root, 'cs-app'), { recursive: true })
    genesis = (await t.neurons.create({ text: 'cs-app' })).id
    reprise.createProject({
      genesisId: genesis,
      rootDir: join(root, 'cs-app'),
      source: 'folder',
      remoteUrl: null,
      confidentiality: 'claude',
      confidentialityChangedAt: '2026-10-07T08:00:00.000Z'
    })
    analysis.analyze(genesis)
    await analysis.idle()
  })
  afterEach(() => {
    t.dispose()
    rmSync(root, { recursive: true, force: true })
  })

  it('should_show_the_modules_in_columns_then_open_one_down_to_the_methods', () => {
    const top = explorer.view(genesis, { parentKey: '', filters: DEFAULT_FILTERS })
    expect(top).toMatchObject({ level: 1, confidentiality: 'claude', folderMissing: false })
    expect(top.nodes.map((node) => [node.title, node.category]).sort()).toEqual([
      ['(racine)', 'orchestration'],
      ['Controllers', 'orchestration'],
      ['Domain', 'domain'],
      ['Infrastructure', 'infrastructure']
    ])
    expect(top.hidden.nodes).toBe(1)
    const controllers = top.nodes.find((node) => node.title === 'Controllers')
    const domain = top.nodes.find((node) => node.title === 'Domain')
    expect(controllers?.x).toBeLessThan(domain?.x ?? 0)
    expect(top.edges).toContainEqual(expect.objectContaining({ from: controllers?.key, to: domain?.key }))
    // D16 : le module ouvert montre ses dossiers, et ses fichiers directs dans le nœud « Racine ».
    const inside = explorer.view(genesis, { parentKey: domain?.key ?? '', filters: DEFAULT_FILTERS })
    expect(inside.level).toBe(2)
    expect(inside.nodes).toEqual([
      expect.objectContaining({ key: `r:${domain?.key ?? ''}`, title: 'Racine · Domain', childCount: 0 })
    ])
    expect(inside.nodes[0]?.files.map((file) => file.path)).toContain('Domain/OrderService.cs')
    expect(inside.breadcrumb.map((crumb) => crumb.title)).toEqual(['Projet', 'Domain'])
    // Un ancien état ouvert sur un fichier ouvre son module.
    expect(
      explorer.view(genesis, { parentKey: 'f:Domain/OrderService.cs', filters: DEFAULT_FILTERS }).breadcrumb.at(-1)
    ).toEqual({ key: domain?.key, title: 'Domain' })
  })

  it('should_show_a_whole_file_with_who_calls_each_block_and_what_it_calls', () => {
    const view = explorer.file(genesis, 'Domain/OrderService.cs')
    expect(view.lines.join('\n')).toContain('public decimal Place(OrderRequest request)')
    expect(view.place).toMatchObject({ nodeKey: expect.stringMatching(/^r:m:/), path: 'Domain/OrderService.cs' })
    const place = view.blocks.find((block) => block.name === 'Place')
    expect(place?.callers.map((link) => [link.title, link.path, link.provenance])).toEqual([
      ['Shop.Controllers.OrdersController.Post', 'Controllers/OrdersController.cs', 'syntax']
    ])
    const save = place?.callees.find((link) => link.title === 'Shop.Infrastructure.SqlOrderRepository.Save')
    expect(save?.path).toBe('Infrastructure/SqlOrderRepository.cs')
    expect(view.lines[(save?.at ?? 0) - 1]).toContain('Save')
    expect(() => explorer.file(genesis, 'Domain/Invente.cs')).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }))
  })

  it('should_tell_who_calls_an_element_and_show_its_code_as_text', () => {
    const place = graph.symbols(genesis).find((symbol) => symbol.name === 'Place')
    const detail = explorer.node(genesis, `s:${place?.id ?? ''}`)
    expect(detail).toMatchObject({ title: 'Place', category: 'domain', path: 'Domain/OrderService.cs' })
    expect(detail.callers.map((link) => link.title)).toEqual(['Shop.Controllers.OrdersController.Post'])
    expect(detail.callees.map((link) => link.title)).toContainEqual('Shop.Infrastructure.SqlOrderRepository.Save')
    const code = explorer.code(genesis, place?.id ?? '')
    expect(code.path).toBe('Domain/OrderService.cs')
    expect(code.lines[0]).toContain('public decimal Place(OrderRequest request)')
    expect(explorer.search(genesis, 'save').results.map((result) => result.title)).toContain('Save')
  })

  it('should_locate_the_names_cited_by_the_guide_and_skip_the_unknown_ones', () => {
    const place = graph.symbols(genesis).find((symbol) => symbol.name === 'Place')
    const { results } = explorer.locate(genesis, [
      './Domain/OrderService.cs',
      'Domain/OrderService.cs#Place',
      'Place()',
      'Domain/Invente.cs',
      'npm start'
    ])
    expect(results.map((result) => [result.path, result.symbolId])).toEqual([
      ['Domain/OrderService.cs', null],
      ['Domain/OrderService.cs', place?.id],
      ['Domain/OrderService.cs', place?.id]
    ])
    expect(results[0]?.key).toMatch(/^r:m:/)
    for (const result of results)
      expect(
        explorer.view(genesis, { parentKey: result.parentKey, filters: DEFAULT_FILTERS }).nodes.length
      ).toBeGreaterThan(0)
  })

  it('should_measure_the_calls_between_files_for_the_map_of_claude', () => {
    expect(explorer.fileCalls(genesis)).toContainEqual(
      expect.objectContaining({ from: 'Controllers/OrdersController.cs', to: 'Domain/OrderService.cs' })
    )
    expect(explorer.fileCalls(genesis).every((call) => call.from !== call.to)).toBe(true)
  })

  it('should_remember_positions_and_filters_and_refresh_after_a_correction', () => {
    const top = explorer.view(genesis, { parentKey: '', filters: DEFAULT_FILTERS })
    const domain = top.nodes.find((node) => node.title === 'Domain')
    explorer.savePosition(genesis, { parentKey: '', nodeKey: domain?.key ?? '', x: 42, y: 24 })
    expect(explorer.view(genesis, { parentKey: '', filters: DEFAULT_FILTERS }).nodes).toContainEqual(
      expect.objectContaining({ key: domain?.key, x: 42, y: 24 })
    )
    const filters = { ...DEFAULT_FILTERS, hideUncertain: true }
    explorer.saveState(genesis, { parentKey: domain?.key ?? '', filters })
    expect(explorer.state(genesis)).toEqual({ parentKey: domain?.key, filters })
    const audit = graph.symbols(genesis).find((symbol) => symbol.name === 'AuditLog')
    analysis.setCategory(genesis, audit?.id ?? '', 'domain')
    expect(
      explorer.view(genesis, { parentKey: '', filters: DEFAULT_FILTERS }).nodes.map((node) => node.title)
    ).toContain('Logging')
  })

  it('should_keep_the_last_analysis_readable_when_the_folder_has_disappeared', () => {
    rmSync(join(root, 'cs-app'), { recursive: true, force: true })
    expect(explorer.view(genesis, { parentKey: '', filters: DEFAULT_FILTERS }).folderMissing).toBe(true)
  })

  it('should_answer_in_under_a_second_on_five_thousand_files_and_fifty_thousand_links', async () => {
    const big = 'big'
    const id = (await t.neurons.create({ text: 'Grand projet' })).id
    reprise.createProject({
      genesisId: id,
      rootDir: join(root, big),
      source: 'folder',
      remoteUrl: null,
      confidentiality: 'local',
      confidentialityChangedAt: '2026-10-07T08:00:00.000Z'
    })
    const modules = Array.from({ length: 20 }, (_, m) => ({
      id: `m${m}`,
      genesisId: id,
      key: `dir:src/m${m}`,
      name: `m${m}`,
      rootPath: `src/m${m}`,
      kind: 'folder' as const
    }))
    graph.replaceModules(id, modules)
    const files = Array.from({ length: 5000 }, (_, n) => {
      const path = `src/m${n % 20}/d${n % 7}/f${n}.ts`
      return {
        file: {
          id: `f${n}`,
          genesisId: id,
          moduleId: `m${n % 20}`,
          path,
          lang: 'ts' as const,
          hash: 'h',
          lines: 10,
          status: 'ok' as const,
          error: null
        },
        symbols: [0, 1].map((k) => ({
          id: `s${n}-${k}`,
          fileId: `f${n}`,
          parentId: null,
          kind: 'function' as const,
          name: `fn${n}_${k}`,
          qualifiedName: `fn${n}_${k}`,
          startLine: 1,
          endLine: 2,
          complexity: 1,
          category: 'domain' as const,
          categorySource: 'rules' as const,
          categoryReason: null
        })),
        entries: []
      }
    })
    graph.writeFiles(id, files)
    graph.replaceEdges(
      id,
      Array.from({ length: 50_000 }, (_, e) => ({
        id: `e${e}`,
        genesisId: id,
        fromSymbolId: `s${e % 5000}-0`,
        toSymbolId: `s${(e * 7) % 5000}-1`,
        rawTarget: 'x',
        kind: 'call' as const,
        provenance: 'syntax' as const,
        reason: null,
        count: 1
      }))
    )
    const started = performance.now()
    const top = explorer.view(id, { parentKey: '', filters: DEFAULT_FILTERS })
    const first = performance.now() - started
    const inner = performance.now()
    const module = explorer.view(id, { parentKey: top.nodes[0]?.key ?? '', filters: DEFAULT_FILTERS })
    const second = performance.now() - inner
    expect(top.nodes).toHaveLength(20)
    expect(module.nodes).toHaveLength(7)
    expect(first).toBeLessThan(1000)
    expect(second).toBeLessThan(1000)
    // Délai du test : la préparation (50 000 liens écrits en base) dépasse 5 s quand toute la suite tourne en
    // parallèle ; la mesure, elle, reste bornée à 1 s ci-dessus.
  }, 20_000)
})
