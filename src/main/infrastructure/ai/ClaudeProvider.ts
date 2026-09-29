import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import {
  ProviderError,
  type AIProvider,
  type CompletionRequest,
  type CompletionResponse,
  type ProviderStatus,
  type ResearchRequest,
  type ResearchResponse,
  type SystemBlock,
  type WebSource
} from '../../application/ai/AIProvider'
import type { Usage } from '../../domain/ai/types'

/** Sous-ensemble du client Anthropic utilisé, injectable pour les tests. */
export type ClaudeClient = Pick<Anthropic, 'beta' | 'models'>

export interface ClaudeOptions {
  /** Lecture de la clé au moment de l'appel (SecretStore) : jamais conservée en mémoire au-delà. */
  readonly apiKey: () => string | null
  readonly model: () => string
  readonly createClient?: (apiKey: string) => ClaudeClient
}

/** Modèles pour lesquels la bascule serveur en cas de refus est activée (research R3, vérification T024). */
const SERVER_FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-opus-5'])

/** Recherche localisée (prix en euros, magasins belges) sans rien révéler de plus précis que le pays. */
const SEARCH_LOCATION = { type: 'approximate', country: 'BE', timezone: 'Europe/Brussels' } as const
/** Une recherche longue peut être mise en pause par l'API (`pause_turn`) : reprises bornées. */
const MAX_CONTINUATIONS = 3

function usageOf(message: Anthropic.Beta.BetaMessage): Usage {
  return {
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
    webSearches: message.usage.server_tool_use?.web_search_requests ?? 0
  }
}

function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    webSearches: (a.webSearches ?? 0) + (b.webSearches ?? 0)
  }
}

/** Réponse finale = texte qui suit la dernière recherche (le texte d'avant n'annonce que la recherche). */
function answerOf(content: readonly Anthropic.Beta.BetaContentBlock[]): { text: string; sources: WebSource[] } {
  const lastTool = content.findLastIndex((block) => block.type !== 'text' && block.type !== 'thinking')
  const texts = content.slice(lastTool + 1).filter((block) => block.type === 'text')
  const sources = new Map<string, WebSource>()
  for (const block of texts) {
    for (const citation of block.citations ?? []) {
      if (citation.type === 'web_search_result_location' && !sources.has(citation.url)) {
        sources.set(citation.url, { url: citation.url, title: citation.title ?? citation.url })
      }
    }
  }
  return {
    text: texts
      .map((block) => block.text)
      .join('')
      .trim(),
    sources: [...sources.values()]
  }
}

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

  currentModel(): string {
    return this.options.model()
  }

  constructor(private readonly options: ClaudeOptions) {}

  async isAvailable(): Promise<ProviderStatus> {
    return this.options.apiKey() === null
      ? { up: false, reason: 'Clé API Claude non configurée' }
      : { up: true, model: this.options.model() }
  }

  /** Vérifie la clé et l'accès au modèle sans consommer de tokens (lecture de la fiche du modèle). */
  async ping(): Promise<void> {
    const apiKey = this.options.apiKey()
    if (apiKey === null) throw new ProviderError('AUTH_FAILED', 'Clé API Claude non configurée', false)
    const client = this.options.createClient?.(apiKey) ?? new Anthropic({ apiKey })
    try {
      await client.models.retrieve(this.options.model())
    } catch (error) {
      throw toProviderError(error)
    }
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
          cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
          cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0
        }
      }
    } catch (error) {
      throw toProviderError(error)
    }
  }

  /** Recherche web côté serveur (filtrage dynamique des résultats) : texte final et sources citées. */
  async research(request: ResearchRequest): Promise<ResearchResponse> {
    const apiKey = this.options.apiKey()
    if (apiKey === null) throw new ProviderError('AUTH_FAILED', 'Clé API Claude non configurée', false)
    const client = this.options.createClient?.(apiKey) ?? new Anthropic({ apiKey })
    const model = this.options.model()
    const fallback = SERVER_FALLBACK_MODELS.has(model)
    const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: request.user }]

    try {
      let usage: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, webSearches: 0 }
      for (let turn = 0; ; turn++) {
        const message = await client.beta.messages.create({
          model,
          max_tokens: request.maxTokens,
          system: toSystemParam(request.system),
          messages,
          thinking: { type: 'adaptive' },
          tools: [
            {
              type: 'web_search_20260209',
              name: 'web_search',
              max_uses: request.maxSearches,
              user_location: SEARCH_LOCATION
            }
          ],
          ...(request.effort === undefined ? {} : { output_config: { effort: request.effort } }),
          ...(fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {})
        })
        usage = addUsage(usage, usageOf(message))
        if (message.stop_reason === 'pause_turn' && turn < MAX_CONTINUATIONS) {
          // Reprise : renvoyer le message de l'assistant tel quel, sans nouveau message utilisateur.
          messages.splice(1, messages.length - 1, { role: 'assistant', content: message.content })
          continue
        }
        const { text, sources } = answerOf(message.content)
        return { text, sources, usage, stopReason: message.stop_reason ?? 'end_turn', model: message.model }
      }
    } catch (error) {
      throw toProviderError(error)
    }
  }
}

/** Traduit les erreurs typées du SDK, de la plus spécifique à la plus générale. */
function toProviderError(error: unknown): unknown {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new ProviderError('AUTH_FAILED', 'Clé API refusée', false)
  }
  if (error instanceof Anthropic.NotFoundError) return new ProviderError('AI_UNAVAILABLE', 'Modèle introuvable', false)
  if (error instanceof Anthropic.RateLimitError)
    return new ProviderError('AI_UNAVAILABLE', 'Limite de débit atteinte', true)
  if (error instanceof Anthropic.APIConnectionError)
    return new ProviderError('AI_UNAVAILABLE', 'Connexion impossible', true)
  if (error instanceof Anthropic.APIError)
    return new ProviderError('AI_UNAVAILABLE', `Erreur API ${error.status ?? ''}`, true)
  return error
}
