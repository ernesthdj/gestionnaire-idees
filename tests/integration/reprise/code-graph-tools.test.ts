import { cpSync, mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { loadEngine, type Engine } from '../../../src/analysis-worker/engine'
import { processBatch } from '../../../src/analysis-worker/process'
import { AnalysisService } from '../../../src/main/application/reprise/AnalysisService'
import { CodeGraphTools } from '../../../src/main/application/reprise/CodeGraphTools'
import { ConfidentialityGuard } from '../../../src/main/application/reprise/ConfidentialityGuard'
import { ExplorerService } from '../../../src/main/application/reprise/ExplorerService'
import { CodeGraphRepository } from '../../../src/main/infrastructure/db/repositories/CodeGraphRepository'
import { ConversationRepository } from '../../../src/main/infrastructure/db/repositories/ConversationRepository'
import { RepriseRepository } from '../../../src/main/infrastructure/db/repositories/RepriseRepository'
import { scanProject } from '../../../src/main/infrastructure/reprise/ProjectScanner'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'
import { GRAMMARS_DIR, REPRISE_FIXTURES } from '../../support/reprise'

describe('outil du pont code_graphe_lire (spec 017 US7, FR-034)', () => {
  let engine: Engine
  let t: NeuronHarness
  let root: string
  let reprise: RepriseRepository
  let genesis: string
  let tools: CodeGraphTools
  let guard: ConfidentialityGuard

  beforeAll(async () => {
    engine = await loadEngine(GRAMMARS_DIR)
  })
  beforeEach(async () => {
    t = createNeuronHarness()
    reprise = new RepriseRepository(t.handle.db)
    const graph = new CodeGraphRepository(t.handle.db)
    const conversations = new ConversationRepository(t.handle.db)
    const explorer = new ExplorerService({ reprise, graph })
    root = realpathSync(mkdtempSync(join(tmpdir(), 'gi-code-graph-')))
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
    tools = new CodeGraphTools({
      genesisOf: (neuronId) => {
        const neuron = conversations.neuron(neuronId)
        return neuron === undefined ? undefined : (neuron.genesisId ?? neuron.rootId)
      },
      project: (genesisId) => reprise.project(genesisId),
      graph,
      fileCalls: (genesisId) => explorer.fileCalls(genesisId)
    })
    guard = new ConfidentialityGuard({
      neuron: (id) => conversations.neuron(id),
      project: (genesisId) => reprise.project(genesisId)
    })
    const analysis = new AnalysisService({
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
    analysis.analyze(genesis)
    await analysis.idle()
  })
  afterEach(() => {
    t.dispose()
    rmSync(root, { recursive: true, force: true })
  })

  it('should_give_claude_the_modules_and_the_sure_calls_between_files_of_its_project', () => {
    const { text } = tools.read(undefined, { neuronId: genesis })
    expect(text).toContain('Graphe mesuré du projet « cs-app »')
    expect(text).toMatch(/Modules \(\d+\)/)
    expect(text).toMatch(/Controllers\/OrdersController\.cs → Domain\/OrderService\.cs : \d+/)
    expect(text).not.toContain(root)
  })

  it('should_refuse_another_project_than_the_conversation_or_a_project_never_analyzed', async () => {
    const other = (await t.neurons.create({ text: 'autre' })).id
    expect(() => tools.read(other, { neuronId: genesis })).toThrow(expect.objectContaining({ code: 'NON_MODIFIABLE' }))
    expect(() => tools.read(other, { neuronId: null })).toThrow(expect.objectContaining({ code: 'INTROUVABLE' }))
    expect(() => tools.read(undefined, { neuronId: null })).toThrow(
      expect.objectContaining({ code: 'ENTREE_INVALIDE' })
    )
  })

  it('should_be_refused_by_the_guard_for_a_local_only_project_even_from_an_external_session', () => {
    reprise.setConfidentiality(genesis, 'local', '2026-10-07T09:00:00.000Z')
    const handle = guard.guardTools((_tool, args, caller) => tools.read((args as { projet?: string }).projet, caller))
    expect(() => handle('code_graphe_lire', {}, { neuronId: genesis })).toThrow(
      expect.objectContaining({ code: 'NON_MODIFIABLE' })
    )
    expect(() => handle('code_graphe_lire', { projet: genesis }, { neuronId: null })).toThrow(
      expect.objectContaining({ code: 'NON_MODIFIABLE' })
    )
  })
})
