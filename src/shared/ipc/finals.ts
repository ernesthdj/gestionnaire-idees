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

/** Dernier lancement d'un script approuvé pendant les exécutions de l'action (spec 013 D2 bis). */
export interface DeliverableRunView {
  readonly script: string
  readonly ok: boolean
  readonly timedOut: boolean
  readonly at: string
}

/** Scripts du projet lié et leur approbation (volet de l'action). */
export interface ProjectScriptView {
  readonly name: string
  readonly text: string
  readonly approved: boolean
  /** Approuvé mais modifié depuis : à réapprouver. */
  readonly changed: boolean
}

export interface ProjectCommandsView {
  readonly linked: boolean
  readonly packageJson: boolean
  readonly scripts: readonly ProjectScriptView[]
}

/** Livrable d'une action finale : annexe sous l'action sur la carte (spec 013 FR-008). */
export interface DeliverableView {
  readonly neuronId: string
  readonly genesisId: string
  readonly files: readonly DeliverableFileView[]
  /** Dernier résultat de chaque script lancé (tests, compilation…). */
  readonly runs: readonly DeliverableRunView[]
  readonly executing: boolean
  readonly width: number
  readonly height: number
  /** Décalage manuel (glissé) par rapport à sa place d'annexe sous l'action. */
  readonly offset: { readonly x: number; readonly y: number }
}
