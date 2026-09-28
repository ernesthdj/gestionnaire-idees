import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { ExampleStore } from '../../src/main/application/ai/ExampleStore'
import { FusionService, type FusionEvent } from '../../src/main/application/neurons/FusionService'
import { GrowthService } from '../../src/main/application/neurons/GrowthService'
import { LinkService, type LinkEvent } from '../../src/main/application/neurons/LinkService'
import { NeuronService } from '../../src/main/application/neurons/NeuronService'
import { SynthesisApplier } from '../../src/main/application/neurons/SynthesisApplier'
import { openDatabase, type DatabaseHandle } from '../../src/main/infrastructure/db/client'
import { ContextRepository } from '../../src/main/infrastructure/db/repositories/ContextRepository'
import { FusionRepository } from '../../src/main/infrastructure/db/repositories/FusionRepository'
import { GrowthRepository } from '../../src/main/infrastructure/db/repositories/GrowthRepository'
import { LinkRepository } from '../../src/main/infrastructure/db/repositories/LinkRepository'
import { NeuronRepository } from '../../src/main/infrastructure/db/repositories/NeuronRepository'
import { createGatewayHarness, type GatewayHarness } from './gateway'

const MIGRATIONS = resolve(import.meta.dirname, '../../src/main/infrastructure/db/migrations')

/** Réponse `etendre` scriptée (questions fictives) pour le FakeProvider Claude. */
export function etendreReply(
  questions: readonly string[],
  level: 'insufficient' | 'sufficient' | 'complete' = 'insufficient',
  extra: Record<string, unknown> = {}
) {
  return {
    raw: {
      kind: 'extensions',
      extensions: questions.map((question) => ({
        question,
        quickReplies: ['Oui', 'Non'],
        dimension: question.slice(0, 20)
      })),
      suggestions: [],
      assessment: { level, covered: ['quoi'], missing: level === 'insufficient' ? ['budget'] : [] },
      ...extra
    }
  }
}

interface Services {
  readonly neurons: NeuronService
  readonly growth: GrowthService
  readonly fusion: FusionService
  readonly fusionRepository: FusionRepository
  readonly examples: ExampleStore
  readonly links: LinkService
}

export interface NeuronHarness {
  readonly h: GatewayHarness
  readonly neurons: NeuronService
  readonly growth: GrowthService
  readonly fusion: FusionService
  readonly fusionRepository: FusionRepository
  readonly examples: ExampleStore
  readonly links: LinkService
  readonly events: (FusionEvent | LinkEvent)[]
  /** Nombre d'appels Claude déjà faits au moment de chaque événement (même index que `events`). */
  readonly claudeCallsAtEvent: number[]
  readonly handle: DatabaseHandle
  /** Rouvre les services sur la même base (simulation d'un redémarrage). */
  reopen(): Services
  dispose(): void
}

export function createNeuronHarness(): NeuronHarness {
  const dir = mkdtempSync(join(tmpdir(), 'gi-growth-'))
  const file = join(dir, 'g.db')
  const key = '5'.repeat(64)
  let handle = openDatabase({ file, key, migrationsFolder: MIGRATIONS })
  const h = createGatewayHarness()
  h.ollama.setAvailable(false) // catégorisation hors sujet ici : l'IA locale reste arrêtée
  const events: (FusionEvent | LinkEvent)[] = []
  const claudeCallsAtEvent: number[] = []

  const build = (db: DatabaseHandle): Services => {
    const emit = (event: FusionEvent | LinkEvent): void => {
      events.push(event)
      claudeCallsAtEvent.push(h.claude.requests.length)
    }
    const neuronRepository = new NeuronRepository(db.db)
    const neurons = new NeuronService({ repository: neuronRepository, gateway: h.gateway })
    const tree = new GrowthRepository(db.db)
    const growth = new GrowthService({ repository: tree, neurons, gateway: h.gateway, emit })
    const fusionRepository = new FusionRepository(db.db)
    const examples = new ExampleStore(new ContextRepository(db.db))
    const applier = new SynthesisApplier({
      repository: fusionRepository,
      tree,
      neurons,
      examples,
      onStale: (row) => emit({ type: 'synthesis:stale', rootId: row.rootId, synthesisId: row.id })
    })
    const links = new LinkService({ repository: new LinkRepository(db.db), gateway: h.gateway, examples, emit })
    const fusion = new FusionService({
      repository: fusionRepository,
      tree,
      neurons,
      gateway: h.gateway,
      applier,
      links,
      emit
    })
    return { neurons, growth, fusion, fusionRepository, examples, links }
  }

  const services = build(handle)
  return {
    h,
    ...services,
    events,
    claudeCallsAtEvent,
    get handle() {
      return handle
    },
    reopen: () => {
      handle.close()
      handle = openDatabase({ file, key, migrationsFolder: MIGRATIONS })
      return build(handle)
    },
    dispose: () => {
      handle.close()
      rmSync(dir, { recursive: true, force: true })
    }
  }
}
