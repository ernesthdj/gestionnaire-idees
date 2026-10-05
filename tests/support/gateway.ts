import { AIGateway, type GatewayDependencies } from '../../src/main/application/ai/AIGateway'
import type { CallRecord } from '../../src/main/application/ai/ports'
import { FakeProvider } from './FakeProvider'

export interface GatewayHarness {
  readonly gateway: AIGateway
  readonly ollama: FakeProvider
  readonly claude: FakeProvider
  readonly calls: CallRecord[]
  readonly queued: string[]
}

/** Passerelle IA câblée sur des doubles de test ; chaque dépendance est remplaçable. */
export function createGatewayHarness(overrides: Partial<GatewayDependencies> = {}): GatewayHarness {
  const ollama = new FakeProvider('ollama')
  const claude = new FakeProvider('claude')
  const calls: CallRecord[] = []
  const queued: string[] = []
  const gateway = new AIGateway({
    providers: { ollama, claude },
    config: () => ({ allowClaudeFallback: false }),
    context: async () => undefined,
    callLog: { record: async (call) => void calls.push(call) },
    localQueue: { enqueue: async (request) => void queued.push(request.requestId) },
    ...overrides
  })
  return { gateway, ollama, claude, calls, queued }
}
