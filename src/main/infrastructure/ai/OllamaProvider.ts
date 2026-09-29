import { z } from 'zod'
import {
  ProviderError,
  type AIProvider,
  type CompletionRequest,
  type CompletionResponse,
  type ProviderStatus
} from '../../application/ai/AIProvider'

export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal }
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>

export interface OllamaOptions {
  readonly baseUrl: string
  readonly model: () => string
  readonly fetch?: FetchLike
  readonly timeoutMs?: number
}

const TagsResponse = z.object({ models: z.array(z.object({ name: z.string() })) })
const ChatResponse = z.object({
  model: z.string(),
  message: z.object({ content: z.string() }),
  done_reason: z.string().optional(),
  prompt_eval_count: z.number().optional(),
  eval_count: z.number().optional()
})

/** JSON.parse sans exception : un contenu non JSON donne `null`, rejeté ensuite par le schéma. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

export const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434'

/** Adresse d'Ollama issue de l'environnement : toute adresse non locale ou invalide est ignorée (sans planter). */
export function resolveOllamaUrl(value: string | undefined): { url: string; rejected: boolean } {
  if (value === undefined || value.trim() === '') return { url: DEFAULT_OLLAMA_URL, rejected: false }
  try {
    const url = new URL(value)
    return LOOPBACK_HOSTS.has(url.hostname)
      ? { url: value, rejected: false }
      : { url: DEFAULT_OLLAMA_URL, rejected: true }
  } catch {
    return { url: DEFAULT_OLLAMA_URL, rejected: true }
  }
}

/** IA locale via l'API HTTP d'Ollama — uniquement sur la machine (127.0.0.1). */
export class OllamaProvider implements AIProvider {
  readonly id = 'ollama' as const

  currentModel(): string {
    return this.options.model()
  }
  private readonly fetchFn: FetchLike

  constructor(private readonly options: OllamaOptions) {
    const url = new URL(options.baseUrl)
    if (!LOOPBACK_HOSTS.has(url.hostname)) throw new Error('Ollama doit rester local (127.0.0.1)')
    this.fetchFn = options.fetch ?? (fetch as unknown as FetchLike)
  }

  async isAvailable(): Promise<ProviderStatus> {
    const model = this.options.model()
    try {
      const response = await this.fetchFn(`${this.options.baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) })
      if (!response.ok) return { up: false, reason: 'Service Ollama injoignable', problem: 'not_running' }
      const tags = TagsResponse.safeParse(await response.json())
      if (!tags.success) return { up: false, reason: 'Réponse Ollama inattendue', problem: 'unexpected' }
      const installed = tags.data.models.some((entry) => entry.name === model || entry.name.startsWith(`${model}:`))
      return installed
        ? { up: true, model }
        : { up: false, reason: `Modèle « ${model} » non téléchargé`, problem: 'model_missing' }
    } catch {
      return { up: false, reason: 'Ollama non démarré', problem: 'not_running' }
    }
  }

  async complete<T>(request: CompletionRequest<T>): Promise<CompletionResponse<T>> {
    const model = this.options.model()
    let raw: unknown
    try {
      const response = await this.fetchFn(`${this.options.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 120_000),
        body: JSON.stringify({
          model,
          stream: false,
          // Tâches locales courtes et structurées : la réflexion à voix haute ralentit sans améliorer le résultat.
          think: false,
          format: z.toJSONSchema(request.schema),
          options: { num_predict: request.maxTokens },
          messages: [
            { role: 'system', content: request.system.map((block) => block.text).join('\n\n') },
            { role: 'user', content: request.user }
          ]
        })
      })
      if (!response.ok) throw new ProviderError('AI_UNAVAILABLE', `Ollama a répondu ${response.status}`, true)
      raw = await response.json()
    } catch (error) {
      if (error instanceof ProviderError) throw error
      throw new ProviderError('AI_UNAVAILABLE', 'Ollama injoignable', true)
    }

    const chat = ChatResponse.safeParse(raw)
    if (!chat.success) throw new ProviderError('AI_UNAVAILABLE', 'Réponse Ollama inattendue', true)
    const parsed = request.schema.safeParse(parseJson(chat.data.message.content))
    return {
      parsed: parsed.success ? parsed.data : null,
      stopReason: chat.data.done_reason ?? 'stop',
      model: chat.data.model,
      usage: {
        inputTokens: chat.data.prompt_eval_count ?? 0,
        outputTokens: chat.data.eval_count ?? 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0
      }
    }
  }
}
