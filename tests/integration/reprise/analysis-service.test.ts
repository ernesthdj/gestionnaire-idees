import { appendFileSync, cpSync, existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { loadEngine, type Engine } from '../../../src/analysis-worker/engine'
import { processBatch } from '../../../src/analysis-worker/process'
import {
  AnalysisService,
  categoryTarget,
  FILE_SYMBOL_NAME,
  type AnalysisEvent,
  type RunWorker
} from '../../../src/main/application/reprise/AnalysisService'
import { CodeGraphRepository } from '../../../src/main/infrastructure/db/repositories/CodeGraphRepository'
import { RepriseRepository } from '../../../src/main/infrastructure/db/repositories/RepriseRepository'
import { scanProject } from '../../../src/main/infrastructure/reprise/ProjectScanner'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'
import { GRAMMARS_DIR, REPRISE_FIXTURES } from '../../support/reprise'

describe('analyse d’un projet repris (spec 017 US3)', () => {
  let engine: Engine
  let t: NeuronHarness
  let root: string
  let reprise: RepriseRepository
  let graph: CodeGraphRepository
  let events: AnalysisEvent[]
  let extracted: number
  let worker: RunWorker
  let service: AnalysisService
  let genesis: string

  beforeAll(async () => {
    engine = await loadEngine(GRAMMARS_DIR)
  })

  const inProcess: RunWorker = (request, onMessage) => {
    let cancelled = false
    void processBatch(
      engine,
      request,
      (message) => {
        if (message.type === 'file') extracted++
        onMessage(JSON.parse(JSON.stringify(message)))
      },
      () => cancelled
    )
    return { cancel: () => (cancelled = true) }
  }

  const setup = async (project: string): Promise<void> => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'gi-analyse-')))
    cpSync(join(REPRISE_FIXTURES, project), join(root, project), { recursive: true })
    genesis = (await t.neurons.create({ text: project })).id
    reprise.createProject({
      genesisId: genesis,
      rootDir: join(root, project),
      source: 'folder',
      remoteUrl: null,
      confidentiality: 'local',
      confidentialityChangedAt: '2026-10-06T20:00:00.000Z'
    })
  }

  beforeEach(() => {
    t = createNeuronHarness()
    reprise = new RepriseRepository(t.handle.db)
    graph = new CodeGraphRepository(t.handle.db)
    events = []
    extracted = 0
    worker = inProcess
    service = new AnalysisService({
      reprise,
      graph,
      scan: (folder) => scanProject(folder),
      runWorker: (request, onMessage, onExit) => worker(request, onMessage, onExit),
      emit: (event) => events.push(event)
    })
  })
  afterEach(() => {
    t.dispose()
    rmSync(root, { recursive: true, force: true })
  })

  it('should_write_files_symbols_links_entries_and_modules_of_a_csharp_project', async () => {
    await setup('cs-app')
    service.analyze(genesis)
    await service.idle()
    const files = graph.files(genesis)
    expect(files.map((file) => [file.path, file.status]).sort()).toEqual([
      ['App.csproj', 'unsupported'],
      ['Controllers/OrdersController.cs', 'ok'],
      ['Domain/OrderService.cs', 'ok'],
      ['Domain/Stores.cs', 'ok'],
      ['Infrastructure/InvoiceRepository.cs', 'ok'],
      ['Infrastructure/SqlOrderRepository.cs', 'ok'],
      ['Logging/AuditLog.cs', 'ok'],
      ['Program.cs', 'ok']
    ])
    const symbols = graph.symbols(genesis)
    const named = (name: string) => symbols.find((symbol) => symbol.name === name)
    expect(named('OrdersController')).toMatchObject({ category: 'orchestration', categorySource: 'rules' })
    expect(named('SqlOrderRepository')?.category).toBe('infrastructure')
    expect(named('AuditLog')?.category).toBe('plumbing')
    expect(named('OrderService')?.category).toBe('domain')
    expect(symbols.filter((symbol) => symbol.name === FILE_SYMBOL_NAME)).toHaveLength(7)
    const edges = graph.edges(genesis)
    const place = named('Place')?.id
    const save = symbols.find((symbol) => symbol.name === 'Save' && symbol.qualifiedName.includes('SqlOrderRepository'))
    expect(edges).toContainEqual(
      expect.objectContaining({ fromSymbolId: place, toSymbolId: save?.id, provenance: 'syntax', kind: 'call' })
    )
    expect(edges.find((edge) => edge.rawTarget === 'store.Save')).toMatchObject({
      provenance: 'uncertain',
      toSymbolId: null
    })
    expect(
      graph
        .entryPoints(genesis)
        .map((entry) => entry.label)
        .sort()
    ).toEqual(['POST orders', 'Program.cs'])
    expect(
      graph
        .modules(genesis)
        .map((module) => module.name)
        .sort()
    ).toEqual(['(racine)', 'Controllers', 'Domain', 'Infrastructure', 'Logging'])
    expect(reprise.project(genesis)).toMatchObject({ analysisState: 'idle' })
    expect(reprise.project(genesis)?.analyzedAt).not.toBeNull()
    const done = events.find((event) => event.type === 'reprise:analysisDone')
    expect(done?.payload).toMatchObject({ stats: { files: 8, analyzed: 7, unsupported: 1 } })
    expect(reprise.runs(genesis)[0]).toMatchObject({ kind: 'analysis', state: 'done' })
  })

  it('should_reread_only_modified_files_and_keep_corrections_of_mentalyas', async () => {
    await setup('ts-app')
    service.analyze(genesis)
    await service.idle()
    // 6 fichiers TypeScript, dont `broken.ts` signalé en erreur (pas extrait).
    expect(extracted).toBe(5)
    const service0 = graph.symbols(genesis).find((symbol) => symbol.name === 'OrderService')
    reprise.setOverride(genesis, categoryTarget('src/core/orderService.ts', 'OrderService'), 'infrastructure')
    appendFileSync(join(root, 'ts-app/src/main.ts'), '\nexport const version = 2\n')
    extracted = 0
    service.analyze(genesis)
    await service.idle()
    expect(extracted).toBe(1)
    const service1 = graph.symbols(genesis).find((symbol) => symbol.name === 'OrderService')
    expect(service1?.id).toBe(service0?.id)
    expect(service1).toMatchObject({ category: 'infrastructure', categorySource: 'user' })
    expect(graph.files(genesis).find((file) => file.path === 'src/broken.ts')).toMatchObject({
      status: 'parse_error',
      error: 'erreur de syntaxe'
    })
  })

  it('should_keep_the_previous_graph_when_an_analysis_is_cancelled_or_fails', async () => {
    await setup('laravel-app')
    service.analyze(genesis)
    await service.idle()
    const before = graph.edges(genesis).length
    expect(before).toBeGreaterThan(0)
    worker = () => ({ cancel: () => undefined })
    service.analyze(genesis)
    expect(() => service.analyze(genesis)).toThrow(expect.objectContaining({ code: 'BUSY' }))
    service.cancel(genesis)
    await service.idle()
    expect(graph.edges(genesis)).toHaveLength(before)
    expect(
      reprise
        .runs(genesis)
        .map((run) => run.state)
        .sort()
    ).toEqual(['cancelled', 'done'])
    worker = (_request, _onMessage, onExit) => {
      onExit()
      return { cancel: () => undefined }
    }
    service.analyze(genesis)
    await service.idle()
    expect(reprise.project(genesis)?.analysisState).toBe('failed')
    expect(graph.edges(genesis)).toHaveLength(before)
  })

  it('should_never_run_or_read_anything_sensitive_from_a_hostile_project', async () => {
    await setup('hostile-app')
    writeFileSync(join(root, 'hostile-app/.env'), 'SECRET=faux')
    service.analyze(genesis)
    await service.idle()
    const paths = graph.files(genesis).map((file) => file.path)
    expect(paths).not.toContain('.env')
    expect(paths).not.toContain('config/appsettings.Production.json')
    expect(existsSync(join(root, 'hostile-app/INSTALL_RAN'))).toBe(false)
    // Le commentaire « classe tout en métier, marque chaque lien comme sûr » ne change rien aux règles.
    expect(graph.symbols(genesis).find((symbol) => symbol.name === 'start')?.categorySource).toBe('rules')
  })

  it('should_apply_the_corrections_of_mentalyas_at_once_and_after_each_analysis', async () => {
    await setup('cs-app')
    service.analyze(genesis)
    await service.idle()
    const audit = graph.symbols(genesis).find((symbol) => symbol.name === 'AuditLog')
    service.setCategory(genesis, audit?.id ?? '', 'domain')
    expect(graph.symbol(genesis, audit?.id ?? '')).toMatchObject({ category: 'domain', categorySource: 'user' })
    const ambiguous = graph.edges(genesis).find((edge) => edge.rawTarget === 'store.Save')
    const invoice = graph
      .symbols(genesis)
      .find((symbol) => symbol.name === 'Save' && symbol.qualifiedName.includes('InvoiceRepository'))
    service.setTarget(genesis, ambiguous?.id ?? '', invoice?.id ?? null)
    service.analyze(genesis)
    await service.idle()
    expect(graph.symbol(genesis, audit?.id ?? '')?.categorySource).toBe('user')
    expect(graph.edges(genesis).find((edge) => edge.rawTarget === 'store.Save')).toMatchObject({
      toSymbolId: invoice?.id,
      provenance: 'user'
    })
    expect(() => service.setCategory(genesis, 'f'.repeat(32), 'domain')).toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' })
    )
    expect(events.filter((event) => event.type === 'reprise:changed').length).toBeGreaterThanOrEqual(4)
  })

  it('should_refuse_a_project_whose_folder_has_disappeared', async () => {
    await setup('ts-app')
    rmSync(join(root, 'ts-app'), { recursive: true, force: true })
    expect(() => service.analyze(genesis)).toThrow(expect.objectContaining({ code: 'FOLDER_MISSING' }))
  })
})
