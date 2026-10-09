import { z } from 'zod'

/**
 * Modèle partagé de Git et GitHub (spec 021, contracts/interfaces.md) : types de base vérifiés à la frontière IPC,
 * limites et vues. Le renderer ne transmet jamais de chemin absolu ni d'adresse de dépôt : seulement un genesis, des
 * chemins relatifs, des noms de branche, des empreintes.
 */

/** Bornes de la spec 021 (contracts, research R10). */
export const GIT_LIMITS = {
  pathLength: 400,
  pathsPerCall: 500,
  statusFiles: 10_000,
  messageLength: 5_000,
  logLimit: 50,
  hookOutput: 8_000,
  untrackedReadBytes: 1_000_000,
  diffLines: 5_000
} as const

/**
 * Chemin relatif dans un dépôt : ni absolu, ni lecteur, ni `..`, ni caractère de contrôle, ni `-` initial (qui
 * ressemblerait à une option) ; revérifié par `realpath` dans le dépôt côté main.
 */
export const RelPath = z
  .string()
  .min(1)
  .max(GIT_LIMITS.pathLength)
  .refine(
    (path) =>
      !/^([a-zA-Z]:|[\\/])/.test(path) &&
      !path.split(/[\\/]/).includes('..') &&
      // eslint-disable-next-line no-control-regex
      !/[\u0000-\u001f\u007f]/.test(path) &&
      !path.startsWith('-'),
    'chemin relatif'
  )
export type RelPath = z.infer<typeof RelPath>

/**
 * Nom de branche : caractères sûrs, pas de `-` initial, pas d'espace de noms réservé à l'Analyste interne
 * (`analyste/`, spec 019) ; revérifié par `git check-ref-format --branch` côté main.
 */
export const BranchName = z
  .string()
  .regex(/^[A-Za-z0-9._/-]{1,100}$/, 'nom de branche')
  .refine((name) => !name.startsWith('-') && !name.startsWith('analyste/'), 'nom de branche réservé')
  .refine(
    (name) =>
      !name.includes('..') &&
      !name.endsWith('.lock') &&
      !name.endsWith('/') &&
      // Comme git : aucun segment ne commence par un point ni n'est vide.
      name.split('/').every((part) => part !== '' && !part.startsWith('.')),
    'nom de branche'
  )
export type BranchName = z.infer<typeof BranchName>

/** Empreinte de commit, abrégée ou complète. */
export const Hash = z.string().regex(/^[0-9a-f]{7,40}$/, 'empreinte de commit')
export type Hash = z.infer<typeof Hash>

/** Codes d'erreur communs (contracts « Codes communs ») et ceux d'US1. */
export const GIT_ERROR_CODES = [
  'NOT_FOUND',
  'DIR_MISSING',
  'GIT_MISSING',
  'BUSY',
  'RISKY_CONFIG',
  'READ_ONLY_STATE',
  'VALIDATION',
  'NETWORK',
  'TIMEOUT',
  'AUTH_FAILED',
  'SENSITIVE_FILE',
  'NOTHING_STAGED',
  'STAGED_CHANGED',
  'HOOK_FAILED',
  'IDENTITY_MISSING',
  'DETACHED_HEAD',
  'MERGE_IN_PROGRESS',
  'INVALID_NAME',
  'NAME_TAKEN',
  'DIRTY_TREE',
  'MERGE_COMMIT',
  'HEAD_CHANGED',
  'CONFLICTS_ABORTED'
] as const
export type GitErrorCode = (typeof GIT_ERROR_CODES)[number]

export type GitFileStatus = 'M' | 'A' | 'D' | 'R' | '?' | 'U'

export interface GitFileView {
  readonly path: string
  readonly origPath?: string
  readonly status: GitFileStatus
  readonly staged: boolean
  /** Fichier sensible (`.env`, clé…) : jamais cochable, jamais lu (FR-014). */
  readonly sensitive: boolean
}

/** État du dépôt d'un genesis (contracts `GitStatusView`). */
export interface GitStatusView {
  /** `risky_config` : aucune autre commande git n'a été lancée (research R3). */
  readonly state: 'no_repo' | 'ok' | 'risky_config'
  readonly branch: string | null
  readonly detached: boolean
  readonly upstream: { readonly remote: string; readonly branch: string } | null
  readonly ahead: number
  readonly behind: number
  readonly lastFetchAt: string | null
  readonly files: readonly GitFileView[]
  readonly filesTotal: number
  /** `merge` : fusion ouverte par l'app ; `other` : opération lancée hors de l'app → volet en lecture seule. */
  readonly operation: 'none' | 'merge' | 'other'
  /** HEAD sur une branche `pr/*` : hooks coupés même en confiance (FR-005). */
  readonly onPrBranch: boolean
  readonly trusted: boolean
  readonly riskyConfig: readonly string[]
  readonly github: { readonly repo: string; readonly isGitHub: true } | null
  readonly newSinceVisit: number
}

export interface GitDiffLine {
  readonly kind: 'add' | 'del' | 'ctx'
  readonly oldNo?: number
  readonly newNo?: number
  readonly text: string
}

export interface GitDiffView {
  readonly path: string
  readonly binary: boolean
  readonly truncated: boolean
  readonly hunks: readonly { readonly header: string; readonly lines: readonly GitDiffLine[] }[]
}

export interface GitBranchView {
  readonly name: string
  readonly current: boolean
  readonly upstream: string | null
  readonly ahead: number
  readonly behind: number
}

/** Auteur d'un commit : nom et e-mail seulement en mémoire et vers le renderer (FR-028). */
export interface AuthorView {
  readonly key: string
  readonly name: string
  readonly email: string
  readonly initials: string
  readonly color: string
}

export interface GitCommitView {
  readonly hash: string
  readonly subject: string
  readonly date: string
  readonly authorKey: string
  readonly isMerge: boolean
}
