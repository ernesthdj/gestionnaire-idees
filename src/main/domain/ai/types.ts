/** Types de demande IA (spec 001 data-model, révision « Brainstormer »). */
export const LOCAL_TASK_KINDS = ['categoriser', 'resumer', 'anonymiser', 'briefing_texte'] as const
export const REMOTE_TASK_KINDS = ['etendre', 'synthetiser', 'reviser', 'suggerer_liens', 'suggerer'] as const

export type TaskKind = (typeof LOCAL_TASK_KINDS)[number] | (typeof REMOTE_TASK_KINDS)[number]

export type Engine = 'ollama' | 'claude'

export type Effort = 'low' | 'medium' | 'high'

export type AIErrorCode =
  | 'AI_UNAVAILABLE'
  | 'AI_INVALID_OUTPUT'
  | 'AI_REFUSAL'
  | 'BUDGET_EXCEEDED'
  | 'AUTH_FAILED'
  | 'ANONYMIZATION_FAILED'
  | 'QUEUED'

export interface AIError {
  readonly code: AIErrorCode
  readonly message: string
  readonly retryable: boolean
}

export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E }

export interface Usage {
  readonly inputTokens: number
  readonly outputTokens: number
  readonly cacheReadTokens: number
}
