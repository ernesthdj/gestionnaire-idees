/** Vues IPC des actions finales (spec 013 contracts/interfaces.md). */

export const FINAL_STATES = ['proposee', 'prete', 'en_cours', 'a_revoir'] as const
/** « Fait » ne figure pas ici : il se lit dans le statut de l'étape (`StepView.status`). */
export type FinalState = (typeof FINAL_STATES)[number]

/** Action finale d'une étape : proposée par Claude (en attente) ou acceptée par mentalyas. */
export interface StepFinalView {
  readonly state: FinalState
  /** Livrable annoncé par Claude. */
  readonly deliverable: string
  readonly reason: string
  /** Le genesis a un dossier de projet lié ; sinon l'exécution ne produit que des documents. */
  readonly projectLinked: boolean
}

/** Bornes du cadre d'un livrable (comme un document, spec 012). */
export const DELIVERABLE_SIZE_LIMITS = { minWidth: 280, minHeight: 160, maxWidth: 1200, maxHeight: 1600 } as const

/** Fichier du livrable : créé ou modifié par Claude dans le projet lié. */
export interface DeliverableFileView {
  readonly path: string
  readonly status: 'cree' | 'modifie'
}

/** Un fichier du livrable ouvert dans la visionneuse (spec 013 D4, `deliverable:file`), en lecture seule. */
export interface DeliverableFileDetailView {
  readonly path: string
  readonly status: 'cree' | 'modifie'
  /** Langage pour la coloration ; `null` : texte brut. */
  readonly language: string | null
  /** Contenu d'avant la première écriture de Claude ; `null` : fichier créé. */
  readonly before: string | null
  /** Dernier contenu écrit par Claude. */
  readonly after: string
  /** Contenu actuel sur le disque ; `null` s'il est absent, trop gros ou binaire. */
  readonly current: string | null
  readonly missing: boolean
  readonly tooBig: boolean
  readonly binary: boolean
  /** Le fichier sur le disque n'est plus celui écrit par Claude (retouché ailleurs). */
  readonly changedSince: boolean
}

/** Un fichier du livrable dans la revue (spec 013 US3, `deliverable:get`). */
export interface DeliverableDetailFileView {
  readonly path: string
  readonly status: 'cree' | 'modifie'
  /** Contenu d'avant la première écriture de Claude ; `null` : fichier créé. */
  readonly before: string | null
  /** Dernier contenu écrit par Claude. */
  readonly after: string
  /** Le fichier sur le disque n'est plus celui écrit par Claude (retouché ailleurs, ou absent). */
  readonly changedSince: boolean
  /** Contenu actuel du disque, fourni seulement si `changedSince` (la différence se calcule alors sur le disque). */
  readonly current: string | null
  /** Le retour en arrière a été appliqué : le disque est revenu à l'état d'avant. */
  readonly reverted: boolean
}

/** Événement du fil d'une exécution : jamais de contenu de fichier. */
export interface ExecutionEventView {
  readonly at: string
  readonly kind: 'lecture' | 'ecriture' | 'refus' | 'message' | 'commande'
  readonly path: string | null
  readonly detail: string | null
}

export interface ExecutionView {
  readonly id: string
  readonly startedAt: string
  readonly endedAt: string | null
  readonly outcome: 'terminee' | 'arretee' | 'interrompue' | 'echouee' | null
  /** Phrase de correction de mentalyas ; `null` : exécution initiale. */
  readonly correction: string | null
  readonly filesWritten: number
  readonly events: readonly ExecutionEventView[]
}

/** Revue d'un livrable (spec 013 US3) : fichiers avec leurs différences, dernières exécutions avec leur fil. */
export interface DeliverableDetailView {
  readonly neuronId: string
  readonly state: FinalState
  /** L'étape est « fait » : le livrable a été accepté. */
  readonly accepted: boolean
  readonly files: readonly DeliverableDetailFileView[]
  /** Les plus récentes d'abord (5 au plus). */
  readonly executions: readonly ExecutionView[]
}

/** Éditeur pour « Ouvrir dans l'éditeur » (spec 013 D4) : réglé, et ceux trouvés sur la machine. */
export interface EditorSettingsView {
  readonly current: { readonly kind: 'vscode' | 'notepadpp' | 'other'; readonly program: string } | null
  readonly detected: readonly { readonly kind: 'vscode' | 'notepadpp'; readonly name: string }[]
}

/** Choix d'un éditeur : un éditeur détecté, ou un autre programme choisi dans un dialogue natif. */
export const EDITOR_CHOICES = ['vscode', 'notepadpp', 'browse'] as const
export type EditorChoice = (typeof EDITOR_CHOICES)[number]

/** Livrable d'une action finale : annexe sous l'action sur la carte (spec 013 FR-008). */
export interface DeliverableView {
  readonly neuronId: string
  readonly genesisId: string
  readonly files: readonly DeliverableFileView[]
  readonly executing: boolean
  readonly width: number
  readonly height: number
  /** Décalage manuel (glissé) par rapport à sa place d'annexe sous l'action. */
  readonly offset: { readonly x: number; readonly y: number }
}
