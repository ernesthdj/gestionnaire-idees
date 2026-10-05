/**
 * Types de demande IA passant par la passerelle (spec 010) : la catégorisation d'une idée capturée, en local, et la
 * génération d'un widget, par `claude -p`. Les conversations des neurones passent par le CLI en direct (spec 008).
 */
export const LOCAL_TASK_KINDS = ['categoriser'] as const
export const REMOTE_TASK_KINDS = ['widget'] as const

export type TaskKind = (typeof LOCAL_TASK_KINDS)[number] | (typeof REMOTE_TASK_KINDS)[number]

export type Engine = 'ollama' | 'claude'

export type Effort = 'low' | 'medium' | 'high'

export type AIErrorCode = 'AI_UNAVAILABLE' | 'AI_INVALID_OUTPUT' | 'AI_REFUSAL' | 'AUTH_FAILED' | 'QUEUED'

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
  /** Tokens écrits en cache (facturés ~1,25× le prix d'entrée). */
  readonly cacheWriteTokens: number
  /** Recherches web exécutées côté serveur (facturées à l'unité). */
  readonly webSearches?: number
}
