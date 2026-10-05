import type { Engine, TaskKind, Usage } from '../../domain/ai/types'

/** Contexte injecté après le cadre système : profil, règles et exemples actifs (US5). */
export interface AgentContext {
  readonly profile: string
  readonly rules: string
  readonly examples: readonly ContextExample[]
}

export interface ContextExample {
  readonly polarity: 'positive' | 'negative'
  readonly input: string
  readonly output: unknown
  readonly reason?: string
}

export interface GatewayConfig {
  /** Une tâche locale part vers Claude quand Ollama est arrêté, au lieu d'attendre dans la file. */
  readonly allowClaudeFallback: boolean
  /** Modèle Claude propre à une tâche (ex. `widget`) ; `undefined` : le modèle général. */
  readonly claudeModelFor?: (kind: TaskKind) => string | undefined
}

export type CallStatus = 'ok' | 'invalid' | 'error' | 'refusal'

/** Métadonnées d'un appel — jamais de contenu. */
export interface CallRecord {
  readonly requestId: string
  readonly kind: TaskKind
  readonly engine: Engine
  readonly model: string
  readonly usage: Usage
  readonly costMillicents: number
  readonly status: CallStatus
  readonly errorCode?: string
  readonly durationMs: number
}

export interface CallLog {
  record(call: CallRecord): Promise<void>
}

/** Demande locale mise en attente faute d'IA locale disponible. */
export interface PendingRequest {
  readonly requestId: string
  readonly kind: TaskKind
  readonly input: string
  readonly schemaName: string | undefined
}

export interface LocalQueuePort {
  enqueue(request: PendingRequest): Promise<void>
}
