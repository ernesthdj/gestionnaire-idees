import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import {
  ProviderError,
  type AIProvider,
  type CompletionRequest,
  type CompletionResponse,
  type ProviderStatus,
  type SystemBlock
} from '../../application/ai/AIProvider'

/** Sous-ensemble du client Anthropic utilisé, injectable pour les tests. */
export type ClaudeClient = Pick<Anthropic, 'beta'>

export interface ClaudeOptions {
  /** Lecture de la clé au moment de l'appel (SecretStore) : jamais conservée en mémoire au-delà. */
  readonly apiKey: () => string | null
  readonly model: () => string
  readonly createClient?: (apiKey: string) => ClaudeClient
}

/** Modèles pour lesquels la bascule serveur en cas de refus est activée (research R3, vérification T024). */
const SERVER_FALLBACK_MODELS = new Set(['claude-opus-5'])

/** Place le point de cache sur le dernier bloc stable : tout ce qui précède est réutilisé d'un appel à l'autre. */
function toSystemParam(blocks: readonly SystemBlock[]): Anthropic.Beta.BetaTextBlockParam[] {
  const lastCacheable = blocks.findLastIndex((block) => block.cacheable)
  return blocks.map((block, index) =>
    index === lastCacheable
      ? { type: 'text', text: block.text, cache_control: { type: 'ephemeral' } }
      : { type: 'text', text: block.text }
  )
}

/** Claude via le SDK officiel : sortie structurée validée, réflexion adaptative, cache de prompt. */
export class ClaudeProvider implements AIProvider {
  readonly id = 'claude' as const

  constructor(private readonly options: ClaudeOptions) {}

  async isAvailable(): Promise<ProviderStatus> {
    return this.options.apiKey() === null
      ? { up: false, reason: 'Clé API Claude non configurée' }
      : { up: true, model: this.options.model() }
  }

  async complete<T>(request: CompletionRequest<T>): Promise<CompletionResponse<T>> {
    const apiKey = this.options.apiKey()
    if (apiKey === null) throw new ProviderError('AUTH_FAILED', 'Clé API Claude non configurée', false)
    const client = this.options.createClient?.(apiKey) ?? new Anthropic({ apiKey })
    const model = this.options.model()
    const fallback = SERVER_FALLBACK_MODELS.has(model)

    try {
      const message = await client.beta.messages.parse({
        model,
        max_tokens: request.maxTokens,
        system: toSystemParam(request.system),
        messages: [{ role: 'user', content: request.user }],
        thinking: { type: 'adaptive' },
        output_config: {
          format: betaZodOutputFormat(request.schema),
          ...(request.effort === undefined ? {} : { effort: request.effort })
        },
        ...(fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {})
      })
      return {
        parsed: message.stop_reason === 'refusal' ? null : (message.parsed_output as T | null),
        stopReason: message.stop_reason ?? 'end_turn',
        model: message.model,
        usage: {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
          cacheReadTokens: message.usage.cache_read_input_tokens ?? 0
        }
      }
    } catch (error) {
      // Chaîne du plus spécifique au plus général (classes typées du SDK).
      if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
        throw new ProviderError('AUTH_FAILED', 'Clé API refusée', false)
      }
      if (error instanceof Anthropic.RateLimitError)
        throw new ProviderError('AI_UNAVAILABLE', 'Limite de débit atteinte', true)
      if (error instanceof Anthropic.APIConnectionError)
        throw new ProviderError('AI_UNAVAILABLE', 'Connexion impossible', true)
      if (error instanceof Anthropic.APIError)
        throw new ProviderError('AI_UNAVAILABLE', `Erreur API ${error.status ?? ''}`, true)
      throw error
    }
  }
}
