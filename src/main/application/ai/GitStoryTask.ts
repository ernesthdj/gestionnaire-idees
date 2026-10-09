import { GitStoryOut } from '@shared/ai/schemas'
import type { AIError, Result } from '../../domain/ai/types'
import type { AIGateway, AIResult } from './AIGateway'

/** Bornes de l'entrée (UC-3). */
export const GIT_STORY_LIMITS = { commits: 500, subject: 200 } as const

export interface GitStoryCommit {
  readonly date: string
  /** Pseudonyme (« Auteur A ») : jamais le nom ni l'e-mail. */
  readonly author: string
  readonly subject: string
}

/** Une balise du cadre cachée dans un message de commit est neutralisée (`<\commits>`). */
const guard = (text: string): string => text.replace(/<\s*\/?\s*commits\b[^>]*>/giu, (tag) => `<\\${tag.slice(1)}`)

/** Entrée balisée : une ligne par commit, du plus ancien au plus récent. */
export function gitStoryInput(commits: readonly GitStoryCommit[]): string {
  return [
    '<commits>',
    ...commits
      .slice(0, GIT_STORY_LIMITS.commits)
      .map((commit) =>
        guard(`${commit.date.slice(0, 10)} · ${commit.author} · ${commit.subject.slice(0, GIT_STORY_LIMITS.subject)}`)
      ),
    '</commits>'
  ].join('\n')
}

/** Tâche `git_story` par la passerelle (constitution III) : Claude sans outil, jamais mise en file. */
export function runGitStory(
  gateway: Pick<AIGateway, 'run'>,
  input: string
): Promise<Result<AIResult<GitStoryOut>, AIError>> {
  return gateway.run({ kind: 'git_story', input, schema: GitStoryOut, noQueue: true })
}
