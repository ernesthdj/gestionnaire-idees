import { z } from 'zod'
import { BranchName, Hash } from './model'

// Pull requests, issues et fork (spec 021 US6). Les textes venus de GitHub sont des DONNÉES non fiables : l'interface
// les affiche en texte (`GitHubMarkdown`), sans HTML ni image distante.

export const GITHUB_LIMITS = {
  prList: 50,
  issuePage: 100,
  body: 20_000,
  title: 256,
  prFiles: 300,
  diffBytes: 2 * 1024 * 1024,
  reviewComments: 30
} as const

export type PrStateFilter = 'open' | 'closed' | 'merged' | 'all'
export type IssueStateFilter = 'open' | 'closed' | 'all'

export interface PrView {
  readonly number: number
  readonly title: string
  readonly author: string
  readonly state: 'open' | 'closed' | 'merged'
  readonly draft: boolean
  readonly head: string
  readonly base: string
  readonly updatedAt: string
  readonly url: string
}

export interface PrDetailView extends PrView {
  readonly body: string
  readonly files: readonly { readonly path: string; readonly additions: number; readonly deletions: number }[]
  /** Diff unifié, borné (`truncated` au-delà de 2 Mo). */
  readonly diff: string
  readonly truncated: boolean
}

export interface IssueView {
  readonly number: number
  readonly title: string
  readonly author: string
  readonly state: 'open' | 'closed'
  readonly labels: readonly string[]
  readonly updatedAt: string
  readonly url: string
}

export interface IssueDetailView extends IssueView {
  readonly body: string
}

/** Relecture d'une PR par Claude : gardée dans l'app ; publier un commentaire est un autre clic. */
export interface PrReviewView {
  readonly summary: string
  readonly comments: readonly { readonly path: string | null; readonly line: number | null; readonly text: string }[]
}

export interface IssueLinkView {
  readonly id: string
  readonly kind: 'issue' | 'pr'
  readonly number: number
  readonly neuronId: string
}

export interface ForkPreviewView {
  /** Dépôt d'origine (`owner/nom`). */
  readonly source: string
  /** Fork sur le compte connecté (`login/nom`). */
  readonly target: string
  readonly alreadyForked: boolean
}

const genesisId = z.uuid()
const Number_ = z.number().int().min(1).max(10_000_000)
const Body = z.string().trim().min(1).max(GITHUB_LIMITS.body)
const Title = z.string().trim().min(1).max(GITHUB_LIMITS.title)

export const PrListInput = z.strictObject({ genesisId, state: z.enum(['open', 'closed', 'merged', 'all']) })
export const PrNumberInput = z.strictObject({ genesisId, number: Number_ })
export const PrCommentInput = z.strictObject({ genesisId, number: Number_, body: Body, confirm: z.literal(true) })
export const PrProposeInput = z.strictObject({ genesisId, base: BranchName })
export const PrCreateInput = z.strictObject({
  genesisId,
  base: BranchName,
  title: Title,
  body: z.string().trim().max(GITHUB_LIMITS.body),
  draft: z.boolean(),
  confirm: z.literal(true),
  expectedHead: Hash
})
export const IssueListInput = z.strictObject({
  genesisId,
  state: z.enum(['open', 'closed', 'all']),
  search: z.string().trim().max(200).optional(),
  page: z.number().int().min(1).max(20)
})
export const IssueNumberInput = z.strictObject({ genesisId, number: Number_ })
export const IssueProposeInput = z.strictObject({ genesisId, neuronId: z.uuid() })
export const IssueCreateInput = z.strictObject({
  genesisId,
  title: Title,
  body: z.string().trim().max(GITHUB_LIMITS.body),
  fromNeuronId: z.uuid().optional(),
  confirm: z.literal(true)
})
export const IssueLinkInput = z.strictObject({
  genesisId,
  kind: z.enum(['issue', 'pr']),
  number: Number_,
  neuronId: z.uuid()
})
export const IssueLinksInput = z.strictObject({ genesisId })
export const ForkInput = z.strictObject({ genesisId, confirm: z.literal(true) })
export const ForkPreviewInput = z.strictObject({ genesisId })
/** Seuls les liens `https://github.com/…` s'ouvrent dans le navigateur (US6-6). */
export const OpenExternalInput = z.strictObject({
  url: z
    .string()
    .max(2_000)
    .regex(/^https:\/\/github\.com\/[^\s]*$/)
})

/** Adresse que l'app accepte d'ouvrir : `https://github.com/…`, rien d'autre (hameçonnage). */
export const isGitHubLink = (url: string): boolean => OpenExternalInput.shape.url.safeParse(url).success
