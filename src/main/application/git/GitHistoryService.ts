import type { AuthorView } from '@shared/git/model'
import type {
  HistoryView,
  NodeReplayView,
  ReplayStepsView,
  ReplayWeight,
  StoryView,
  TouchedView
} from '@shared/git/history'
import * as args from '../../domain/git/args'
import { authorKey, authorViews, mainKeyOf, pseudonyms } from '../../domain/git/authors'
import { fileToNode, type NodeTree } from '../../domain/git/fileToNode'
import { parseLog } from '../../domain/git/parse'
import { parseReplayLog, replayNodes, type ReplayStep } from '../../domain/git/replay'
import { AppError } from '../../domain/errors'
import type { GitRepository } from '../../infrastructure/db/repositories/GitRepository'
import { gitStoryInput } from '../ai/GitStoryTask'
import type { GitAccess, ReadyRepo } from './GitAccess'
import { networkError } from './SyncService'

export interface HistoryDeps {
  readonly access: GitAccess
  readonly repository: Pick<GitRepository, 'aliases' | 'mergeAuthors' | 'unmergeAuthor'>
  readonly authorSecret: () => string
  readonly changed: (genesisId: string) => void
  readonly localOnly: (genesisId: string) => boolean
  /** Tâche `git_story` (`null` : indisponible). */
  readonly story: (input: string) => Promise<string | null>
  /** Arbre de la cartographie du projet repris (spec 017) ; `null` : pas encore analysé. */
  readonly tree: (genesisId: string) => NodeTree | null
}

interface LoadedReplay {
  readonly head: string
  readonly weight: ReplayWeight
  readonly steps: readonly (ReplayStep & { readonly hash: string; readonly date: string })[]
  readonly identities: readonly { readonly name: string; readonly email: string }[]
  readonly more: boolean
}

/** Commits par lecture (GD-4). */
export const HISTORY_PAGE = 5_000
/** Commits rejoués au plus (les plus récents). */
export const REPLAY_LIMIT = 5_000
/** Retéléchargement complet d'un clone partiel : long sur un gros dépôt. */
const REFETCH_TIMEOUT_MS = 30 * 60_000
const PARTIAL_FILTER = /^remote\.(.+)\.partialclonefilter$/i
const KEY = /^[0-9a-f]{16}$/

/** Chemin du dépôt → nœud visible parmi `keys` (`null` : hors de la vue), mémorisé par chemin. */
function ownerOf(keys: readonly string[], tree: NodeTree): (path: string) => string | null {
  const visible = new Set(keys)
  const owners = new Map<string, string | null>()
  return (path) => {
    if (!owners.has(path)) owners.set(path, fileToNode(path, visible, tree))
    return owners.get(path) ?? null
  }
}

/**
 * « Qui a fait quoi et quand » (spec 021 US5, lot 1) : la frise (une page de commits, auteurs par clé, identités
 * fusionnées appliquées), la fusion d'identités (gardée dans l'app, par projet, jamais écrite dans le dépôt) et le récit
 * d'une période par Claude, qui ne voit que des pseudonymes. Lecture seule de git (GD-5).
 */
export class GitHistoryService {
  private readonly replays = new Map<string, LoadedReplay>()

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
    const { authors, merged } = this.authorsOf(
      genesisId,
      shown.map((commit) => ({ name: commit.authorName, email: commit.authorEmail }))
    )
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

  /**
   * Auteurs affichés et identités fusionnées : une identité fusionnée prend la couleur et les initiales de sa
   * principale ; elle reste listée pour « Séparer ».
   */
  private authorsOf(
    genesisId: string,
    found: readonly { readonly name: string; readonly email: string }[]
  ): { readonly authors: AuthorView[]; readonly merged: HistoryView['merged'] } {
    const aliases = this.deps.repository.aliases(genesisId)
    const identities = authorViews(this.deps.authorSecret(), found)
    const byKey = new Map(identities.map((author) => [author.key, author] as const))
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
    return { authors, merged }
  }

  /** Remote d'un clone partiel (filtre `remote.<r>.partialclonefilter` dans la configuration locale), sinon `null`. */
  private async partialRemote(repo: ReadyRepo): Promise<string | null> {
    const names = (await this.deps.access.read(repo, args.localConfigNamesArgs())).stdout.split(/[\0\n]/)
    for (const name of names) {
      const match = PARTIAL_FILTER.exec(name.trim())
      if (match !== null) return match[1] ?? null
    }
    return null
  }

  /** Journal rejoué, gardé en cache tant que HEAD et le mode de poids ne changent pas. */
  private async loadReplay(genesisId: string): Promise<LoadedReplay> {
    const repo = await this.deps.access.ready(genesisId)
    const head = await this.deps.access.head(repo)
    if (head === null) return { head: '', weight: 'lines', steps: [], identities: [], more: false }
    const weight: ReplayWeight = (await this.partialRemote(repo)) === null ? 'lines' : 'commits'
    const cached = this.replays.get(genesisId)
    if (cached !== undefined && cached.head === head && cached.weight === weight) return cached
    const output = await this.deps.access.read(repo, args.replayArgs(REPLAY_LIMIT + 1, weight === 'lines'), {
      maxOutput: 64 * 1024 * 1024
    })
    const parsed = parseReplayLog(output.stdout)
    // `--reverse` après `-n` : le plus ancien en tête ; un commit de trop signale un historique plus long.
    const more = parsed.length > REPLAY_LIMIT
    const kept = more ? parsed.slice(1) : parsed
    const secret = this.deps.authorSecret()
    const loaded: LoadedReplay = {
      head,
      weight,
      steps: kept.map((commit) => ({
        hash: commit.hash,
        date: commit.date,
        authorKey: authorKey(secret, commit.email),
        changes: commit.changes
      })),
      identities: kept.map((commit) => ({ name: commit.name, email: commit.email })),
      more
    }
    this.replays.set(genesisId, loaded)
    return loaded
  }

  /** Les étapes de la rediffusion (curseur) : commits, auteurs (identités fusionnées appliquées) et mode de poids. */
  async replaySteps(genesisId: string): Promise<ReplayStepsView> {
    const loaded = await this.loadReplay(genesisId)
    const aliases = this.deps.repository.aliases(genesisId)
    return {
      commits: loaded.steps.map((step) => ({
        hash: step.hash,
        date: step.date,
        authorKey: mainKeyOf(step.authorKey, aliases)
      })),
      authors: this.authorsOf(genesisId, loaded.identities).authors,
      weight: loaded.weight,
      more: loaded.more
    }
  }

  /** Couleur des nœuds visibles `keys` au commit `at` : auteur principal, dernier auteur, parts (lecture seule). */
  async replay(genesisId: string, at: string, keys: readonly string[]): Promise<{ readonly nodes: NodeReplayView[] }> {
    const tree = this.deps.tree(genesisId)
    if (tree === null) throw new AppError('NOT_ANALYZED', 'Analyse le projet pour rejouer son historique sur la carte.')
    const loaded = await this.loadReplay(genesisId)
    const upto = loaded.steps.findIndex((step) => step.hash === at)
    if (upto < 0) throw new AppError('STALE', 'Ce commit ne fait plus partie de la rediffusion : recharge-la.')
    const aliases = this.deps.repository.aliases(genesisId)
    const steps = loaded.steps.map((step) => ({ ...step, authorKey: mainKeyOf(step.authorKey, aliases) }))
    return { nodes: replayNodes(steps, upto, ownerOf(keys, tree), loaded.weight) }
  }

  /**
   * « Depuis ta dernière visite » sur la carte (spec 021 T030, D13) : nœuds visibles `keys` touchés par les commits
   * `from..to` (le dernier vu → la tête du distant), un commit comptant 1 par nœud ; auteurs avec les identités
   * fusionnées appliquées. Lecture seule.
   */
  async touched(genesisId: string, from: string, to: string, keys: readonly string[]): Promise<TouchedView> {
    const tree = this.deps.tree(genesisId)
    if (tree === null) throw new AppError('NOT_ANALYZED', 'Analyse le projet pour voir ses nouveautés sur la carte.')
    const repo = await this.deps.access.ready(genesisId)
    const result = await this.deps.access.read(repo, args.rangeReplayArgs(from, to), { maxOutput: 16 * 1024 * 1024 })
    if (result.code !== 0) {
      throw new AppError('STALE', 'Ces commits ne sont plus dans le dépôt : actualise le volet Dépôt.')
    }
    const parsed = parseReplayLog(result.stdout)
    const secret = this.deps.authorSecret()
    const aliases = this.deps.repository.aliases(genesisId)
    const steps = parsed.map((commit) => ({
      authorKey: mainKeyOf(authorKey(secret, commit.email), aliases),
      changes: commit.changes
    }))
    return {
      nodes: replayNodes(steps, steps.length - 1, ownerOf(keys, tree), 'commits'),
      authors: this.authorsOf(
        genesisId,
        parsed.map((commit) => ({ name: commit.name, email: commit.email }))
      ).authors,
      commits: parsed.length
    }
  }

  /**
   * « Tout télécharger » (R13, D12) sur clic confirmé : le filtre du clone partiel est retiré de la configuration locale
   * (sinon `--refetch` le réappliquerait), puis tout l'historique est retéléchargé ; les lignes se comptent ensuite. Un
   * échec laisse un clone utilisable : les objets manquants restent téléchargés à la demande (remote « promisor »).
   */
  async fetchAll(genesisId: string): Promise<{ readonly weight: 'lines' }> {
    const repo = await this.deps.access.writable(genesisId)
    const remote = await this.partialRemote(repo)
    if (remote === null) throw new AppError('NOT_PARTIAL', 'Ce dépôt est déjà complet.')
    await this.deps.access.write(repo, args.unsetPartialFilterArgs(remote))
    this.replays.delete(genesisId)
    const result = await this.deps.access.run(repo, args.refetchArgs(remote), { timeoutMs: REFETCH_TIMEOUT_MS })
    if (result.code !== 0) {
      if (/unknown option|usage: git fetch/i.test(result.stderr)) {
        throw new AppError('GIT_TOO_OLD', 'Mets git à jour (version 2.36 ou plus) pour tout télécharger.')
      }
      throw networkError(result)
    }
    this.deps.changed(genesisId)
    return { weight: 'lines' }
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
