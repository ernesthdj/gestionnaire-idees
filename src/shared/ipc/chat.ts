/** Vues et événements du chat d'un neurone (spec 008 contracts/chat.md). */

export type ChatRole = 'user' | 'assistant' | 'tool' | 'error'

/** Résultat réel d'un outil de Claude (spec 014 R4) : en cours, réussi, refusé (permission) ou échoué. */
export type ToolStatus = 'running' | 'ok' | 'denied' | 'error'

export interface ChatMessageView {
  readonly id: string
  readonly role: ChatRole
  readonly text: string
  readonly createdAt: string
  /** Outil : son résultat réel et la raison courte d'un refus ou d'une erreur. */
  readonly toolStatus?: ToolStatus
  readonly toolReason?: string
}

/** Mode de permission d'une conversation (spec 014 D1), comme Maj+Tab dans le terminal. */
export const PERMISSION_MODES = ['default', 'acceptEdits', 'bypassPermissions'] as const
export type PermissionMode = (typeof PERMISSION_MODES)[number]
/** Modes possibles par défaut (spec 014 D8) : jamais Libre, qui se confirme conversation par conversation. */
export const DEFAULT_PERMISSION_MODES = ['default', 'acceptEdits'] as const
export type DefaultPermissionMode = (typeof DEFAULT_PERMISSION_MODES)[number]

/** Avertissement du mode Libre (spec 014 FR-006), à confirmer une fois par conversation. */
export const BYPASS_WARNING =
  'En mode Libre, Claude écrit et lance n’importe quelle commande sans te demander. Un fichier ou une fiche piégés peuvent en profiter.'

/** Ce que Claude veut faire, montré à mentalyas avant qu'il décide. */
export type PermissionDetailView =
  | { readonly kind: 'write'; readonly path: string; readonly preview: string }
  | { readonly kind: 'command'; readonly command: string; readonly cwd: string | null }
  | { readonly kind: 'other'; readonly input: string }

/** Demande de permission de Claude Code, en attente de la réponse de mentalyas (spec 014 US1). */
export interface ChatPermissionRequest {
  readonly id: string
  readonly neuronId: string
  readonly tool: string
  readonly detail: PermissionDetailView
  readonly at: string
}

export const PERMISSION_DECISIONS = ['allow', 'always', 'deny'] as const
export type PermissionDecisionView = (typeof PERMISSION_DECISIONS)[number]

export interface ChatPermissionResolvedEvent {
  readonly neuronId: string
  readonly requestId: string
  readonly decision: PermissionDecisionView | 'expired'
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
  /**
   * Genesis (idée ou projet), élément d'une carte de structure (spec 009), étape d'un plan d'attaque (spec 011),
   * conversation Skills (spec 020) ou nœud de la vue Workflow (spec 023).
   */
  readonly role: 'genesis' | 'element' | 'step' | 'skills' | 'workflow'
  readonly elementType: string | null
  /** Rang d'une étape (« ② », « ②.1 ») ; `null` sinon. */
  readonly stepLabel: string | null
  /** Modèle utilisé par cette conversation ; `modelChoice` : celui choisi pour elle (`null` : défaut de son usage). */
  readonly model: string
  readonly modelChoice: string | null
  /** Demandes de permission encore ouvertes (spec 014) : rouvrir le chat les remontre. */
  readonly pending: readonly ChatPermissionRequest[]
  /** Le dossier du projet est un dépôt git (spec 016) : sinon « Initialiser git » est proposé. */
  readonly git: boolean
  /** Mode de permission de la conversation (spec 014 US2) : le sien, sinon le défaut réglé. */
  readonly permissionMode: PermissionMode
  /** Projet repris (spec 017) auquel appartient ce neurone, et sa confidentialité ; `null` : aucun. */
  readonly reprise: { readonly genesisId: string; readonly confidentiality: 'claude' | 'local' } | null
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
