/** Vues et constantes partagées des réglages IA (contracts/ipc-ai.md). Aucun secret n'y figure. */

/** Modèles proposés dans Réglages › IA (génération actuelle ; Opus 5 gardé pour les réglages existants). */
export const CLAUDE_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-4-5', 'claude-opus-5'] as const
export type ClaudeModel = (typeof CLAUDE_MODELS)[number]

export type BudgetStateView = 'normal' | 'alert' | 'blocked' | 'unlocked'

export interface AiStatusView {
  readonly ollama: {
    readonly up: boolean
    readonly model: string
    readonly reason?: string
    /** Étapes à suivre pour rendre l'IA locale disponible (vide si tout va bien). */
    readonly guidance: readonly string[]
  }
  readonly claude: {
    readonly configured: boolean
    readonly model: string
    readonly maskedKey?: string
  }
  readonly budget: {
    readonly spentCents: number
    readonly capCents: number
    readonly state: BudgetStateView
  }
}

export interface AiConfigView {
  readonly capCents: number
  readonly alertRatio: number
  readonly usdEurRate: number
  readonly claudeModel: string
  /** Modèle Claude des widgets (spec 004). */
  readonly widgetModel: string
  readonly localModel: string
  readonly allowClaudeFallback: boolean
  readonly maskAmounts: boolean
}

export interface AiTestView {
  readonly ok: boolean
  readonly latencyMs?: number
  readonly reason?: string
}
