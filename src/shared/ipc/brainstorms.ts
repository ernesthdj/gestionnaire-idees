import { z } from 'zod'
import { ViewStateSchema, type ViewState } from '../brainstorms/viewState'
import { PROJECT_LIMITS, PROJECT_TYPES, type ProjectType } from './projects'

// Contrats IPC du Project Manager (spec 024 US1, US3 ; contracts/interfaces.md).

export type BrainstormLocation = 'vault' | 'external' | 'local'

/**
 * Une ligne du Project Manager : un brainstorm déjà travaillé dans l'app, ou un projet du registre du coffre jamais
 * ouvert dans l'app (`id` nul : son brainstorm naît à la première ouverture).
 */
export interface BrainstormListItem {
  readonly id: string | null
  readonly slug: string
  readonly name: string
  readonly description: string
  readonly type: string | null
  readonly location: BrainstormLocation
  /** Dossier du projet (affiché) ; `null` pour un brainstorm sans dossier. */
  readonly folder: string | null
  readonly folderMissing: boolean
  readonly branch: string | null
  /** Dernière ouverture dans l'app, sinon dernière session du registre (ISO). */
  readonly lastSession: string | null
  /** Une session `/hub` est ouverte sur ce projet (terminal ou `pm.bat`). */
  readonly openSession: boolean
  /** Dernier brainstorm ouvert dans l'app : « Reprendre ». */
  readonly last: boolean
}

export interface BrainstormView {
  readonly id: string
  readonly slug: string
  readonly name: string
  readonly description: string
  readonly location: BrainstormLocation
  readonly folder: string | null
  /** Genesis du projet (nœud de départ), s'il en a un. */
  readonly genesisId: string | null
}

/** Ce que `/hub work` signale à l'ouverture (spec 024 US1 scénario 4) ; aucune action sans clic. */
export type HubAnomaly =
  | { readonly kind: 'session_here'; readonly since: string }
  | { readonly kind: 'session_elsewhere'; readonly slug: string; readonly since: string }
  | { readonly kind: 'uncommitted'; readonly count: number }
  | { readonly kind: 'unpushed'; readonly count: number }
  | { readonly kind: 'behind'; readonly count: number }

export interface BrainstormOpenView {
  readonly brainstorm: BrainstormView
  readonly viewState: ViewState | null
  readonly anomalies: readonly HubAnomaly[]
  /** Titres des dernières entrées du JOURNAL du projet (les plus récentes d'abord). */
  readonly journal: readonly string[]
}

export const BRAINSTORM_SLUG = z.string().min(2).max(50)

export const BrainstormOpenInput = z.union([
  z.strictObject({ id: z.uuid() }),
  z.strictObject({ slug: BRAINSTORM_SLUG })
])

export const BrainstormViewStateInput = z.strictObject({ id: z.uuid(), state: ViewStateSchema })

export const BrainstormScratchInput = z.strictObject({
  name: z.string().min(1).max(PROJECT_LIMITS.name),
  slug: BRAINSTORM_SLUG,
  description: z.string().max(PROJECT_LIMITS.description),
  type: z.enum(PROJECT_TYPES),
  /** Dépôt GitHub : pas encore (spec 021 lot B) ; refusé côté main tant qu'il n'existe pas. */
  github: z.boolean()
})

export interface BrainstormScratch {
  readonly name: string
  readonly slug: string
  readonly description: string
  readonly type: ProjectType
  readonly github: boolean
}

/** Résultat d'une création de zéro : l'avertissement dit ce qui n'a pas pu se faire (ex. premier commit). */
export interface BrainstormCreatedView {
  readonly id: string
  readonly warning: string | null
}
