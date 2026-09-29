import { AIGateway, type GatewayDependencies } from '../../src/main/application/ai/AIGateway'
import type { CallRecord } from '../../src/main/application/ai/ports'
import { DEFAULT_ROUTING, type RoutingTable } from '../../src/main/domain/ai/routing'
import { FakeProvider } from './FakeProvider'

export interface GatewayHarness {
  readonly gateway: AIGateway
  readonly ollama: FakeProvider
  readonly claude: FakeProvider
  readonly calls: CallRecord[]
  readonly queued: string[]
  readonly anonymized: string[]
}

/**
 * Routage des tests du moteur : les tâches qui partent en local par défaut (T069) sont ici envoyées au faux Claude,
 * dont les réponses sont scénarisées. Le routage réel est testé à part (`routing.test.ts`).
 */
export const TEST_ROUTING: RoutingTable = {
  ...DEFAULT_ROUTING,
  etendre: 'claude',
  germer: 'claude',
  suggerer_liens: 'claude'
}

/** Passerelle IA câblée sur des doubles de test ; chaque dépendance est remplaçable. */
export function createGatewayHarness(overrides: Partial<GatewayDependencies> = {}): GatewayHarness {
  const ollama = new FakeProvider('ollama')
  const claude = new FakeProvider('claude')
  const calls: CallRecord[] = []
  const queued: string[] = []
  const anonymized: string[] = []
  const gateway = new AIGateway({
    providers: { ollama, claude },
    config: () => ({ routing: TEST_ROUTING, allowClaudeFallback: false }),
    context: async () => undefined,
    anonymizer: {
      anonymize: async (text) => {
        anonymized.push(text)
        return `[anonymisé] ${text.length} caractères`
      }
    },
    budget: { check: async () => ({ allowed: true }), record: async () => undefined },
    costOf: () => 0,
    callLog: { record: async (call) => void calls.push(call) },
    localQueue: { enqueue: async (request) => void queued.push(request.requestId) },
    ...overrides
  })
  return { gateway, ollama, claude, calls, queued, anonymized }
}
