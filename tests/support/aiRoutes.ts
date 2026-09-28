import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ProviderStatus } from '../../src/main/application/ai/AIProvider'
import { AiConfigSchema, type AiConfig } from '../../src/main/infrastructure/db/repositories/AiConfigRepository'
import { SecretStore, type SafeStorageLike } from '../../src/main/infrastructure/secrets/SecretStore'
import { createAiRoutes, type AiRoutesDependencies } from '../../src/main/ipc/aiHandlers'
import { createDispatcher } from '../../src/main/ipc/registry'

export const fakeSafeStorage: SafeStorageLike = {
  isEncryptionAvailable: () => true,
  encryptString: (plain) => Buffer.concat([Buffer.from('ENC:'), Buffer.from(plain, 'utf8').reverse()]),
  decryptString: (data) => Buffer.from(data.subarray(4)).reverse().toString('utf8')
}

export function createAiRoutesHarness(overrides: Partial<AiRoutesDependencies> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'gi-ai-routes-'))
  let config: AiConfig = AiConfigSchema.parse({})
  let ollamaStatus: ProviderStatus = { up: true, model: 'qwen3.5:9b' }
  let claudePing: () => Promise<void> = async () => undefined
  let spent = 0
  const secrets = new SecretStore(join(dir, 'secrets'), fakeSafeStorage)
  const deps: AiRoutesDependencies = {
    config: {
      get: () => config,
      update: (patch) => {
        config = AiConfigSchema.parse({ ...config, ...patch })
        return config
      }
    },
    secrets,
    ollamaStatus: async () => ollamaStatus,
    claudePing: () => claudePing(),
    spentMillicentsThisMonth: () => spent,
    now: () => new Date(2026, 8, 28),
    ...overrides
  }
  const dispatch = createDispatcher(createAiRoutes(deps))
  return {
    dir,
    dispatch,
    secrets,
    setOllama: (status: ProviderStatus) => (ollamaStatus = status),
    setClaudePing: (ping: () => Promise<void>) => (claudePing = ping),
    setSpent: (value: number) => (spent = value),
    config: () => config
  }
}
