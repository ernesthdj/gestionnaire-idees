import type { AuthorView } from '@shared/git/model'
import type { HistoryView, StoryView } from '@shared/git/history'
import * as args from '../../domain/git/args'
import { authorKey, authorViews, mainKeyOf, pseudonyms } from '../../domain/git/authors'
import { parseLog } from '../../domain/git/parse'
import { AppError } from '../../domain/errors'
import type { GitRepository } from '../../infrastructure/db/repositories/GitRepository'
import { gitStoryInput } from '../ai/GitStoryTask'
import type { GitAccess } from './GitAccess'

export interface HistoryDeps {
  readonly access: GitAccess
  readonly repository: Pick<GitRepository, 'aliases' | 'mergeAuthors' | 'unmergeAuthor'>
  readonly authorSecret: () => string
  readonly changed: (genesisId: string) => void
  readonly localOnly: (genesisId: string) => boolean
  /** Tâche `git_story` (`null` : indisponible). */
  readonly story: (input: string) => Promise<string | null>
}

/** Commits par lecture (GD-4). */
export const HISTORY_PAGE = 5_000
const KEY = /^[0-9a-f]{16}$/

/**
 * « Qui a fait quoi et quand » (spec 021 US5, lot 1) : la frise (une page de commits, auteurs par clé, identités
 * fusionnées appliquées), la fusion d'identités (gardée dans l'app, par projet, jamais écrite dans le dépôt) et le récit
 * d'une période par Claude, qui ne voit que des pseudonymes. Lecture seule de git (GD-5).
 */
export class GitHistoryService {
  constructor(private readonly deps: HistoryDeps) {}

  async history(genesisId: string, skip: number, limit: number): Promise<HistoryView> {
    const repo = await this.deps.access.ready(genesisId)
    if ((await this.deps.access.head(repo)) === null) return { commits: [], authors: [], merged: [], more: false }
    const page = Math.min(Math.max(1, limit), HISTORY_PAGE)
    const result = await this.deps.access.read(repo, args.historyArgs(skip, page + 1), { maxOutput: 32 * 1024 * 1024 })
    const parsed = parseLog(result.stdout)
    const secret = this.deps.authorSecret()
    const aliases = this.deps.repository.aliases(genesisId)
    const shown = parsed.slice(0, page)
    const identities = authorViews(
      secret,
      shown.map((commit) => ({ name: commit.authorName, email: commit.authorEmail }))
    )
    const byKey = new Map(identities.map((author) => [author.key, author] as const))
    // Une identité fusionnée prend la couleur et les initiales de sa principale ; elle reste listée pour « Séparer ».
    const merged = identities
      .filter((author) => aliases.has(author.key))
      .map((author) => ({ key: author.key, mainKey: mainKeyOf(author.key, aliases), name: author.name }))
    const authors: AuthorView[] = identities.filter((author) => !aliases.has(author.key))
    for (const alias of merged) {
      if (!authors.some((author) => author.key === alias.mainKey)) {
        const main = byKey.get(alias.key)
        if (main !== undefined) authors.push({ ...main, key: alias.mainKey })
      }
    }
    return {
      commits: shown.map((commit) => ({
        hash: commit.hash,
        subject: commit.subject,
        date: commit.date,
        authorKey: mainKeyOf(authorKey(secret, commit.authorEmail), aliases),
        isMerge: commit.parents.length > 1
      })),
      authors,
      merged,
      more: parsed.length > page
    }
  }

  mergeAuthors(genesisId: string, mainKey: string, aliasKeys: readonly string[]): { readonly ok: true } {
    if (!KEY.test(mainKey) || aliasKeys.some((key) => !KEY.test(key) || key === mainKey)) {
      throw new AppError('VALIDATION', 'Identités à fusionner invalides.')
    }
    this.deps.repository.mergeAuthors(genesisId, mainKey, aliasKeys)
    this.deps.changed(genesisId)
    return { ok: true }
  }

  unmergeAuthor(genesisId: string, aliasKey: string): { readonly ok: true } {
    if (!this.deps.repository.unmergeAuthor(genesisId, aliasKey))
      throw new AppError('NOT_FOUND', 'Cette fusion n’existe plus.')
    this.deps.changed(genesisId)
    return { ok: true }
  }

  /**
   * Récit de la période `from`…`to` (inclus) : Claude reçoit dates, pseudonymes et messages, jamais un nom ni un e-mail ;
   * l'interface remet les vrais noms grâce à `names` (pseudonyme → clé d'auteur).
   */
  async story(genesisId: string, from: string, to: string): Promise<StoryView> {
    if (this.deps.localOnly(genesisId)) {
      throw new AppError('LOCAL_ONLY', 'Projet « Local uniquement » : rien n’est envoyé à Claude.')
    }
    const repo = await this.deps.access.ready(genesisId)
    const parsed = parseLog((await this.deps.access.read(repo, args.storyArgs(to))).stdout)
    const end = parsed.findIndex((commit) => commit.hash.startsWith(from))
    const period = (end < 0 ? parsed : parsed.slice(0, end + 1)).reverse()
    if (period.length === 0) throw new AppError('VALIDATION', 'Aucun commit dans cette période.')
    const secret = this.deps.authorSecret()
    const aliases = this.deps.repository.aliases(genesisId)
    const keys = period.map((commit) => mainKeyOf(authorKey(secret, commit.authorEmail), aliases))
    const names = pseudonyms(keys)
    const text = await this.deps.story(
      gitStoryInput(
        period.map((commit, index) => ({
          date: commit.date,
          author: names.get(keys[index] ?? '') ?? 'Auteur ?',
          subject: commit.subject
        }))
      )
    )
    if (text === null) throw new AppError('AI_UNAVAILABLE', 'Claude n’a pas pu raconter cette période.')
    return { text, names: Object.fromEntries([...names].map(([key, alias]) => [alias, key])), commits: period.length }
  }
}
