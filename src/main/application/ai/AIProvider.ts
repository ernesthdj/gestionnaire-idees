import type { z } from 'zod'
import type { Effort, Engine, Usage } from '../../domain/ai/types'

/** Bloc de consigne système ; `cacheable` = contenu stable, placé en tête pour le cache de prompt. */
export interface SystemBlock {
  readonly text: string
  readonly cacheable: boolean
}

export interface CompletionRequest<T> {
  readonly system: readonly SystemBlock[]
  readonly user: string
  readonly schema: z.ZodType<T>
  readonly effort?: Effort
  readonly maxTokens: number
}

export interface CompletionResponse<T> {
  readonly parsed: T | null
  readonly usage: Usage
  readonly stopReason: string
  readonly model: string
}

export interface ProviderStatus {
  readonly up: boolean
  readonly model?: string
  readonly reason?: string
}

/** Stratégie par moteur (contracts/ai-gateway.md). Seul `AIGateway` l'utilise. */
export interface AIProvider {
  readonly id: Engine
  isAvailable(): Promise<ProviderStatus>
  complete<T>(request: CompletionRequest<T>): Promise<CompletionResponse<T>>
}

/** Erreur typée d'un moteur : permet à la passerelle de distinguer une clé refusée d'une panne. */
export class ProviderError extends Error {
  constructor(
    readonly code: 'AUTH_FAILED' | 'AI_UNAVAILABLE',
    message: string,
    readonly retryable: boolean
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}
