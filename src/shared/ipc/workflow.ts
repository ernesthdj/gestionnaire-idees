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

/** État d'une tâche (D21) : `- [ ]`, `- [~]`, `- [x]`. */
export const TASK_STATES = ['todo', 'doing', 'done'] as const
export type TaskState = (typeof TASK_STATES)[number]

export interface TaskView {
  /** `T032` ; vide pour une tâche d'un fichier de tâches qui n'en porte pas. */
  readonly id: string
  readonly done: boolean
  readonly state: TaskState
  /** Clé stable d'une tâche d'un fichier de tâches (D20) ; absente dans un `tasks.md` (clé tirée de `id`). */
  readonly key?: string
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

/** Groupe (`###`) ou lot (`##`) d'un fichier de tâches (D20). */
export interface TaskGroupView {
  readonly key: string
  readonly title: string
  /** Tâches placées directement sous ce titre. */
  readonly tasks: readonly TaskView[]
  /** Sous-groupes (`###`) d'un lot ; toujours vide pour un groupe. */
  readonly groups: readonly TaskGroupView[]
  readonly done: number
  readonly total: number
  readonly status: SpecStatus
}

/** Fichier Markdown de tâches du projet (D20) : une branche de la vue Workflow. */
export interface TaskFileView {
  readonly key: string
  /** Chemin relatif : `docs/USER-STORIES.md`. */
  readonly path: string
  readonly title: string
  /** Tâches avant le premier `##`. */
  readonly tasks: readonly TaskView[]
  /** Lots (`##`). */
  readonly lots: readonly TaskGroupView[]
  readonly done: number
  readonly total: number
  readonly status: SpecStatus
  /** Fichier tronqué (trop de tâches) ou illisible. */
  readonly partial: boolean
}

/** Idée à brainstormer (D11) : un document de niveau 1 qu'aucune spec ne cite, hors fondation. */
export const isToBrainstorm = (doc: BrainstormDocView): boolean =>
  doc.level === 1 && doc.coveredBy.length === 0 && doc.name !== 'L1-fondation.md'

export interface WorkflowView {
  readonly genesisId: string
  readonly foundation: { readonly path: string; readonly summary: string } | null
  readonly specs: readonly SpecView[]
  readonly brainstorm: readonly BrainstormDocView[]
  /** Fichiers de tâches du projet, hors Spec Kit (D20). */
  readonly taskFiles: readonly TaskFileView[]
  /** Écarts au repli par défaut, par clé de nœud (research R6, R7). */
  readonly folded: Readonly<Record<string, boolean>>
  /** Ni `specs/`, ni `docs/brainstorm/`, ni fichier de tâches. */
  readonly empty: boolean
  /** Chemins cités par des tâches qui n'existent pas (ou plus) dans le dossier du projet : listés grisés (FR-012). */
  readonly missingFiles: readonly string[]
  readonly readAt: string
}

/** Méthode, fonction, classe… d'un fichier, repérée par l'analyse syntaxique (tree-sitter) pour le lecteur. */
export interface WorkflowSymbolView {
  readonly name: string
  readonly kind: 'namespace' | 'class' | 'interface' | 'function' | 'method'
  readonly startLine: number
  readonly endLine: number
}

/** Bloc d'un fichier dans son anatomie (spec 023 D14, R10) : classe, interface, fonction ou méthode. */
export interface WorkflowBlockView {
  /** Rang dans le fichier ; `parent` et les appels y renvoient. */
  readonly id: number
  /** Classe ou interface englobante. */
  readonly parent: number | null
  readonly kind: WorkflowSymbolView['kind']
  readonly name: string
  readonly startLine: number
  readonly endLine: number
  /** Complexité cyclomatique approchée (1 + branches). */
  readonly complexity: number
  /** Offert aux autres fichiers (R11). */
  readonly exported: boolean
  /** Ni offert, ni appelé dans le fichier, ni parent d'un bloc utile (R12) : « peut-être inutilisé ». */
  readonly maybeUnused: boolean
  /** Ce que fait le bloc : première phrase de son commentaire (R15), texte seulement ; `null` sans commentaire. */
  readonly doc: string | null
}

/** Appel d'un bloc du fichier vers un autre, reconnu par le nom (R12). */
export interface WorkflowCallView {
  readonly from: number
  readonly to: number
  /** Première ligne de l'appel. */
  readonly line: number
  /** Plusieurs blocs portent ce nom : l'appel est relié à chacun. */
  readonly ambiguous: boolean
}

/** Anatomie d'un fichier pour le schéma du lecteur (`workflow:anatomy`, spec 023 US5). */
export interface WorkflowAnatomyView {
  readonly blocks: readonly WorkflowBlockView[]
  /** Sources d'import regroupées : module, nombre de noms importés, première ligne. */
  readonly imports: readonly { readonly source: string; readonly names: number; readonly line: number }[]
  readonly calls: readonly WorkflowCallView[]
  /** Une borne a coupé des blocs, des imports ou des appels. */
  readonly truncated: boolean
}

/** « Que fait ce fichier ? » (`workflow:summary`, spec 023 D15) : expliqué par Claude, ou le modèle local. */
export interface WorkflowFileSummaryView {
  readonly role: string
  readonly receives: string
  readonly produces: string
  /** Morceaux importants, dans l'ordre de lecture ; seuls les blocs qui existent dans le fichier sont gardés. */
  readonly parts: readonly {
    readonly name: string
    readonly why: string
    readonly startLine: number
    readonly endLine: number
  }[]
  /**
   * Petit schéma : flèches entre `in` (ce qu'il reçoit), les morceaux (par leur nom) et `out` (ce qu'il produit) ;
   * seuls les liens dont les deux bouts existent sont gardés.
   */
  readonly flow: readonly { readonly from: string; readonly to: string; readonly label: string }[]
  readonly engine: 'claude' | 'ollama'
  readonly model: string
}

/** Explication enregistrée d'un fichier (`workflow:savedSummary`, D18) : aucune IA n'est appelée pour la lire. */
export interface WorkflowSavedSummaryView {
  /** L'explication, si elle correspond au contenu actuel du fichier. */
  readonly summary: WorkflowFileSummaryView | null
  /** Une explication existe, mais le code a changé depuis. */
  readonly outdated: boolean
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
