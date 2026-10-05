import type { ProviderStatus } from '../../src/main/application/ai/AIProvider'
import { AiConfigSchema, type AiConfig } from '../../src/main/infrastructure/db/repositories/AiConfigRepository'
import type { SafeStorageLike } from '../../src/main/infrastructure/secrets/SecretStore'
import { createAiRoutes, type AiRoutesDependencies } from '../../src/main/ipc/aiHandlers'
import { createDispatcher } from '../../src/main/ipc/registry'

export const fakeSafeStorage: SafeStorageLike = {
  isEncryptionAvailable: () => true,
  encryptString: (plain) => Buffer.concat([Buffer.from('ENC:'), Buffer.from(plain, 'utf8').reverse()]),
  decryptString: (data) => Buffer.from(data.subarray(4)).reverse().toString('utf8')
}

/** Canaux `ai:*` câblés sur des doubles (spec 010) : état d'Ollama et de Claude Code, configuration en mémoire. */
export function createAiRoutesHarness(overrides: Partial<AiRoutesDependencies> = {}) {
  let config: AiConfig = AiConfigSchema.parse({})
  let ollamaStatus: ProviderStatus = { up: true, model: 'qwen3.5:9b' }
  let claudeStatus: ProviderStatus = { up: true, model: 'claude-opus-5-5' }
  const deps: AiRoutesDependencies = {
    config: {
      get: () => config,
      update: (patch) => {
        config = AiConfigSchema.parse({ ...config, ...patch })
        return config
      }
    },
    ollamaStatus: async () => ollamaStatus,
    claudeStatus: async () => claudeStatus,
    ...overrides
  }
  const dispatch = createDispatcher(createAiRoutes(deps))
  return {
    dispatch,
    setOllama: (status: ProviderStatus) => (ollamaStatus = status),
    setClaude: (status: ProviderStatus) => (claudeStatus = status),
    config: () => config
  }
}
