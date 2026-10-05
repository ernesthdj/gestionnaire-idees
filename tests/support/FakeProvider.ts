import type {
  AIProvider,
  CompletionRequest,
  CompletionResponse,
  ProviderStatus
} from '../../src/main/application/ai/AIProvider'
import type { Engine, Usage } from '../../src/main/domain/ai/types'

/** Réponse scriptée : `raw` est validé par le schéma de la requête, comme le ferait un vrai moteur. */
export interface ScriptedReply {
  readonly raw: unknown
  readonly stopReason?: string
  readonly usage?: Partial<Usage>
}

/** Moteur IA simulé : réponses scriptées dans l'ordre, requêtes enregistrées, aucun réseau. */
export class FakeProvider implements AIProvider {
  readonly requests: CompletionRequest<unknown>[] = []
  private readonly replies: ScriptedReply[]
  private status: ProviderStatus = { up: true, model: 'fake-model' }

  constructor(
    readonly id: Engine,
    replies: readonly ScriptedReply[] = []
  ) {
    this.replies = [...replies]
  }

  currentModel(): string {
    return `fake-${this.id}`
  }

  setAvailable(up: boolean): void {
    this.status = up ? { up: true, model: 'fake-model' } : { up: false, reason: 'arrêté (simulation)' }
  }

  enqueue(...replies: readonly ScriptedReply[]): void {
    this.replies.push(...replies)
  }

  async isAvailable(): Promise<ProviderStatus> {
    return this.status
  }

  async complete<T>(request: CompletionRequest<T>): Promise<CompletionResponse<T>> {
    this.requests.push(request as CompletionRequest<unknown>)
    if (!this.status.up) throw new Error('FakeProvider indisponible')
    const reply = this.replies.shift()
    if (reply === undefined) throw new Error('FakeProvider : aucune réponse scriptée restante')
    const parsed = request.schema.safeParse(reply.raw)
    return {
      parsed: parsed.success ? parsed.data : null,
      stopReason: reply.stopReason ?? 'end_turn',
      model: 'fake-model',
      usage: { inputTokens: 100, outputTokens: 50, cacheReadTokens: 0, cacheWriteTokens: 0, ...reply.usage }
    }
  }
}
