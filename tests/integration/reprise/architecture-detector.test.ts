import { cpSync, mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { loadEngine, type Engine } from '../../../src/analysis-worker/engine'
import { processBatch } from '../../../src/analysis-worker/process'
import { AnalysisService } from '../../../src/main/application/reprise/AnalysisService'
import { ExplorerService } from '../../../src/main/application/reprise/ExplorerService'
import { CodeGraphRepository } from '../../../src/main/infrastructure/db/repositories/CodeGraphRepository'
import { RepriseRepository } from '../../../src/main/infrastructure/db/repositories/RepriseRepository'
import { scanProject } from '../../../src/main/infrastructure/reprise/ProjectScanner'
import { detectArchitecture, type DetectedArchitecture } from '../../../src/shared/structure/detect'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'
import { GRAMMARS_DIR, REPRISE_FIXTURES } from '../../support/reprise'

/** SC-005 de la spec 032 : le détecteur lit la carte de l'explorateur des projets de démonstration de la spec 017. */
describe('détecteur d’architecture sur les projets de démonstration (spec 032 SC-005)', () => {
  let engine: Engine
  let t: NeuronHarness
  let root: string

  beforeAll(async () => {
    engine = await loadEngine(GRAMMARS_DIR)
  })
  beforeEach(() => {
    t = createNeuronHarness()
    root = realpathSync(mkdtempSync(join(tmpdir(), 'gi-detect-')))
  })
  afterEach(() => {
    t.dispose()
    rmSync(root, { recursive: true, force: true })
  })

  async function detectFixture(project: string): Promise<DetectedArchitecture> {
    const reprise = new RepriseRepository(t.handle.db)
    const graph = new CodeGraphRepository(t.handle.db)
    const explorer = new ExplorerService({ reprise, graph })
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
    cpSync(join(REPRISE_FIXTURES, project), join(root, project), { recursive: true })
    const genesis = (await t.neurons.create({ text: project })).id
    reprise.createProject({
      genesisId: genesis,
      rootDir: join(root, project),
      source: 'folder',
      remoteUrl: null,
      confidentiality: 'claude',
      confidentialityChangedAt: '2026-10-14T08:00:00.000Z'
    })
    analysis.analyze(genesis)
    await analysis.idle()
    const map = explorer.map(genesis)
    const path = (key: string): string => key.replace(/^f:/, '')
    return detectArchitecture({
      paths: map.files.map((file) => file.path),
      calls: map.calls.map((call) => ({ from: path(call.from), to: path(call.to) }))
    })
  }

  it('should_give_each_demo_project_its_architecture_and_a_reason_in_words', async () => {
    const results = {
      'cs-app': await detectFixture('cs-app'),
      'ts-app': await detectFixture('ts-app'),
      'laravel-app': await detectFixture('laravel-app'),
      'hostile-app': await detectFixture('hostile-app')
    }
    // Le domaine qui appelle l'infrastructure (dépôt instancié, implémentation injectée) est compté : c'est vrai du code.
    expect(results).toEqual({
      'cs-app': {
        kind: 'clean',
        reason: 'Dossiers « Domain » et « Infrastructure » ; 2 appels sortent du cœur vers l’extérieur.',
        violations: 2
      },
      'ts-app': {
        kind: 'clean',
        reason: 'Dossiers « core » et « infra » ; 1 appel sort du cœur vers l’extérieur.',
        violations: 1
      },
      'laravel-app': {
        kind: 'mvc',
        reason: 'Dossiers « Controllers » et « Models » ; les appels vont vers le cœur.',
        violations: 0
      },
      'hostile-app': {
        kind: 'aucune',
        reason: 'Aucun dossier ne nomme de couche connue (domaine, contrôleurs, ports…).',
        violations: 0
      }
    })
  })
})
