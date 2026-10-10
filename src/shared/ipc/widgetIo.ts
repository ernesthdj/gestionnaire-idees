import type { StepStatus } from './canvas'
import type { Nature, RootState } from './neurons'

/**
 * Entrées des widgets (spec 005, spec 015) : ce qu'une idée (genesis) ou une étape de plan transmet à un widget
 * branché. L'ancienne « prochaine étape » d'un document éclos (`step`) reste lisible, mais ne se crée plus.
 */

/** Parties d'une idée transmissibles (spec 015 US3) : toutes cochées au branchement, décochables. */
export const IDEA_PARTS = ['identity', 'sheet', 'plan', 'annexes'] as const
export type IdeaPart = (typeof IDEA_PARTS)[number]

export const IDEA_PART_LABELS: Readonly<Record<IdeaPart, string>> = {
  identity: 'Titre, nature, catégorie, état et texte d’origine',
  sheet: 'Fiche',
  plan: 'Plan d’attaque (étapes, rangs et statuts)',
  annexes: 'Documents annexés'
}

/** Parties d'une étape de plan transmissibles (spec 015 US2) : son contexte complet. */
export const STEP_PARTS = ['identity', 'sheet', 'path', 'subtree'] as const
export type StepPart = (typeof STEP_PARTS)[number]

export const STEP_PART_LABELS: Readonly<Record<StepPart, string>> = {
  identity: 'Titre, rang, statut, raison et action finale',
  sheet: 'Fiche de l’étape',
  path: 'Chemin depuis le genesis (titres et fiches)',
  subtree: 'Sous-étapes, documents annexés et fichiers du livrable'
}

export type InputPart = IdeaPart | StepPart
/** Toutes les parties connues (validation des entrées ; la nature de la source décide de celles qui comptent). */
export const INPUT_PARTS = [
  'identity',
  'sheet',
  'plan',
  'annexes',
  'path',
  'subtree'
] as const satisfies readonly InputPart[]

/**
 * Nature d'une source : idée, étape de plan, élément d'une carte de structure, nœud de la vue Workflow (spec 023 D24),
 * ou ancienne prochaine étape (archive).
 */
export type InputSourceKind = 'idea' | 'plan_step' | 'element' | 'workflow' | 'step'

/** Branchement d'entrée : une idée ou une étape de plan reliée à un widget. */
export interface WidgetInputView {
  readonly id: string
  readonly blockId: string
  readonly sourceKind: InputSourceKind
  /** Idée, étape de plan, ou idée dont l'ancienne prochaine étape est branchée. */
  readonly sourceId: string
  /** Titre de la source ; `null` si elle n'existe plus (l'entrée est alors vide). */
  readonly title: string | null
  /** Rang d'une étape (« 1.2 ») ; `null` pour une idée. */
  readonly label: string | null
  /** Parties transmises (toujours vide pour une ancienne prochaine étape : elle n'a qu'un texte). */
  readonly parts: readonly InputPart[]
}

/** État des entrées d'un widget, pour sa version affichée. */
export interface WidgetIoStateView {
  readonly blockId: string
  readonly inputs: readonly WidgetInputView[]
  /** La version affichée a été autorisée à recevoir exactement ces entrées (FR-002). */
  readonly approved: boolean
}

/** Trait de la carte entre une source et son widget. */
export interface IoLinkView {
  readonly id: string
  readonly blockId: string
  readonly sourceKind: InputSourceKind
  readonly sourceId: string
}

/** Fiche d'un neurone (spec 010) telle que transmise à un widget. */
export interface SheetData {
  readonly resume: string
  readonly points_cles: readonly string[]
  readonly decisions: readonly string[]
  readonly questions_ouvertes: readonly string[]
  readonly manques: readonly string[]
}

/** Étape d'un plan, dans un arbre transmis (rang lisible « 1.2.3 »). */
export interface PlanStepData {
  readonly id: string
  readonly parentId: string
  readonly label: string
  readonly title: string
  readonly status: StepStatus
  readonly final?: { readonly deliverable: string; readonly state: string }
}

/** Document Markdown annexé (spec 012) ; `missing` : fichier disparu, dernière version connue. */
export interface DocumentData {
  readonly title: string
  readonly content: string
  readonly missing?: true
}

/** Ce que reçoit le widget dans `gi.inputs` : seules les parties cochées sont présentes. */
export type WidgetInputData =
  | {
      readonly kind: 'idea'
      readonly id: string
      readonly title?: string
      readonly nature?: Nature
      readonly category?: string | null
      readonly state?: RootState
      readonly originalText?: string
      readonly sheet?: SheetData
      readonly plan?: readonly PlanStepData[]
      readonly annexes?: { readonly documents: readonly DocumentData[] }
      /** Contexte réduit pour tenir dans la borne (spec 015 R2). */
      readonly truncated?: true
    }
  | {
      readonly kind: 'plan_step'
      readonly id: string
      readonly genesisId: string
      readonly title?: string
      readonly label?: string
      readonly rank?: number
      readonly depth?: number
      readonly status?: StepStatus
      readonly why?: string | null
      readonly final?: { readonly deliverable: string; readonly state: string } | null
      readonly sheet?: SheetData
      /** Genesis d'abord, puis les étapes parentes jusqu'à la parente directe. */
      readonly path?: readonly {
        readonly id: string
        readonly kind: 'genesis' | 'step'
        readonly label: string | null
        readonly title: string
        readonly sheet: SheetData
      }[]
      readonly subtree?: {
        readonly steps: readonly PlanStepData[]
        readonly documents: readonly DocumentData[]
        readonly deliverable: readonly { readonly path: string; readonly status: 'cree' | 'modifie' }[]
      }
      readonly truncated?: true
    }
  | {
      /** Élément d'une carte de structure (spec 023 D24) : tout son contexte, sans parties à cocher. */
      readonly kind: 'element'
      readonly id: string
      readonly genesisId: string
      readonly title: string
      /** Module, composant, donnée, interface… */
      readonly type: string
      readonly summary: string | null
      /** Fichiers et dossiers du projet qu'il couvre. */
      readonly paths: readonly string[]
      readonly sheet: SheetData
      /** Éléments parents, du plus haut au plus proche. */
      readonly path: readonly { readonly id: string; readonly title: string; readonly type: string }[]
    }
  | {
      /** Nœud de la vue Workflow (spec 023 D24), relu dans les fichiers du projet à chaque demande. */
      readonly kind: 'workflow'
      readonly key: string
      readonly genesisId: string
      readonly node: 'file' | 'group' | 'task' | 'spec' | 'story' | 'socle'
      readonly title: string
      /** État d'une tâche (`todo`, `doing`, `done`) ou statut d'un fichier, d'un lot, d'une spec. */
      readonly state: string
      /** Fichier de méthode où il vit (`docs/USER-STORIES.md`, `specs/022-x/tasks.md`). */
      readonly file: string
      /** Lot, groupe, user story ou spec qui le contient ; `null` au premier niveau. */
      readonly section: string | null
      /** Chemins de code cités par ses tâches. */
      readonly files: readonly string[]
      /** Ses tâches (groupe, fichier, spec, user story) ; vide pour une tâche. */
      readonly tasks: readonly { readonly id: string; readonly text: string; readonly state: string }[]
      readonly truncated?: true
    }
  | { readonly kind: 'step'; readonly ideaId: string; readonly ideaTitle: string; readonly text: string }

/** Réponse de `widgetIo:emit` : cadre résultat du widget, créé à la première émission (FR-006). */
export interface WidgetEmitView {
  readonly resultBlockId: string
  readonly created: boolean
}

/** Dernier résultat d'un widget, affiché par son cadre résultat. */
export interface WidgetResultView {
  /** Cadre résultat. */
  readonly blockId: string
  readonly widgetBlockId: string
  /** Titre de la version affichée du widget ; `null` s'il n'en a plus. */
  readonly widgetTitle: string | null
  readonly data: unknown
  readonly updatedAt: string
}

/** Ce que reçoit le cadre résultat dans `gi.inputs` : le résultat de son widget, rien d'autre. */
export interface ResultFrameInput {
  readonly kind: 'result'
  readonly data: unknown
}

/** Réponse de `widgetIo:inputs` : rien n'est transmis tant que la version n'est pas autorisée. */
export interface WidgetInputsView {
  readonly approved: boolean
  readonly inputs: readonly WidgetInputData[]
}
