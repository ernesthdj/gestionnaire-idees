import { randomUUID } from 'node:crypto'
import type { z } from 'zod'
import { effortFor, engineFor, maxTokensFor } from '../../domain/ai/routing'
import type { AIError, AIErrorCode, Engine, Result, TaskKind, Usage } from '../../domain/ai/types'
import { ProviderError, type AIProvider, type CompletionResponse } from './AIProvider'
import { assembleContext } from './ContextAssembler'
import type { AgentContext, CallLog, CallStatus, GatewayConfig, LocalQueuePort } from './ports'

export interface GatewayRequest<T> {
  readonly kind: TaskKind
  readonly input: string
  readonly schema: z.ZodType<T>
  /** Nom du schéma, requis pour pouvoir rejouer la demande depuis la file locale persistante. */
  readonly schemaName?: string
  readonly requestId?: string
  /** Usage interne (rejeu par la file locale) : ne jamais remettre la demande en file. */
  readonly noQueue?: boolean
  /** Texte ajouté tel quel après l'entrée : une sortie antérieure de Claude (code courant d'un widget, spec 004). */
  readonly verbatim?: string
  /** Appelé quand un moteur commence réellement à travailler (repli compris) : l'interface peut dire qui réfléchit. */
  readonly onEngine?: (engine: Engine, model: string) => void
}

export interface AIResult<T> {
  readonly data: T
  readonly engine: Engine
  readonly model: string
}

export interface GatewayDependencies {
  readonly providers: Readonly<Record<Engine, AIProvider>>
  readonly config: () => GatewayConfig
  /** Profil, règles et exemples actifs pour ce type de tâche (US5). */
  readonly context: (kind: TaskKind) => Promise<AgentContext | undefined>
  readonly callLog: CallLog
  readonly localQueue: LocalQueuePort
}

const CONCURRENCY: Readonly<Record<Engine, number>> = { ollama: 1, claude: 2 }
const IDEMPOTENCE_TTL_MS = 5 * 60 * 1000
const RETRY_HINT =
  'Ta réponse précédente ne respectait pas le format demandé. Réponds de nouveau en respectant strictement le format.'

/** Limite le nombre d'appels simultanés vers un moteur. */
class Semaphore {
  private active = 0
  private readonly waiting: (() => void)[] = []
  constructor(private readonly limit: number) {}

  async use<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) await new Promise<void>((resolve) => this.waiting.push(resolve))
    this.active += 1
    try {
      return await task()
    } finally {
      this.active -= 1
      this.waiting.shift()?.()
    }
  }
}

function failure(code: AIErrorCode, message: string, retryable = false): { ok: false; error: AIError } {
  return { ok: false, error: { code, message, retryable } }
}

/**
 * Seul point d'accès à l'IA hors conversations (constitution III, contracts/ai-gateway.md) : Ollama pour la
 * catégorisation (mise en file s'il est arrêté), `claude -p` pour les widgets (spec 010).
 */
export class AIGateway {
  private readonly semaphores: Record<Engine, Semaphore> = {
    ollama: new Semaphore(CONCURRENCY.ollama),
    claude: new Semaphore(CONCURRENCY.claude)
  }
  private readonly recent = new Map<string, { at: number; result: AIResult<unknown> }>()

  constructor(private readonly deps: GatewayDependencies) {}

  async run<T>(request: GatewayRequest<T>): Promise<Result<AIResult<T>, AIError>> {
    const requestId = request.requestId ?? randomUUID()
    const cached = this.recent.get(requestId)
    if (cached !== undefined && Date.now() - cached.at < IDEMPOTENCE_TTL_MS) {
      return { ok: true, value: cached.result as AIResult<T> }
    }

    const config = this.deps.config()
    let engine = engineFor(request.kind)

    if (engine === 'ollama' && !(await this.deps.providers.ollama.isAvailable()).up) {
      if (config.allowClaudeFallback) {
        engine = 'claude'
      } else if (request.noQueue === true) {
        return failure('AI_UNAVAILABLE', "L'IA locale est indisponible", true)
      } else {
        try {
          await this.deps.localQueue.enqueue({
            requestId,
            kind: request.kind,
            input: request.input,
            schemaName: request.schemaName
          })
        } catch {
          return failure('AI_UNAVAILABLE', "L'IA locale est indisponible", true)
        }
        return failure('QUEUED', "L'IA locale est indisponible : la demande sera traitée à son retour", true)
      }
    }

    if (engine === 'claude' && !(await this.deps.providers.claude.isAvailable()).up) {
      return failure('AI_UNAVAILABLE', 'Claude est indisponible', true)
    }

    const assembled = assembleContext({
      kind: request.kind,
      input: request.input,
      context: await this.deps.context(request.kind)
    })
    const user = request.verbatim === undefined ? assembled.user : `${assembled.user}\n\n${request.verbatim}`
    const model = engine === 'claude' ? config.claudeModelFor?.(request.kind) : undefined
    const chosen = engine
    const result = await this.semaphores[chosen].use(() => {
      request.onEngine?.(chosen, model ?? this.deps.providers[chosen].currentModel?.() ?? '')
      return this.callWithRetry(request, requestId, chosen, assembled.system, user, model)
    })
    if (result.ok) this.remember(requestId, result.value)
    return result
  }

  private async callWithRetry<T>(
    request: GatewayRequest<T>,
    requestId: string,
    engine: Engine,
    system: Parameters<AIProvider['complete']>[0]['system'],
    user: string,
    model: string | undefined
  ): Promise<Result<AIResult<T>, AIError>> {
    const provider = this.deps.providers[engine]
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const started = Date.now()
      let response: CompletionResponse<T>
      try {
        response = await provider.complete({
          system,
          user: attempt === 0 ? user : `${user}\n\n${RETRY_HINT}`,
          schema: request.schema,
          effort: effortFor(request.kind),
          maxTokens: maxTokensFor(request.kind),
          ...(model === undefined ? {} : { model })
        })
      } catch (error) {
        const code = error instanceof ProviderError ? error.code : 'AI_UNAVAILABLE'
        await this.log(requestId, request.kind, engine, '', undefined, 'error', Date.now() - started, code)
        return code === 'AUTH_FAILED'
          ? failure('AUTH_FAILED', 'Claude Code n’est pas connecté : lance `claude` pour te connecter')
          : failure('AI_UNAVAILABLE', "L'IA n'a pas pu répondre", true)
      }

      const refused = response.stopReason === 'refusal'
      const status: CallStatus = refused ? 'refusal' : response.parsed === null ? 'invalid' : 'ok'
      const errorCode = refused ? 'AI_REFUSAL' : status === 'invalid' ? 'AI_INVALID_OUTPUT' : undefined
      await this.log(
        requestId,
        request.kind,
        engine,
        response.model,
        response.usage,
        status,
        Date.now() - started,
        errorCode
      )

      if (refused) return failure('AI_REFUSAL', "L'IA a refusé de traiter cette demande")
      if (response.parsed !== null) return { ok: true, value: { data: response.parsed, engine, model: response.model } }
    }
    return failure('AI_INVALID_OUTPUT', "La réponse de l'IA ne respectait pas le format attendu")
  }

  private remember(requestId: string, result: AIResult<unknown>): void {
    const now = Date.now()
    for (const [id, entry] of this.recent) if (now - entry.at >= IDEMPOTENCE_TTL_MS) this.recent.delete(id)
    this.recent.set(requestId, { at: now, result })
  }

  private log(
    requestId: string,
    kind: TaskKind,
    engine: Engine,
    model: string,
    usage: Usage | undefined,
    status: CallStatus,
    durationMs: number,
    errorCode?: string
  ): Promise<void> {
    return this.deps.callLog.record({
      requestId,
      kind,
      engine,
      model,
      usage: usage ?? { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
      costMillicents: 0,
      status,
      durationMs,
      ...(errorCode === undefined ? {} : { errorCode })
    })
  }
}
