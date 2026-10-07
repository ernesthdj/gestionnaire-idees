import type { z } from 'zod'
import type { Effort, Engine, TaskKind, Usage } from '../../domain/ai/types'

/** Bloc de consigne système ; `cacheable` = contenu stable, placé en tête pour le cache de prompt. */
export interface SystemBlock {
  readonly text: string
  readonly cacheable: boolean
  /** Nature du bloc : les exemples (issus d'idées réelles) sont anonymisés avant tout envoi externe. */
  readonly role?: 'frame' | 'instructions' | 'profile' | 'rules' | 'examples'
}

export interface CompletionRequest<T> {
  readonly system: readonly SystemBlock[]
  readonly user: string
  readonly schema: z.ZodType<T>
  readonly effort?: Effort
  readonly maxTokens: number
  /** Modèle propre à la tâche (ex. widgets sur Sonnet) ; sinon le modèle configuré du moteur. */
  readonly model?: string
  /** Délai propre à la tâche ; sinon celui du moteur. */
  readonly timeoutMs?: number
  /** Fenêtre de contexte demandée au modèle local (Ollama) ; ignorée par Claude. */
  readonly contextTokens?: number
  /** Tâche à l'origine de la demande : les outils ne sont accordés qu'à la tâche `analyste` (constitution IV). */
  readonly task?: TaskKind
  /**
   * Outils de lecture (`Read Glob Grep`) dans `cwd` (spec 019, `L3-analyste-analyse.md` §2) ; refusés pour toute
   * autre tâche que `analyste`. Sans cette option, aucun outil.
   */
  readonly tools?: 'read-only'
  /** Dossier de travail des outils de lecture (le dépôt désigné) ; seulement avec `tools: 'read-only'`. */
  readonly cwd?: string
  /** Annulation : le processus du moteur est arrêté. */
  readonly signal?: AbortSignal
}

export interface CompletionResponse<T> {
  readonly parsed: T | null
  readonly usage: Usage
  readonly stopReason: string
  readonly model: string
}

/** Recherche web (texte libre + sources) : incompatible avec la sortie structurée, d'où un appel à part. */
export type ProviderProblem = 'not_running' | 'model_missing' | 'unexpected' | 'not_configured'

export interface ProviderStatus {
  readonly up: boolean
  readonly model?: string
  readonly reason?: string
  /** Cause de l'indisponibilité, pour guider l'utilisateur (installation, téléchargement, clé…). */
  readonly problem?: ProviderProblem
}

/** Stratégie par moteur (contracts/ai-gateway.md). Seul `AIGateway` l'utilise. */
export interface AIProvider {
  readonly id: Engine
  /** Modèle configuré, annoncé à l'interface pendant qu'il travaille (le modèle réel est dans la réponse). */
  currentModel?(): string
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
