import { randomUUID } from 'node:crypto'
import { cpSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { loadEngine, type Engine } from '../../../src/analysis-worker/engine'
import { processBatch } from '../../../src/analysis-worker/process'
import { AnalysisService } from '../../../src/main/application/reprise/AnalysisService'
import { ElementFilesService } from '../../../src/main/application/reprise/ElementFilesService'
import { CodeGraphRepository } from '../../../src/main/infrastructure/db/repositories/CodeGraphRepository'
import { ConversationRepository } from '../../../src/main/infrastructure/db/repositories/ConversationRepository'
import { ElementRepository } from '../../../src/main/infrastructure/db/repositories/ElementRepository'
import { RepriseRepository } from '../../../src/main/infrastructure/db/repositories/RepriseRepository'
import { scanProject } from '../../../src/main/infrastructure/reprise/ProjectScanner'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'
import { GRAMMARS_DIR, REPRISE_FIXTURES } from '../../support/reprise'

describe('fichiers d’un élément de carte (spec 017 US7, FR-032)', () => {
  let engine: Engine
  let t: NeuronHarness
  let root: string
  let project: string
  let genesis: string
  let element: string
  let graph: CodeGraphRepository
  let reprise: RepriseRepository
  let conversations: ConversationRepository
  let elements: ElementRepository
  let service: ElementFilesService

  const addElement = (paths: readonly string[]): string => {
    const id = randomUUID()
    elements.insert({
      id,
      genesisId: genesis,
      parentId: genesis,
      depth: 0,
      key: `module:${id}`,
      type: 'module',
      title: 'Cœur',
      content: null,
      status: null,
      paths,
      rank: null,
      layer: null,
      layerSource: null
    })
    return id
  }

  beforeAll(async () => {
    engine = await loadEngine(GRAMMARS_DIR)
  })
  beforeEach(async () => {
    t = createNeuronHarness()
    root = realpathSync(mkdtempSync(join(tmpdir(), 'gi-element-files-')))
    project = join(root, 'ts-app')
    cpSync(join(REPRISE_FIXTURES, 'ts-app'), project, { recursive: true })
    writeFileSync(join(project, '.env'), 'FAUX=1')
    writeFileSync(join(root, 'dehors.ts'), 'export const x = 1')
    graph = new CodeGraphRepository(t.handle.db)
    reprise = new RepriseRepository(t.handle.db)
    conversations = new ConversationRepository(t.handle.db)
    elements = new ElementRepository(t.handle.db)
    genesis = (await t.neurons.create({ text: 'ts-app' })).id
    conversations.setProjectDir(genesis, project, randomUUID())
    element = addElement(['src/core', './src/main.ts', '.env', '../dehors.ts'])
    service = new ElementFilesService({
      neuron: (id) => conversations.neuron(id),
      graph,
      scan: (folder) => scanProject(folder)
    })
  })
  afterEach(() => {
    t.dispose()
    rmSync(root, { recursive: true, force: true })
  })

  it('should_list_the_files_under_the_element_paths_when_the_project_is_not_analyzed', () => {
    const view = service.files(element)
    expect(view).toMatchObject({ elementId: element, title: 'Cœur', analyzed: false, truncated: false })
    expect(view.files.map((file) => file.path)).toEqual(['src/core/orderService.ts', 'src/main.ts'])
    expect(service.file(element, 'src/core/orderService.ts')).toMatchObject({ lang: 'ts', symbols: [] })
  })

  it('should_give_the_symbols_and_their_callers_when_the_project_is_analyzed', async () => {
    reprise.createProject({
      genesisId: genesis,
      rootDir: project,
      source: 'folder',
      remoteUrl: null,
      confidentiality: 'claude',
      confidentialityChangedAt: '2026-10-07T08:00:00.000Z'
    })
    const analysis = new AnalysisService({
      reprise,
      graph,
      scan: (folder) => scanProject(folder),
      runWorker: (request, onMessage) => {
        void processBatch(engine, request, (message) => onMessage(JSON.parse(JSON.stringify(message))))
        return { cancel: () => undefined }
      },
      emit: () => undefined
    })
    analysis.analyze(genesis)
    await analysis.idle()
    expect(service.files(element)).toMatchObject({ analyzed: true })
    const file = service.file(element, 'src/core/orderService.ts')
    expect(file.lines[0]).toContain('OrderRepository')
    expect(file.symbols.map((symbol) => symbol.name)).toEqual(
      expect.arrayContaining(['calculateDiscount', 'OrderService', 'place'])
    )
    expect(file.symbols.find((symbol) => symbol.name === 'place')?.callers).toBeGreaterThan(0)
  })

  it.each([
    ['src/api/orderController.ts', 'NOT_FOUND'],
    ['.env', 'SECRET_FILE'],
    ['../dehors.ts', 'NOT_FOUND'],
    ['src/core/absent.ts', 'NOT_FOUND']
  ])('should_refuse_to_read_%s', (path, code) => {
    expect(() => service.file(element, path)).toThrow(expect.objectContaining({ code }))
  })

  it('should_refuse_an_archived_element_or_a_map_without_folder', () => {
    elements.archive(element)
    expect(() => service.files(element)).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }))
    const other = addElement(['src'])
    conversations.setProjectDir(genesis, null, randomUUID())
    expect(() => service.files(other)).toThrow(expect.objectContaining({ code: 'FOLDER_MISSING' }))
  })
})
