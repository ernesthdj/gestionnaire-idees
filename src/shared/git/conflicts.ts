import { z } from 'zod'
import { RelPath } from './model'

// Résolution d'un conflit (spec 021 US4, L3 conflits §1).

export type ConflictKind = 'content' | 'delete_modify' | 'add_add' | 'binary'
export type HunkChoice = 'ours' | 'theirs' | 'both' | 'claude' | 'manual'

export interface MergeStateView {
  /** Branche courante (« main »). */
  readonly into: string
  /** Ce qui est fusionné (« origin/main »). */
  readonly from: string
  readonly files: readonly {
    readonly path: string
    readonly kind: ConflictKind
    readonly state: 'unresolved' | 'resolved'
  }[]
  readonly startedAt: string
}

export interface ConflictHunkView {
  readonly index: number
  readonly base: string | null
  readonly ours: string
  readonly theirs: string
  readonly contextBefore: string
  readonly contextAfter: string
  readonly proposal?: {
    readonly text: string
    readonly explanation: string
    readonly confidence: 'sure' | 'check'
    /** Lignes de la proposition absentes des deux versions (surlignées). */
    readonly newLines: readonly number[]
  }
  readonly decision?: HunkChoice
  readonly manualText?: string
}

export interface ConflictFileView {
  readonly path: string
  readonly kind: ConflictKind
  readonly hunks: readonly ConflictHunkView[]
  readonly preview: string
  readonly previewHash: string
  /** Projet « Local uniquement » : aucune proposition de Claude. */
  readonly localOnly: boolean
}

const genesisId = z.uuid()
export const ConflictPathInput = z.strictObject({ genesisId, path: RelPath })
export const ConflictDecideInput = z.strictObject({
  genesisId,
  path: RelPath,
  hunkIndex: z.number().int().min(0).max(1000),
  choice: z.enum(['ours', 'theirs', 'both', 'claude', 'manual']),
  manualText: z.string().max(200_000).optional()
})
export const ConflictResolveInput = z.strictObject({
  genesisId,
  path: RelPath,
  expectedPreviewHash: z.string().regex(/^[0-9a-f]{32}$/),
  confirm: z.literal(true)
})
export const ConflictWholeFileInput = z.strictObject({
  genesisId,
  path: RelPath,
  choice: z.enum(['ours', 'theirs', 'delete']),
  confirm: z.literal(true)
})
export const MergeFinishInput = z.strictObject({
  genesisId,
  message: z.string().max(5_000).optional(),
  confirm: z.literal(true)
})
