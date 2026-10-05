/** Vues et événements du chat d'un neurone (spec 008 contracts/chat.md). */

export type ChatRole = 'user' | 'assistant' | 'tool' | 'error'

export interface ChatMessageView {
  readonly id: string
  readonly role: ChatRole
  readonly text: string
  readonly createdAt: string
}

export interface ChatSheetView {
  readonly resume: string
  readonly points_cles: readonly string[]
  readonly decisions: readonly string[]
  readonly questions_ouvertes: readonly string[]
  readonly manques: readonly string[]
}

export interface ChatView {
  readonly neuronId: string
  readonly title: string
  readonly messages: readonly ChatMessageView[]
  readonly sheet: ChatSheetView
  /** `insufficient` | `sufficient` | `complete`, ou `null` si jamais évaluée. */
  readonly maturity: string | null
  /** Un tour est en cours (envoi bloqué) ; `partial` : texte déjà reçu de ce tour. */
  readonly busy: boolean
  readonly partial: string
  readonly usage: ChatUsageView
  /** Nom du dossier de projet lié (la conversation s'y ouvre) ; `null` : aucun. Le chemin complet reste dans le main. */
  readonly folder: string | null
  /** Genesis (idée ou projet) ou élément d'une carte de structure (spec 009), avec son type. */
  readonly role: 'genesis' | 'element'
  readonly elementType: string | null
  /** Modèle utilisé par cette conversation ; `modelChoice` : celui choisi pour elle (`null` : défaut de son usage). */
  readonly model: string
  readonly modelChoice: string | null
}

/** Part utilisée (0–1) d'une fenêtre de l'abonnement et sa remise à zéro (secondes depuis 1970). */
export interface UsageWindowView {
  readonly utilization: number
  readonly resetsAt: number | null
}

/**
 * Consommation (spec 008) : l'abonnement Claude de mentalyas, tous usages confondus (dernier relevé du CLI), et ce
 * que le Brainstormer a consommé lui-même.
 */
export interface ChatUsageView {
  readonly account: {
    readonly status: 'allowed' | 'allowed_warning' | 'rejected'
    /** Session : fenêtre glissante de 5 h. */
    readonly fiveHour: UsageWindowView | null
    /** Semaine : fenêtre de 7 jours. */
    readonly sevenDay: UsageWindowView | null
    /** Date du relevé (ISO). */
    readonly updatedAt: string
  } | null
  readonly app: {
    readonly weekTokens: number
    readonly weekTurns: number
    readonly totalTokens: number
    readonly totalTurns: number
    readonly neuronTokens: number
    readonly neuronTurns: number
  }
}

export type ChatErrorCode =
  'CLAUDE_NOT_FOUND' | 'NOT_LOGGED_IN' | 'LIMIT_REACHED' | 'PROCESS_FAILED' | 'SESSION_RESET' | 'FOLDER_MISSING'

/** Événements du main (charge commune : `neuronId`). */
export interface ChatDeltaEvent {
  readonly neuronId: string
  readonly text: string
}
export interface ChatToolEvent {
  readonly neuronId: string
  readonly message: ChatMessageView
}
export interface ChatTurnEndEvent {
  readonly neuronId: string
  /** Réponse enregistrée ; `null` si le tour n'a produit aucun texte. */
  readonly message: ChatMessageView | null
  readonly interrupted: boolean
}
export interface ChatErrorEvent {
  readonly neuronId: string
  readonly code: ChatErrorCode
  readonly message: ChatMessageView
  readonly resetsAt: number | null
}
/** Consommation à jour, après un relevé de l'abonnement ou la fin d'un échange. */
export interface ChatUsageEvent {
  readonly neuronId: string
  readonly usage: ChatUsageView
}
export interface ChatSheetEvent {
  readonly neuronId: string
}

/** Longueur maximale d'un message de mentalyas. */
export const CHAT_MESSAGE_MAX = 20_000
