import { GitConflictOut } from '@shared/ai/schemas'
import type { AIError, Result } from '../../domain/ai/types'
import { hasMarkers } from '../../domain/git/splitHunks'
import type { AIGateway, AIResult } from './AIGateway'

/** Bornes de l'entrée (L3 conflits §3). */
export const GIT_CONFLICT_LIMITS = { chars: 200_000, hunks: 30, commits: 5, context: 15 } as const

export interface GitConflictHunkInput {
  readonly index: number
  readonly base: string
  readonly ours: string
  readonly theirs: string
  readonly before: string
  readonly after: string
}

export interface GitConflictInput {
  readonly path: string
  readonly hunks: readonly GitConflictHunkInput[]
  /** Sujets des commits des deux côtés qui touchent ce fichier, auteurs déjà pseudonymisés (« Auteur A »). */
  readonly commits: readonly string[]
}

export interface ConflictProposal {
  readonly index: number
  readonly text: string
  readonly explanation: string
  readonly risk: string
  readonly confidence: 'sure' | 'check'
}

/** Une balise du cadre cachée dans le code d'un collègue est neutralisée (`<\bloc>`) : elle ne ferme ni n'ouvre rien. */
const TAG = /<\s*\/?\s*(fichier|bloc|base|la_tienne|la_leur|avant|apres|commits)\b[^>]*>/giu
const guard = (text: string): string => text.replace(TAG, (tag) => `<\\${tag.slice(1)}`)

/** Entrée balisée de la tâche ; `null` si elle dépasse les bornes (le fichier se résout à la main). */
export function gitConflictInput(input: GitConflictInput): string | null {
  if (input.hunks.length === 0 || input.hunks.length > GIT_CONFLICT_LIMITS.hunks) return null
  const text = [
    `<fichier>${guard(input.path)}</fichier>`,
    ...input.hunks.map((hunk) =>
      [
        `<bloc index="${hunk.index}">`,
        `<avant>\n${guard(hunk.before)}\n</avant>`,
        `<base>\n${guard(hunk.base)}\n</base>`,
        `<la_tienne>\n${guard(hunk.ours)}\n</la_tienne>`,
        `<la_leur>\n${guard(hunk.theirs)}\n</la_leur>`,
        `<apres>\n${guard(hunk.after)}\n</apres>`,
        '</bloc>'
      ].join('\n')
    ),
    '<commits>',
    ...input.commits.slice(0, GIT_CONFLICT_LIMITS.commits * 2).map((line) => guard(`- ${line}`)),
    '</commits>'
  ].join('\n')
  return text.length > GIT_CONFLICT_LIMITS.chars ? null : text
}

/**
 * Relit la sortie (L3 §3) : un bloc d'index inconnu, en double, ou dont le texte contient encore un marqueur de conflit
 * est rejeté (aucune proposition pour lui). Pure.
 */
export function reviewConflict(out: GitConflictOut, indexes: readonly number[]): ConflictProposal[] {
  const allowed = new Set(indexes)
  const seen = new Set<number>()
  return out.hunks.flatMap((hunk): ConflictProposal[] => {
    if (!allowed.has(hunk.index) || seen.has(hunk.index) || hasMarkers(hunk.text)) return []
    seen.add(hunk.index)
    return [
      {
        index: hunk.index,
        text: hunk.text,
        explanation: hunk.explanation,
        risk: hunk.risk,
        confidence: hunk.confidence
      }
    ]
  })
}

/** Tâche `git_conflict` par la passerelle (constitution III) : Claude sans outil, jamais mise en file. */
export function runGitConflict(
  gateway: Pick<AIGateway, 'run'>,
  input: string
): Promise<Result<AIResult<GitConflictOut>, AIError>> {
  return gateway.run({ kind: 'git_conflict', input, schema: GitConflictOut, noQueue: true })
}
