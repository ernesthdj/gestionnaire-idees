import type { RoutingTable } from '../../domain/ai/routing'
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
  readonly routing: RoutingTable
  readonly allowClaudeFallback: boolean
}

/** Réduit une donnée au strict nécessaire avant tout envoi externe (US2). Lève une erreur en cas d'échec. */
export interface Anonymizer {
  anonymize(text: string): Promise<string>
}

/** Plafond de dépense de l'IA externe (US3). */
export interface BudgetGuard {
  check(kind: TaskKind): Promise<{ readonly allowed: boolean }>
  record(costMillicents: number): Promise<void>
}

export type CallStatus = 'ok' | 'invalid' | 'error' | 'refusal' | 'blocked_budget'

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
