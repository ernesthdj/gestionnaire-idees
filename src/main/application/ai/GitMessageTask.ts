import { GitMessageOut } from '@shared/ai/schemas'
import type { AIError, Result } from '../../domain/ai/types'
import type { AIGateway, AIResult } from './AIGateway'

/** Bornes de l'entrée (research R12). */
export const GIT_MESSAGE_LIMITS = { diffChars: 40_000, files: 500, styleSubjects: 10 } as const

export interface GitMessageInput {
  readonly diff: string
  readonly files: readonly string[]
  /** Derniers sujets de commit du dépôt (langue et ton). */
  readonly style: readonly string[]
}

/** Proposition relue par l'app (ce que voit mentalyas). */
export interface GitMessageProposal {
  readonly message: string
  readonly groups: readonly { readonly paths: readonly string[]; readonly message: string }[]
  /** Première ligne hors Conventional Commits. */
  readonly offFormat: boolean
}

const guard = (text: string): string => text.replace(/<\s*\/\s*(diff|fichiers|style)\s*>/giu, '<\\/$1>')

/** Entrée balisée : diff (tronqué avec mention), fichiers préparés, derniers sujets. */
export function gitMessageInput(input: GitMessageInput): string {
  const truncated = input.diff.length > GIT_MESSAGE_LIMITS.diffChars
  return [
    '<diff>',
    guard(input.diff.slice(0, GIT_MESSAGE_LIMITS.diffChars)) + (truncated ? '\n[… diff tronqué]' : ''),
    '</diff>',
    '<fichiers>',
    ...input.files.slice(0, GIT_MESSAGE_LIMITS.files).map((path) => guard(`- ${path}`)),
    '</fichiers>',
    '<style>',
    ...input.style.slice(0, GIT_MESSAGE_LIMITS.styleSubjects).map((subject) => guard(`- ${subject}`)),
    '</style>'
  ].join('\n')
}

const CONVENTIONAL = /^(feat|fix|refactor|chore|docs|test|security|perf)(\([^()\n]{1,60}\))?!?: \S.{0,200}$/
const withoutCoAuthor = (message: string): string =>
  message
    .split(/\r?\n/)
    .filter((line) => !/^\s*co-authored-by:/i.test(line))
    .join('\n')
    .trim()

/**
 * Relit la sortie de Claude (R12) : ligne `Co-Authored-By` retirée, fichiers d'un groupe limités aux fichiers préparés
 * (un groupe vidé disparaît), format Conventional Commits signalé s'il manque. Pure.
 */
export function reviewProposal(out: GitMessageOut, staged: readonly string[]): GitMessageProposal {
  const allowed = new Set(staged)
  const message = withoutCoAuthor(out.message)
  const groups = out.groups
    .map((group) => ({
      paths: group.paths.filter((path) => allowed.has(path)),
      message: withoutCoAuthor(group.message)
    }))
    .filter((group) => group.paths.length > 0 && group.message !== '')
  return { message, groups, offFormat: !CONVENTIONAL.test(message.split('\n')[0] ?? '') }
}

/** Tâche `git_message` par la passerelle (constitution III) : Claude sans outil, jamais mise en file. */
export function runGitMessage(
  gateway: Pick<AIGateway, 'run'>,
  input: GitMessageInput
): Promise<Result<AIResult<GitMessageOut>, AIError>> {
  return gateway.run({ kind: 'git_message', input: gitMessageInput(input), schema: GitMessageOut, noQueue: true })
}
