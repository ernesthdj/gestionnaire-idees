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
