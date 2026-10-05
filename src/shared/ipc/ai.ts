/** Vues et constantes partagées des réglages IA (spec 010). Aucun secret : plus de clé API. */

/** Modèles proposés dans Réglages › IA et dans le chat (Opus 5 gardé pour les réglages existants). */
export const CLAUDE_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-4-5', 'claude-opus-5'] as const
export type ClaudeModel = (typeof CLAUDE_MODELS)[number]

export interface AiStatusView {
  readonly ollama: {
    readonly up: boolean
    readonly model: string
    readonly reason?: string
    /** Étapes à suivre pour rendre l'IA locale disponible (vide si tout va bien). */
    readonly guidance: readonly string[]
  }
  /** Claude Code (CLI officiel, abonnement de mentalyas). */
  readonly claude: {
    readonly ready: boolean
    readonly reason?: string
  }
}

export interface AiConfigView {
  /** Modèle des conversations des genesis (idées, projets). */
  readonly claudeModel: string
  /** Modèle des conversations des éléments d'une carte de structure (spec 009). */
  readonly elementModel: string
  /** Modèle de la génération de widgets (spec 004). */
  readonly widgetModel: string
  readonly localModel: string
  readonly allowClaudeFallback: boolean
}

export interface AiTestView {
  readonly ok: boolean
  readonly latencyMs?: number
  readonly reason?: string
}
