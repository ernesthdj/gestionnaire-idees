import { AIGateway } from '../application/ai/AIGateway'
import { Anonymizer, sensitiveDetectorFrom } from '../application/ai/Anonymizer'
import { BudgetGuard } from '../application/ai/BudgetGuard'
import { LocalQueue } from '../application/ai/LocalQueue'
import type { Anonymizer as AnonymizerPort } from '../application/ai/ports'
import { costMillicents, estimateMaxMillicents, pricingFor, startOfMonth } from '../domain/ai/cost'
import { maxTokensFor, type RoutingTable } from '../domain/ai/routing'
import { ClaudeProvider } from '../infrastructure/ai/ClaudeProvider'
import { OllamaProvider } from '../infrastructure/ai/OllamaProvider'
import type { AppDatabase } from '../infrastructure/db/client'
import { AiCallRepository } from '../infrastructure/db/repositories/AiCallRepository'
import { AiConfigRepository } from '../infrastructure/db/repositories/AiConfigRepository'
import { PendingRequestRepository } from '../infrastructure/db/repositories/PendingRequestRepository'
import type { Logger } from '../infrastructure/logging/logger'
import type { SecretStore } from '../infrastructure/secrets/SecretStore'
import { CategoryOut, SensitiveOut } from '@shared/ai/schemas'

/** Estimation prudente de la taille d'entrée d'un appel (cadre + profil + données), avant envoi. */
const ESTIMATED_INPUT_TOKENS = 8000
const LOCAL_QUEUE_PROBE_MS = 30_000
export const CLAUDE_SECRET = 'claude'

export interface AiEngine {
  readonly gateway: AIGateway
  readonly config: AiConfigRepository
  readonly localQueue: LocalQueue
  stop(): void
}

export interface AiEngineOptions {
  readonly db: AppDatabase
  readonly secrets: SecretStore
  readonly logger: Logger
  readonly ollamaUrl: string
  readonly onBudgetAlert: (spentCents: number, capCents: number) => void
  readonly onQueuedCompleted: (requestId: string) => void
}

/** Racine de composition du moteur IA : relie passerelle, moteurs, anonymisation, budget et file locale. */
export function createAiEngine(options: AiEngineOptions): AiEngine {
  const config = new AiConfigRepository(options.db)
  const calls = new AiCallRepository(options.db)

  const ollama = new OllamaProvider({ baseUrl: options.ollamaUrl, model: () => config.get().localModel })
  const claude = new ClaudeProvider({
    apiKey: () => options.secrets.get(CLAUDE_SECRET),
    model: () => config.get().claudeModel
  })

  const budget = new BudgetGuard({
    spentMillicentsThisMonth: async () => calls.claudeSpentSince(startOfMonth(new Date())),
    settings: async () => config.get(),
    estimateMillicents: (kind, rate) => {
      const model = config.get().claudeModel
      return estimateMaxMillicents(
        { inputTokens: ESTIMATED_INPUT_TOKENS, maxOutputTokens: maxTokensFor(kind) },
        pricingFor(model, model),
        rate
      )
    },
    now: () => new Date(),
    onAlert: (spentCents, capCents) => {
      options.logger.warn('ai.budget_alert', { count: spentCents })
      options.onBudgetAlert(spentCents, capCents)
    }
  })

  // L'anonymiseur a besoin de la passerelle (détection locale des noms) : référence résolue après construction.
  const anonymizerRef: { current?: AnonymizerPort } = {}
  const localQueueRef: { current?: LocalQueue } = {}

  const gateway = new AIGateway({
    providers: { ollama, claude },
    config: () => {
      const current = config.get()
      return { routing: current.routing as RoutingTable, allowClaudeFallback: current.allowClaudeFallback }
    },
    context: async () => undefined, // Profil, règles et exemples : US5 (import de contexte).
    anonymizer: {
      anonymize: (text) => {
        if (anonymizerRef.current === undefined) throw new Error('Anonymiseur non initialisé')
        return anonymizerRef.current.anonymize(text)
      }
    },
    budget,
    costOf: (engine, model, usage) =>
      engine === 'claude'
        ? costMillicents(usage, pricingFor(model, config.get().claudeModel), config.get().usdEurRate)
        : 0,
    callLog: calls,
    localQueue: {
      enqueue: async (request) => {
        if (localQueueRef.current === undefined) throw new Error('File locale non initialisée')
        await localQueueRef.current.enqueue(request)
      }
    }
  })

  anonymizerRef.current = new Anonymizer({ detectSensitive: sensitiveDetectorFrom(gateway) })

  const localQueue = new LocalQueue({
    repository: new PendingRequestRepository(options.db),
    gateway,
    isLocalAvailable: async () => (await ollama.isAvailable()).up,
    schemas: { CategoryOut, SensitiveOut },
    onCompleted: (requestId) => options.onQueuedCompleted(requestId),
    onFailed: () => options.logger.warn('ai.queue_abandoned', {})
  })
  localQueueRef.current = localQueue

  const timer = setInterval(() => void localQueue.tick(), LOCAL_QUEUE_PROBE_MS)
  void localQueue.tick()

  return { gateway, config, localQueue, stop: () => clearInterval(timer) }
}
