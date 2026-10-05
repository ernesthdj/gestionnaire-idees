/** Vues IPC des documents Markdown (spec 012 contracts/interfaces.md). */

/** Bornes du cadre d'un nœud document (spec 012 D3). */
export const DOCUMENT_SIZE_LIMITS = { minWidth: 280, minHeight: 160, maxWidth: 1200, maxHeight: 1600 } as const

/** Document sur la carte, rattaché à un neurone (genesis ou étape). */
export interface DocumentView {
  readonly id: string
  readonly neuronId: string
  readonly genesisId: string
  readonly title: string
  /** Emplacement lisible : `docs/brainstormer/x.md` (projet lié) ou `documents/x.md` (profil). */
  readonly fileLabel: string
  readonly width: number
  readonly height: number
  readonly origin: 'user' | 'claude'
  /** Décalage manuel (glissé) par rapport à sa place d'annexe sous son neurone. */
  readonly offset: { readonly x: number; readonly y: number }
}

/** Contenu actuel du fichier ; `missing` : fichier introuvable, contenu de la dernière version connue. */
export interface DocumentContentView {
  readonly id: string
  readonly content: string
  readonly hash: string
  readonly missing: boolean
}
