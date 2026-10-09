import { z } from 'zod'
import { BranchName, GIT_LIMITS, Hash, RelPath } from '../git/model'

/**
 * Entrées des canaux `git:*` (spec 021, contracts/interfaces.md), validées dans le main. Seulement un genesis, des
 * chemins relatifs, des noms de branche, des empreintes : jamais de chemin absolu ni d'adresse. Les écritures portent
 * `confirm: true` et l'état que mentalyas a vu (research R5).
 */
const genesisId = z.uuid()
const paths = z.array(RelPath).min(1).max(GIT_LIMITS.pathsPerCall)

export const GitGenesisInput = z.strictObject({ genesisId })
export const GitDiffInput = z.strictObject({ genesisId, path: RelPath, staged: z.boolean() })
export const GitPathsInput = z.strictObject({ genesisId, paths })
export const GitCommitInput = z.strictObject({
  genesisId,
  message: z.string().trim().min(1).max(GIT_LIMITS.messageLength),
  expectedStaged: z.array(RelPath).max(GIT_LIMITS.pathsPerCall),
  confirm: z.literal(true)
})
export const GitBranchInput = z.strictObject({ genesisId, name: BranchName })
export const GitLogInput = z.strictObject({ genesisId, limit: z.number().int().min(1).max(GIT_LIMITS.logLimit) })
export const GitRevertInput = z.strictObject({ genesisId, hash: Hash, expectedHead: Hash, confirm: z.literal(true) })
