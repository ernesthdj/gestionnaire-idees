/** Vues d'un widget de la carte (spec 004). */

/** Longueur maximale d'une demande adressée à Claude dans la chatbox d'un widget. */
export const WIDGET_PROMPT_MAX_CHARS = 2000

export interface WidgetVersionView {
  readonly id: string
  readonly number: number
  readonly title: string
  readonly summary: string
  readonly model: string
  readonly createdAt: string
}

/** Version affichée, avec son code (onglet « Code » : lu comme du texte, jamais exécuté dans l'app). */
export interface WidgetCodeView extends WidgetVersionView {
  readonly html: string
  readonly css: string
  readonly ts: string
}

export interface WidgetMessageView {
  readonly id: string
  readonly role: 'user' | 'assistant'
  readonly text: string
  /** Numéro de la version créée par cette réponse ; `null` pour une demande ou un échec. */
  readonly versionNumber: number | null
  readonly failed: boolean
}

/**
 * Outil coché à l'éclosion, pas encore généré (spec 006) : `queued` / `running` — Claude le prépare ; `idle` — la
 * génération a échoué ou a été interrompue (redémarrage) : « Réessayer ».
 */
export interface WidgetRequestView {
  readonly title: string
  readonly description: string
  readonly state: 'queued' | 'running' | 'idle'
}

export interface WidgetView {
  readonly blockId: string
  /** Demande en attente d'une première version ; `null` pour un widget créé à la main ou déjà généré. */
  readonly request: WidgetRequestView | null
  readonly current: WidgetCodeView | null
  readonly versions: readonly WidgetVersionView[]
  readonly messages: readonly WidgetMessageView[]
}
