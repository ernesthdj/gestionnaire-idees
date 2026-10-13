import { z } from 'zod'
import { Hash, type AuthorView, type GitCommitView } from './model'

// « Qui a fait quoi et quand » (spec 021 US5, lot 1).

export interface HistoryView {
  readonly commits: readonly GitCommitView[]
  /** Auteurs affichés (identités fusionnées regroupées sous leur principale). */
  readonly authors: readonly AuthorView[]
  /** Identités rattachées à une autre (« Séparer »). */
  readonly merged: readonly { readonly key: string; readonly mainKey: string; readonly name: string }[]
  /** D'autres commits plus anciens existent (« Charger plus »). */
  readonly more: boolean
}

export interface StoryView {
  /** Récit avec pseudonymes (« Auteur A ») ; l'interface les remplace par les vrais noms. */
  readonly text: string
  /** Pseudonyme → clé d'auteur. */
  readonly names: Readonly<Record<string, string>>
  readonly commits: number
}

const genesisId = z.uuid()
const AuthorKey = z.string().regex(/^[0-9a-f]{16}$/)
export const HistoryInput = z.strictObject({
  genesisId,
  skip: z.number().int().min(0).max(1_000_000),
  limit: z.number().int().min(1).max(5_000)
})
export const MergeAuthorsInput = z.strictObject({
  genesisId,
  mainKey: AuthorKey,
  aliasKeys: z.array(AuthorKey).min(1).max(20)
})
export const UnmergeAuthorInput = z.strictObject({ genesisId, aliasKey: AuthorKey })
export const StoryInput = z.strictObject({ genesisId, from: Hash, to: Hash })

// Rediffusion sur l'explorateur (spec 021 US5 lot 2, research R13).

/** `lines` : lignes modifiées (dépôt complet) ; `commits` : nombre de commits (clone partiel, D12). */
export type ReplayWeight = 'lines' | 'commits'

export interface ReplayStepsView {
  /** Du plus ancien au plus récent (les 5 000 derniers au plus). */
  readonly commits: readonly { readonly hash: string; readonly date: string; readonly authorKey: string }[]
  readonly authors: readonly AuthorView[]
  readonly weight: ReplayWeight
  /** D'autres commits plus anciens ne sont pas rejoués. */
  readonly more: boolean
}

export interface NodeReplayView {
  readonly key: string
  readonly main: string
  readonly last: string
  readonly shares: readonly { readonly authorKey: string; readonly percent: number }[]
}

/** Clé de nœud de l'explorateur (spec 017) : `m:`, `d:`, `f:`, `s:`, ou `r:` + clé. */
const ExplorerKey = z
  .string()
  .max(2000)
  .refine((key) => /^(r:)?[mdfs]:/.test(key), 'clé de nœud')
export const ReplayStepsInput = z.strictObject({ genesisId })
export const ReplayInput = z.strictObject({ genesisId, at: Hash, keys: z.array(ExplorerKey).max(500) })
export const FetchAllInput = z.strictObject({ genesisId, confirm: z.literal(true) })
