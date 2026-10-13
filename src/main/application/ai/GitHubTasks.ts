import { GitHubTextOut, GitPrReviewOut } from '@shared/ai/schemas'
import type { AIError, Result } from '../../domain/ai/types'
import type { AIGateway, AIResult } from './AIGateway'

/**
 * Tâches GitHub (spec 021 US6, R12) : texte de PR, relecture d'une PR, texte d'issue. Claude sans outil, jamais mis en
 * file ; l'entrée est balisée et bornée, les balises du cadre cachées dans les données sont neutralisées.
 */

export const GITHUB_TASK_LIMITS = { commits: 200, subject: 200, files: 300, diff: 120_000, note: 8_000 } as const

const TAGS = /<\s*\/?\s*(commits|diff|pr|note)\b[^>]*>/giu
/** Une balise du cadre cachée dans une donnée est neutralisée (`<\diff>`). */
const guard = (text: string): string => text.replace(TAGS, (tag) => `<\\${tag.slice(1)}`)

/** Lignes « Co-Authored-By » et signatures d'outil retirées d'un texte proposé (règle de mentalyas). */
export function withoutCoAuthors(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !/^\s*co-authored-by\s*:/i.test(line) && !/generated with \[?claude/i.test(line))
    .join('\n')
    .trim()
}

export function prTextInput(input: {
  readonly commits: readonly { readonly date: string; readonly author: string; readonly subject: string }[]
  readonly files: readonly { readonly path: string; readonly additions: number; readonly deletions: number }[]
}): string {
  return [
    '<commits>',
    ...input.commits
      .slice(0, GITHUB_TASK_LIMITS.commits)
      .map((commit) =>
        guard(`${commit.date.slice(0, 10)} · ${commit.author} · ${commit.subject.slice(0, GITHUB_TASK_LIMITS.subject)}`)
      ),
    '</commits>',
    '<diff>',
    ...input.files
      .slice(0, GITHUB_TASK_LIMITS.files)
      .map((file) => guard(`${file.path} +${file.additions} -${file.deletions}`)),
    '</diff>'
  ].join('\n')
}

export function prReviewInput(input: { readonly title: string; readonly body: string; readonly diff: string }): string {
  return [
    '<pr>',
    guard(input.title),
    guard(input.body.slice(0, GITHUB_TASK_LIMITS.note)),
    '</pr>',
    '<diff>',
    guard(input.diff.slice(0, GITHUB_TASK_LIMITS.diff)),
    '</diff>'
  ].join('\n')
}

export function issueTextInput(note: { readonly title: string; readonly content: string | null }): string {
  return ['<note>', guard(note.title), guard((note.content ?? '').slice(0, GITHUB_TASK_LIMITS.note)), '</note>'].join(
    '\n'
  )
}

export function runGitPrText(
  gateway: Pick<AIGateway, 'run'>,
  input: string
): Promise<Result<AIResult<GitHubTextOut>, AIError>> {
  return gateway.run({ kind: 'git_pr_text', input, schema: GitHubTextOut, noQueue: true })
}

export function runGitPrReview(
  gateway: Pick<AIGateway, 'run'>,
  input: string
): Promise<Result<AIResult<GitPrReviewOut>, AIError>> {
  return gateway.run({ kind: 'git_pr_review', input, schema: GitPrReviewOut, noQueue: true })
}

export function runGitIssueText(
  gateway: Pick<AIGateway, 'run'>,
  input: string
): Promise<Result<AIResult<GitHubTextOut>, AIError>> {
  return gateway.run({ kind: 'git_issue_text', input, schema: GitHubTextOut, noQueue: true })
}
