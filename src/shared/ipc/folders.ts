import type { DocumentView } from './documents'
import { languageOf } from '../files/language'

/** Vues IPC du dossier d'un nœud (spec 028 data-model). Aucun chemin absolu : seulement des chemins relatifs. */

/**
 * Dossiers des nœuds (spec 028) : **désactivés** le 2026-10-12 par mentalyas (« jolis mais inutiles sur les nœuds, déjà
 * autosuffisants avec leur lecteur intégré ; à réutiliser plus tard pour un autre besoin »). Coupé, l'app se comporte
 * comme avant la spec 028 : documents dessinés en nœuds (spec 012), `document_ecrire` pour un genesis ou une étape,
 * aucun dossier ni rangement. Le code, ses tests et les migrations 0047-0048 restent prêts à être rallumés ici.
 */
export const FOLDERS_ENABLED = false

/** Sorte d'un fichier du dossier (filtre de « Tout voir », spec 028 R1 de DN-3). */
export type FolderFileKind = 'doc' | 'code' | 'other'
/** D'où vient un fichier du dossier (spec 028 D2) ; une seule source par fichier, la plus forte. */
export type FolderSource = 'document' | 'manual' | 'conversation' | 'covered'

/** Fichiers montrés en éventail quand le dossier s'ouvre (spec 028 D3). */
export const FOLDER_PREVIEW_MAX = 4
/** Bornes du décalage d'un dossier glissé (comme un document). */
export const FOLDER_OFFSET_MAX = 10_000

const DOC_EXTENSIONS = new Set(['md', 'markdown', 'txt', 'pdf'])

/** Docs : `.md`, `.txt`, `.pdf` ; Code : langages du lecteur ; Autres : le reste. */
export function folderFileKind(path: string): FolderFileKind {
  const name = path.split('/').pop() ?? ''
  const dot = name.lastIndexOf('.')
  const extension = dot <= 0 ? '' : name.slice(dot + 1).toLowerCase()
  if (DOC_EXTENSIONS.has(extension)) return 'doc'
  return languageOf(path) === null ? 'other' : 'code'
}

export interface FolderFileView {
  /** Chemin relatif lisible (`docs/brainstormer/cours.md`, `src/bilan.ts`). */
  readonly path: string
  readonly name: string
  readonly kind: FolderFileKind
  readonly source: FolderSource
  /** Dernière écriture connue (ISO). */
  readonly updatedAt: string
  /** Ajouté ou modifié par Claude depuis la dernière ouverture du dossier. */
  readonly unseen: boolean
  /** Document rédigé par Claude ou mentalyas (spec 012) : ce qu'il faut à son lecteur. */
  readonly document?: DocumentView
}

/** Nœud de la carte qui porte le dossier : un neurone, ou un nœud de la vue Workflow (clé `wf:`). */
export type FolderAnchor =
  | { readonly kind: 'neuron'; readonly id: string }
  | { readonly kind: 'workflow'; readonly key: string; readonly genesisId: string }

/** Dossier d'un nœud, tel que la carte le dessine (spec 028 D1, D3, D6). */
export interface FolderBadge {
  /** Neurone qui porte le dossier (et sa conversation). */
  readonly neuronId: string
  readonly anchor: FolderAnchor
  readonly count: number
  /** Au moins un fichier « nouveau ». */
  readonly unseen: boolean
  /** Les plus récents, documents d'abord, `FOLDER_PREVIEW_MAX` au plus. */
  readonly preview: readonly FolderFileView[]
  /** Décalage glissé par rapport à la place par défaut. */
  readonly offset: { readonly x: number; readonly y: number }
  /** Glissé par mentalyas : « Réorganiser » ne le replace pas. */
  readonly moved: boolean
}
