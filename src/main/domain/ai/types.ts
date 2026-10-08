/**
 * Types de demande IA passant par la passerelle (spec 010) : la catégorisation d'une idée capturée, en local, et la
 * génération d'un widget, par `claude -p`. Les conversations des neurones passent par le CLI en direct (spec 008).
 * Les tâches de la reprise (spec 017) partent vers Claude, ou vers Ollama pour un projet « Local uniquement ».
 */
export const LOCAL_TASK_KINDS = ['categoriser'] as const
export const REMOTE_TASK_KINDS = ['widget'] as const
export const REPRISE_TASK_KINDS = ['reprise_guide'] as const
/** Analyste interne (spec 019) : seule tâche automatique dotée d'outils, en lecture seule (constitution IV). */
export const ANALYSTE_TASK_KINDS = ['analyste'] as const
/** Arbre de skills (spec 020) : audit d'un skill importé et fiche technique, sans outil (le texte du skill est une donnée). */
export const SKILLS_TASK_KINDS = ['skill_audit', 'skill_card'] as const

export type TaskKind =
  | (typeof LOCAL_TASK_KINDS)[number]
  | (typeof REMOTE_TASK_KINDS)[number]
  | (typeof REPRISE_TASK_KINDS)[number]
  | (typeof ANALYSTE_TASK_KINDS)[number]
  | (typeof SKILLS_TASK_KINDS)[number]

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
