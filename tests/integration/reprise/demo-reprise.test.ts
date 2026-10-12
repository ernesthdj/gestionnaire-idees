import { mkdtempSync, readdirSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { loadEngine, type Engine } from '../../../src/analysis-worker/engine'
import { processBatch } from '../../../src/analysis-worker/process'
import { AnalysisService } from '../../../src/main/application/reprise/AnalysisService'
import {
  DEMO_REPRISE_FOLDER,
  seedDemoReprise,
  writeDemoRepriseFolder
} from '../../../src/main/infrastructure/db/demo/demoReprise'
import { CodeGraphRepository } from '../../../src/main/infrastructure/db/repositories/CodeGraphRepository'
import { ConversationRepository } from '../../../src/main/infrastructure/db/repositories/ConversationRepository'
import { RepriseRepository } from '../../../src/main/infrastructure/db/repositories/RepriseRepository'
import { scanProject } from '../../../src/main/infrastructure/reprise/ProjectScanner'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'
import { GRAMMARS_DIR } from '../../support/reprise'

describe('projet repris de la démo (spec 017 T037)', () => {
  let engine: Engine
  let t: NeuronHarness
  let root: string

  beforeAll(async () => {
    engine = await loadEngine(GRAMMARS_DIR)
  })
  beforeEach(() => {
    t = createNeuronHarness()
    root = realpathSync(mkdtempSync(join(tmpdir(), 'gi-demo-reprise-')))
  })
  afterEach(() => {
    t.dispose()
    rmSync(root, { recursive: true, force: true })
  })

  it('should_seed_a_local_only_project_once_linked_to_its_folder', () => {
    const dir = writeDemoRepriseFolder(join(root, DEMO_REPRISE_FOLDER))
    expect(readdirSync(dir).sort()).toEqual(['README.md', 'billing', 'package.json', 'src', 'tsconfig.json'])
    const first = seedDemoReprise(t.handle.db, dir)
    expect(first.seeded).toBe(true)
    expect(seedDemoReprise(t.handle.db, dir)).toEqual({ genesisId: first.genesisId, seeded: false })
    expect(new RepriseRepository(t.handle.db).project(first.genesisId)).toMatchObject({
      rootDir: dir,
      confidentiality: 'local',
      source: 'folder'
    })
    expect(new ConversationRepository(t.handle.db).neuron(first.genesisId)).toMatchObject({
      kind: 'root',
      projectDir: dir
    })
  })

  it('should_analyse_into_sure_links_and_one_ambiguous_save_to_show_in_the_explorer', async () => {
    const dir = writeDemoRepriseFolder(join(root, DEMO_REPRISE_FOLDER))
    const { genesisId } = seedDemoReprise(t.handle.db, dir)
    const reprise = new RepriseRepository(t.handle.db)
    const graph = new CodeGraphRepository(t.handle.db)
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
    analysis.analyze(genesisId)
    await analysis.idle()
    const symbols = new Map(graph.symbols(genesisId).map((symbol) => [symbol.id, symbol.qualifiedName] as const))
    const edges = graph.edges(genesisId)
    const sure = edges
      .filter((edge) => edge.provenance === 'syntax' && edge.kind === 'call')
      .map((edge) => `${symbols.get(edge.fromSymbolId)} → ${symbols.get(edge.toSymbolId ?? '')}`)
    expect(sure).toEqual(
      expect.arrayContaining([
        'OrderController.post → OrderService.place',
        'OrderService.place → calculateDiscount',
        'OrderService.place → OrderRepository.save'
      ])
    )
    const ambiguous = edges.find((edge) => edge.rawTarget === 'archive.Save')
    expect(ambiguous).toMatchObject({ provenance: 'uncertain', toSymbolId: null })
    expect(graph.modules(genesisId).length).toBeGreaterThanOrEqual(2)
    expect(reprise.project(genesisId)?.analyzedAt).not.toBeNull()
  })
})
