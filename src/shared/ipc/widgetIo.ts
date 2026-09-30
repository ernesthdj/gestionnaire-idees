import type { HatchedResultView, Nature, NeuronKind, RootState } from './neurons'

/** Entrées des widgets (spec 005) : ce qu'une idée ou une prochaine étape transmet à un widget branché. */

/** Parties d'une idée transmissibles à un widget (FR-003) : toutes cochées au branchement, décochables. */
export const IDEA_PARTS = ['identity', 'original', 'answers', 'tree', 'document'] as const
export type IdeaPart = (typeof IDEA_PARTS)[number]

export const IDEA_PART_LABELS: Readonly<Record<IdeaPart, string>> = {
  identity: 'Titre, nature, catégorie et état',
  original: 'Texte d’origine',
  answers: 'Questions et réponses',
  tree: 'Sous-neurones (arbre)',
  document: 'Document éclos et prochaine étape'
}

export type InputSourceKind = 'idea' | 'step'

/** Branchement d'entrée : une idée ou une prochaine étape reliée à un widget. */
export interface WidgetInputView {
  readonly id: string
  readonly blockId: string
  readonly sourceKind: InputSourceKind
  /** Idée branchée, ou idée dont la prochaine étape est branchée. */
  readonly sourceId: string
  /** Titre de l'idée ; `null` si elle n'existe plus (l'entrée est alors vide). */
  readonly title: string | null
  /** Parties transmises (toujours vide pour une étape : elle n'a qu'un texte). */
  readonly parts: readonly IdeaPart[]
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
      readonly answers?: readonly { readonly question: string; readonly answer: string }[]
      readonly tree?: readonly {
        readonly id: string
        readonly parentId: string | null
        readonly kind: NeuronKind
        readonly title: string
        readonly content: string | null
        readonly amountCents: number | null
        readonly dueDate: string | null
      }[]
      readonly document?: HatchedResultView | null
      readonly nextStep?: string | null
    }
  | { readonly kind: 'step'; readonly ideaId: string; readonly ideaTitle: string; readonly text: string }

/** Réponse de `widgetIo:inputs` : rien n'est transmis tant que la version n'est pas autorisée. */
export interface WidgetInputsView {
  readonly approved: boolean
  readonly inputs: readonly WidgetInputData[]
}
