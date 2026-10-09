import { z } from 'zod'
import { Hash } from './model'

// Publier, tirer, pousser (spec 021 US2, contracts/interfaces.md) : le renderer ne transmet que le genesis, des
// empreintes, le remote et la branche vus dans l'aperçu, des identifiants de constats.

export interface FindingView {
  readonly id: string
  readonly kind: 'file_name' | 'private_key' | 'token_pattern'
  readonly path: string
  readonly commit: string
  readonly line?: number
  /** Extrait masqué : jamais le secret en clair. */
  readonly excerpt?: string
  readonly reason: string
  readonly blocking: boolean
}

export type PushBlock = 'SENSITIVE_IN_HISTORY' | 'THIRD_PARTY_DEFAULT_BRANCH' | 'NO_WRITE_ACCESS'

export interface PushPreviewView {
  readonly remote: string
  /** Adresse sans identifiant. */
  readonly remoteUrl: string
  readonly githubRepo: string | null
  readonly branch: string
  readonly targetBranch: string
  readonly firstPush: boolean
  readonly head: string
  readonly commits: readonly { readonly hash: string; readonly date: string; readonly subject: string }[]
  readonly total: number
  readonly findings: readonly FindingView[]
  /** Contrôle limité aux noms de fichiers (plage trop grande). */
  readonly namesOnly: boolean
  readonly permission: 'admin' | 'maintain' | 'write' | 'triage' | 'read' | 'none' | 'unknown'
  readonly isDefaultBranch: boolean
  readonly ownedByViewer: boolean
  readonly blocked: PushBlock | null
  readonly checkedAt: string
}

export interface PublishPreviewView {
  readonly login: string
  readonly suggestedName: string
  readonly branch: string
  readonly head: string
  readonly commitsToPush: number
  readonly hasGitignore: boolean
  readonly findings: readonly FindingView[]
  readonly blocked: boolean
}

const genesisId = z.uuid()
const RemoteName = z.string().regex(/^[A-Za-z0-9._-]{1,100}$/)
const Branch = z.string().regex(/^[A-Za-z0-9._/-]{1,200}$/)

export const GitConfirmInput = z.strictObject({ genesisId, confirm: z.literal(true) })
export const GitMergeInput = z.strictObject({ genesisId, confirm: z.literal(true), expectedUpstreamHead: Hash })
export const GitPushInput = z.strictObject({
  genesisId,
  confirm: z.literal(true),
  expectedHead: Hash,
  expectedRemote: RemoteName,
  expectedBranch: Branch,
  acceptFindings: z.array(z.string().regex(/^[0-9a-f]{16}$/)).max(50)
})
export const GitPublishInput = z.strictObject({
  genesisId,
  name: z.string().regex(/^[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$/, 'nom de dépôt GitHub'),
  description: z.string().max(350),
  visibility: z.enum(['private', 'public']),
  confirm: z.literal(true),
  confirmPublic: z.literal(true).optional(),
  expectedHead: Hash
})
