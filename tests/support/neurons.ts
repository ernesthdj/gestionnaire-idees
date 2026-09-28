import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { GrowthService, type GrowthEvent } from '../../src/main/application/neurons/GrowthService'
import { NeuronService } from '../../src/main/application/neurons/NeuronService'
import { openDatabase, type DatabaseHandle } from '../../src/main/infrastructure/db/client'
import { GrowthRepository } from '../../src/main/infrastructure/db/repositories/GrowthRepository'
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
      assessment: { level, covered: ['quoi'], missing: level === 'insufficient' ? ['budget'] : [] },
      ...extra
    }
  }
}

export interface NeuronHarness {
  readonly h: GatewayHarness
  readonly neurons: NeuronService
  readonly growth: GrowthService
  readonly events: GrowthEvent[]
  /** Nombre d'appels Claude déjà faits au moment de chaque événement (même index que `events`). */
  readonly claudeCallsAtEvent: number[]
  readonly handle: DatabaseHandle
  /** Rouvre les services sur la même base (simulation d'un redémarrage). */
  reopen(): { neurons: NeuronService; growth: GrowthService }
  dispose(): void
}

export function createNeuronHarness(): NeuronHarness {
  const dir = mkdtempSync(join(tmpdir(), 'gi-growth-'))
  const file = join(dir, 'g.db')
  const key = '5'.repeat(64)
  let handle = openDatabase({ file, key, migrationsFolder: MIGRATIONS })
  const h = createGatewayHarness()
  h.ollama.setAvailable(false) // catégorisation hors sujet ici : l'IA locale reste arrêtée
  const events: GrowthEvent[] = []
  const claudeCallsAtEvent: number[] = []

  const build = (db: DatabaseHandle) => {
    const neuronRepository = new NeuronRepository(db.db)
    const neurons = new NeuronService({ repository: neuronRepository, gateway: h.gateway })
    const growth = new GrowthService({
      repository: new GrowthRepository(db.db),
      neurons,
      gateway: h.gateway,
      emit: (event) => {
        events.push(event)
        claudeCallsAtEvent.push(h.claude.requests.length)
      }
    })
    return { neurons, growth }
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
