import { z } from 'zod'

// Extraire un morceau d'un projet open source (spec 021 US7, contracts git:extractPreview / git:extract).

export interface ExtractPreviewView {
  /** Dépôt d'origine, sans identifiant. */
  readonly origin: string
  readonly commit: string
  readonly license: {
    readonly spdx: string | null
    readonly verdict: 'permise' | 'reciprocite' | 'inconnue'
    readonly summary: string
  }
  /** En-tête d'attribution ajouté en tête du fichier copié (vide si seule la note d'étude est possible). */
  readonly header: string
  readonly destinations: readonly { readonly root: 'snippets' | 'techno'; readonly folders: readonly string[] }[]
  readonly studyNoteOnly: boolean
}

/** Chemin relatif d'un fichier du dépôt (`/`), jamais absolu ni remontant. */
const RelPath = z
  .string()
  .min(1)
  .max(1_000)
  .refine((path) => !/^([a-zA-Z]:|\/)/.test(path) && !path.split(/[/\\]/).includes('..'), 'chemin relatif')
const Lines = z
  .strictObject({ from: z.number().int().min(1).max(1_000_000), to: z.number().int().min(1).max(1_000_000) })
  .optional()

export const ExtractPreviewInput = z.strictObject({ genesisId: z.uuid(), path: RelPath, lines: Lines })
export const ExtractInput = z.strictObject({
  genesisId: z.uuid(),
  path: RelPath,
  lines: Lines,
  root: z.enum(['snippets', 'techno']),
  folder: z.string().regex(/^[a-z0-9-]{1,40}$/),
  fileName: z.string().regex(/^[A-Za-z0-9._-]{1,100}$/),
  mode: z.enum(['copy', 'study_note']),
  confirm: z.literal(true)
})
