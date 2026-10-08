import type { CodeLang } from './reprise'

/**
 * Vue Workflow d'un projet lié (spec 023) : ses specs, user stories et tâches, lues par l'app dans les fichiers du
 * projet (`specs/*`, `docs/brainstorm/*`, `docs/FOUNDATION.md`), en lecture seule. Voir `data-model.md`.
 */

/** Marqueur posé dans la ligne `**Status**` d'une spec ; il prime sur le calcul (D7). */
export const SPEC_MARKERS = ['delivered', 'paused', 'abandoned'] as const
export type SpecMarker = (typeof SPEC_MARKERS)[number]

export const SPEC_STATUSES = ['specified', 'planned', 'active', 'paused', 'delivered', 'abandoned'] as const
export type SpecStatus = (typeof SPEC_STATUSES)[number]

export interface TaskView {
  /** `T032`. */
  readonly id: string
  readonly done: boolean
  /** Numéro de la user story (`[US2]` → 2) ; `null` pour une tâche du socle. */
  readonly story: number | null
  /** Description, sans case ni étiquettes. */
  readonly text: string
  /** Chemins de fichiers relatifs cités par la tâche. */
  readonly files: readonly string[]
}

export interface StoryView {
  readonly number: number
  readonly title: string
  /** P1 → 1 ; `null` si la spec ne la donne pas. */
  readonly priority: number | null
  /** Décrite dans `spec.md` (sinon seulement citée par des tâches). */
  readonly described: boolean
  readonly tasks: readonly TaskView[]
  readonly done: number
  readonly total: number
  readonly delivered: boolean
  /** Union des chemins cités par ses tâches. */
  readonly files: readonly string[]
}

export interface SpecView {
  /** `"022"`. */
  readonly number: string
  /** `specs/022-noeuds-vivants`. */
  readonly dir: string
  readonly title: string
  readonly statusLine: string | null
  readonly marker: SpecMarker | null
  readonly status: SpecStatus
  readonly createdAt: string | null
  readonly decisions: number
  readonly stories: readonly StoryView[]
  /** Tâches sans user story (mise en place, fondations, finitions). */
  readonly socle: readonly TaskView[]
  readonly done: number
  readonly total: number
  /** Tâches non cochées d'une spec marquée livrée ou abandonnée. */
  readonly leftovers: readonly TaskView[]
  /** Documents de brainstorm (`L*.md`) cités par `spec.md`. */
  readonly citedDocs: readonly string[]
  /** Fichier trop gros, illisible ou sans structure reconnue : affiché avec ce qui a pu être lu. */
  readonly partial: boolean
}

export interface BrainstormDocView {
  /** `L1j-carte-workflow.md`. */
  readonly name: string
  readonly level: number
  readonly title: string
  /** L1 de rattachement d'un L2–L4 (nom du fichier) ; `null` sans famille (et pour un L1). */
  readonly family: string | null
  /** Numéros des specs qui citent ce document. */
  readonly coveredBy: readonly string[]
}

export interface WorkflowView {
  readonly genesisId: string
  readonly foundation: { readonly path: string; readonly summary: string } | null
  readonly specs: readonly SpecView[]
  readonly brainstorm: readonly BrainstormDocView[]
  /** Écarts au repli par défaut, par clé de nœud (research R6, R7). */
  readonly folded: Readonly<Record<string, boolean>>
  /** Ni `specs/` ni `docs/brainstorm/`. */
  readonly empty: boolean
  readonly readAt: string
}

/** Fichier lu pour le lecteur d'une carte Workflow (`workflow:file`). */
export interface WorkflowFileView {
  readonly path: string
  readonly lang: CodeLang
  readonly lines: readonly string[]
}

/**
 * Clé stable d'un nœud de la vue Workflow (research R7) : `wf:<genesisId>:<sorte>[:<numéro>[:<identifiant>]]`, par
 * exemple `wf:…:branch:active`, `wf:…:spec:022`, `wf:…:story:022:2`, `wf:…:task:022:T032`, `wf:…:doc:L1j-carte-workflow`.
 */
export const WORKFLOW_KEY = /^wf:[0-9a-f-]{36}:[a-z]+(?::[\w.-]{1,80}){0,2}$/
