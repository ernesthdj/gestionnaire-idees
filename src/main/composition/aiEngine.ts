import { mkdirSync } from 'node:fs'
import { AIGateway } from '../application/ai/AIGateway'
import { LocalQueue } from '../application/ai/LocalQueue'
import type { AgentContext } from '../application/ai/ports'
import type { TaskKind } from '../domain/ai/types'
import { resolveClaudePath } from '../infrastructure/claude/claudePath'
import { ClaudeCliProvider } from '../infrastructure/ai/ClaudeCliProvider'
import { OllamaProvider } from '../infrastructure/ai/OllamaProvider'
import type { AppDatabase } from '../infrastructure/db/client'
import { AiCallRepository } from '../infrastructure/db/repositories/AiCallRepository'
import { AiConfigRepository } from '../infrastructure/db/repositories/AiConfigRepository'
import { PendingRequestRepository } from '../infrastructure/db/repositories/PendingRequestRepository'
import type { Logger } from '../infrastructure/logging/logger'
import { CategoryOut } from '@shared/ai/schemas'

const LOCAL_QUEUE_PROBE_MS = 30_000

export interface AiEngine {
  readonly gateway: AIGateway
  readonly config: AiConfigRepository
  readonly localQueue: LocalQueue
  readonly ollama: OllamaProvider
  readonly claude: ClaudeCliProvider
  stop(): void
}

export interface AiEngineOptions {
  readonly db: AppDatabase
  readonly logger: Logger
  readonly ollamaUrl: string
  /** Dossier vide où tournent les tâches `claude -p` (aucun projet, aucun réglage). */
  readonly cliSandbox: string
  /** Dossiers que l'Analyste ne peut jamais lire (spec 019 R1). */
  readonly deniedReadDirs: readonly string[]
  /** Profil, règles et exemples actifs (import de contexte, US5). */
  readonly contextSource: (kind: TaskKind) => AgentContext | undefined
  /** Demande locale rejouée avec succès : identifiant et données validées. */
  readonly onQueuedCompleted: (requestId: string, data: unknown) => void
  /** Clé des empreintes de la sonde de l'Analyste (spec 019), `null` quand elle est inactive. */
  readonly fingerprintKey?: () => string | null
}

/** Modèle de l'Analyste interne (spec 019 T022) : lecture du dépôt et raisonnement sur le code. */
export const ANALYSTE_MODEL = 'claude-opus-5-5'
/** Fiches techniques des skills (spec 020 US2) : Sonnet 5.5 par défaut, une fiche par skill. */
export const SKILL_CARD_MODEL = 'claude-sonnet-5-5'

/**
 * Racine de composition du moteur IA (spec 010) : Ollama pour les tâches locales, Claude par le CLI officiel de
 * mentalyas (`claude -p`, abonnement) pour le reste. Plus d'API Anthropic, de clé, de budget ni d'anonymisation.
 */
export function createAiEngine(options: AiEngineOptions): AiEngine {
  const config = new AiConfigRepository(options.db)
  const calls = new AiCallRepository(options.db)
  mkdirSync(options.cliSandbox, { recursive: true })

  const ollama = new OllamaProvider({ baseUrl: options.ollamaUrl, model: () => config.get().localModel })
  const claude = new ClaudeCliProvider({
    claudePath: resolveClaudePath,
    model: () => config.get().claudeModel,
    cwd: () => options.cliSandbox,
    deniedReadDirs: () => options.deniedReadDirs
  })

  const localQueueRef: { current?: LocalQueue } = {}
  const gateway = new AIGateway({
    providers: { ollama, claude },
    config: () => {
      const current = config.get()
      return {
        allowClaudeFallback: current.allowClaudeFallback,
        claudeModelFor: (kind) =>
          kind === 'widget'
            ? current.widgetModel
            : kind === 'analyste'
              ? ANALYSTE_MODEL
              : kind === 'skill_card'
                ? SKILL_CARD_MODEL
                : undefined
      }
    },
    context: async (kind) => options.contextSource(kind),
    callLog: calls,
    localQueue: {
      enqueue: async (request) => {
        if (localQueueRef.current === undefined) throw new Error('File locale non initialisée')
        await localQueueRef.current.enqueue(request)
      }
    },
    ...(options.fingerprintKey === undefined ? {} : { fingerprintKey: options.fingerprintKey })
  })

  const localQueue = new LocalQueue({
    repository: new PendingRequestRepository(options.db),
    gateway,
    isLocalAvailable: async () => (await ollama.isAvailable()).up,
    schemas: { CategoryOut },
    onCompleted: (requestId, result) => options.onQueuedCompleted(requestId, result.data),
    onFailed: () => options.logger.warn('ai.queue_abandoned', {})
  })
  localQueueRef.current = localQueue

  const timer = setInterval(() => void localQueue.tick(), LOCAL_QUEUE_PROBE_MS)
  void localQueue.tick()

  return { gateway, config, localQueue, ollama, claude, stop: () => clearInterval(timer) }
}
