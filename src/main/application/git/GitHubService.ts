import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type {
  ForkPreviewView,
  IssueDetailView,
  IssueLinkView,
  IssueStateFilter,
  IssueView,
  PrDetailView,
  PrReviewView,
  PrStateFilter,
  PrView
} from '@shared/git/github'
import { GITHUB_LIMITS } from '@shared/git/github'
import { checkGitUrl } from '@shared/reprise/gitUrl'
import * as args from '../../domain/git/args'
import { authorKey, mainKeyOf, pseudonyms } from '../../domain/git/authors'
import {
  ghIssueCreateArgs,
  ghIssueListArgs,
  ghIssueViewArgs,
  ghPrCommentArgs,
  ghPrCreateArgs,
  ghPrDiffArgs,
  ghPrListArgs,
  ghPrViewArgs,
  ghRepoForkArgs,
  ghRepoViewArgs,
  ownerRepo
} from '../../domain/git/ghArgs'
import { parseLog } from '../../domain/git/parse'
import { AppError } from '../../domain/errors'
import type { GitOperationKind, GitRepository } from '../../infrastructure/db/repositories/GitRepository'
import type { GhRunner } from '../../infrastructure/git/GhRunner'
import type { GitWriteQueue } from '../../infrastructure/git/GitWriteQueue'
import type { ProcessResult } from '../../infrastructure/process/ProcessRunner'
import type { EntityHandler } from '../history/HistoryService'
import { issueTextInput, prReviewInput, prTextInput, withoutCoAuthors } from '../ai/GitHubTasks'
import type { GitAccess, ReadyRepo } from './GitAccess'

export interface GitHubDeps {
  readonly access: GitAccess
  readonly queue: Pick<GitWriteQueue, 'run'>
  readonly gh: Pick<GhRunner, 'run' | 'status'>
  readonly repository: Pick<
    GitRepository,
    | 'repo'
    | 'saveRepo'
    | 'logOperation'
    | 'issueLinks'
    | 'issueLink'
    | 'insertIssueLink'
    | 'setIssueLinkDeleted'
    | 'transaction'
    | 'log'
    | 'aliases'
  >
  readonly authorSecret: () => string
  readonly localOnly: (genesisId: string) => boolean
  /** Titre et contenu d'une idée du projet ; `null` si elle n'existe pas ou n'est pas de ce projet. */
  readonly neuron: (
    genesisId: string,
    neuronId: string
  ) => { readonly title: string; readonly content: string | null } | null
  readonly changed: (genesisId: string) => void
  /** Tâches de Claude (`null` : indisponible). */
  readonly prText: (input: string) => Promise<{ readonly title: string; readonly body: string } | null>
  readonly prReview: (input: string) => Promise<PrReviewView | null>
  readonly issueText: (input: string) => Promise<{ readonly title: string; readonly body: string } | null>
  readonly now?: () => Date
}

/** Listes gardées 5 minutes (R9) : GitHub n'est lu qu'à l'ouverture d'un onglet ou sur « Actualiser ». */
const CACHE_MS = 5 * 60_000
const ENTITY = 'git_issue_link'

const Author = z.looseObject({ login: z.string().max(100) }).nullish()
const PrRow = z.looseObject({
  number: z.number().int().min(1),
  title: z.string().max(1_000),
  author: Author,
  state: z.string(),
  isDraft: z.boolean().optional(),
  headRefName: z.string().max(300),
  baseRefName: z.string().max(300),
  updatedAt: z.string().max(40),
  url: z.string().max(500)
})
const PrDetail = PrRow.extend({
  body: z.string().nullish(),
  files: z
    .array(
      z.looseObject({
        path: z.string().max(1_000),
        additions: z.number().int().min(0),
        deletions: z.number().int().min(0)
      })
    )
    .nullish()
})
const IssueRow = z.looseObject({
  number: z.number().int().min(1),
  title: z.string().max(1_000),
  author: Author,
  state: z.string(),
  labels: z.array(z.looseObject({ name: z.string().max(100) })).nullish(),
  updatedAt: z.string().max(40),
  url: z.string().max(500)
})
const IssueDetail = IssueRow.extend({ body: z.string().nullish() })
const RepoUrl = z.looseObject({ url: z.string().max(500), nameWithOwner: z.string().max(200) })

const prState = (state: string): PrView['state'] =>
  state.toUpperCase() === 'MERGED' ? 'merged' : state.toUpperCase() === 'CLOSED' ? 'closed' : 'open'
/** Une adresse venue de GitHub n'est gardée que si elle pointe vers github.com (sinon vide : rien à ouvrir). */
const githubUrl = (url: string): string => (/^https:\/\/github\.com\//.test(url) ? url : '')

const toPr = (row: z.infer<typeof PrRow>): PrView => ({
  number: row.number,
  title: row.title.slice(0, GITHUB_LIMITS.title),
  author: row.author?.login ?? 'inconnu',
  state: prState(row.state),
  draft: row.isDraft === true,
  head: row.headRefName,
  base: row.baseRefName,
  updatedAt: row.updatedAt,
  url: githubUrl(row.url)
})
const toIssue = (row: z.infer<typeof IssueRow>): IssueView => ({
  number: row.number,
  title: row.title.slice(0, GITHUB_LIMITS.title),
  author: row.author?.login ?? 'inconnu',
  state: row.state.toUpperCase() === 'CLOSED' ? 'closed' : 'open',
  labels: (row.labels ?? []).map((label) => label.name).slice(0, 20),
  updatedAt: row.updatedAt,
  url: githubUrl(row.url)
})

function parseJson<T>(result: ProcessResult, schema: z.ZodType<T>): T {
  if (result.code !== 0) throw ghError(result)
  let raw: unknown
  try {
    raw = JSON.parse(result.stdout)
  } catch {
    throw new AppError('GH_FAILED', 'Réponse de GitHub illisible.')
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) throw new AppError('GH_FAILED', 'Réponse de GitHub inattendue.')
  return parsed.data
}

/** Erreur claire d'une commande `gh` (jamais la sortie brute). */
function ghError(result: ProcessResult): AppError {
  const output = result.stderr
  if (/could not resolve to a (pull request|issue)|not found/i.test(output)) {
    return new AppError('NOT_FOUND', 'Introuvable sur GitHub.')
  }
  if (/already exists/i.test(output)) return new AppError('PR_EXISTS', 'Une PR existe déjà pour cette branche.')
  if (/must be a collaborator|permission|403|not authorized|resource not accessible/i.test(output)) {
    return new AppError('NO_WRITE_ACCESS', 'Tu n’as pas le droit d’écrire dans ce dépôt : fais-en un fork.')
  }
  if (/gh auth login|authentication|401/i.test(output)) {
    return new AppError('GH_NOT_LOGGED_IN', 'gh n’est pas connecté : lance « gh auth login » dans un terminal.')
  }
  if (/could not connect|network|timeout|connection/i.test(output)) {
    return new AppError('NETWORK', 'GitHub ne répond pas : vérifie ta connexion.')
  }
  return new AppError('GH_FAILED', 'GitHub a refusé la demande.')
}

/**
 * Pull requests, issues et fork (spec 021 US6, research R9) : lectures par `gh` (listes bornées, gardées 5 min), textes
 * proposés et relectures par Claude (gardés dans l'app), écritures sur GitHub seulement sur clic confirmé (`confirm`),
 * journalisées sans contenu. Aucune approbation, fusion ni fermeture : `gh` ne peut pas les construire. Les liens issue
 * ↔ nœud restent dans l'app et s'annulent depuis l'Historique.
 */
export class GitHubService {
  private readonly cache = new Map<string, { readonly at: number; readonly value: unknown }>()

  constructor(private readonly deps: GitHubDeps) {}

  /** Dépôt GitHub du projet : celui du remote `origin` (ou du seul remote) sur github.com ; sinon `NOT_GITHUB`. */
  private async github(genesisId: string): Promise<{ readonly repo: ReadyRepo; readonly slug: string }> {
    const repo = await this.deps.access.ready(genesisId)
    const remotes = (await this.deps.access.read(repo, args.remotesArgs())).stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== '')
    const remote = remotes.includes('origin') ? 'origin' : remotes.length === 1 ? remotes[0] : undefined
    if (remote === undefined) throw new AppError('NOT_GITHUB', 'Ce projet n’est pas relié à un dépôt GitHub.')
    const check = checkGitUrl((await this.deps.access.read(repo, args.remoteUrlArgs(remote))).stdout.trim())
    if (!check.ok || check.host !== 'github.com' || check.owner === undefined || check.repo === undefined) {
      throw new AppError('NOT_GITHUB', 'Ce projet n’est pas relié à un dépôt GitHub.')
    }
    const slug = ownerRepo(`${check.owner}/${check.repo.replace(/\.git$/, '')}`)
    if (this.deps.repository.repo(genesisId)?.githubRepo !== slug) {
      this.deps.repository.saveRepo(genesisId, { githubRepo: slug })
    }
    return { repo, slug }
  }

  private cached<T>(key: string, load: () => Promise<T>, fresh: boolean): Promise<T> {
    const hit = this.cache.get(key)
    if (!fresh && hit !== undefined && this.now().getTime() - hit.at < CACHE_MS) return Promise.resolve(hit.value as T)
    return load().then((value) => {
      this.cache.set(key, { at: this.now().getTime(), value })
      return value
    })
  }

  private forget(genesisId: string): void {
    for (const key of this.cache.keys()) if (key.startsWith(`${genesisId}:`)) this.cache.delete(key)
  }

  async prList(
    genesisId: string,
    state: PrStateFilter,
    fresh = false
  ): Promise<{ readonly items: readonly PrView[]; readonly more: boolean }> {
    const { slug } = await this.github(genesisId)
    return this.cached(
      `${genesisId}:pr:${state}`,
      async () => {
        const rows = parseJson(
          await this.deps.gh.run(ghPrListArgs(slug, state, GITHUB_LIMITS.prList + 1)),
          z.array(PrRow).max(GITHUB_LIMITS.prList + 1)
        )
        return { items: rows.slice(0, GITHUB_LIMITS.prList).map(toPr), more: rows.length > GITHUB_LIMITS.prList }
      },
      fresh
    )
  }

  async prView(genesisId: string, number: number): Promise<PrDetailView> {
    const { slug } = await this.github(genesisId)
    const row = parseJson(await this.deps.gh.run(ghPrViewArgs(slug, number)), PrDetail)
    const diff = await this.deps.gh.run(ghPrDiffArgs(slug, number), { maxOutput: GITHUB_LIMITS.diffBytes })
    if (diff.code !== 0 && !diff.truncated) throw ghError(diff)
    return {
      ...toPr(row),
      body: (row.body ?? '').slice(0, GITHUB_LIMITS.body),
      files: (row.files ?? []).slice(0, GITHUB_LIMITS.prFiles).map((file) => ({
        path: file.path,
        additions: file.additions,
        deletions: file.deletions
      })),
      diff: diff.stdout,
      truncated: diff.truncated
    }
  }

  async issueList(
    genesisId: string,
    input: { readonly state: IssueStateFilter; readonly search?: string; readonly page: number },
    fresh = false
  ): Promise<{ readonly items: readonly IssueView[]; readonly more: boolean }> {
    const { slug } = await this.github(genesisId)
    const search = input.search === undefined || input.search.trim() === '' ? null : input.search
    const size = GITHUB_LIMITS.issuePage
    return this.cached(
      `${genesisId}:issue:${input.state}:${search ?? ''}:${input.page}`,
      async () => {
        const rows = parseJson(
          await this.deps.gh.run(ghIssueListArgs(slug, input.state, input.page * size + 1, search)),
          z.array(IssueRow).max(20 * size + 1)
        )
        return {
          items: rows.slice((input.page - 1) * size, input.page * size).map(toIssue),
          more: rows.length > input.page * size
        }
      },
      fresh
    )
  }

  async issueView(genesisId: string, number: number): Promise<IssueDetailView> {
    const { slug } = await this.github(genesisId)
    const row = parseJson(await this.deps.gh.run(ghIssueViewArgs(slug, number)), IssueDetail)
    return { ...toIssue(row), body: (row.body ?? '').slice(0, GITHUB_LIMITS.body) }
  }

  // Textes de Claude : proposés, jamais publiés ; un projet « Local uniquement » n'envoie rien.

  private assertShareable(genesisId: string): void {
    if (this.deps.localOnly(genesisId)) {
      throw new AppError('LOCAL_ONLY', 'Projet « Local uniquement » : rien n’est envoyé à Claude.')
    }
  }

  /** Titre et description d'une PR de la branche courante vers `base` (commits `base..HEAD`, auteurs pseudonymisés). */
  async prPropose(genesisId: string, base: string): Promise<{ readonly title: string; readonly body: string }> {
    this.assertShareable(genesisId)
    const repo = await this.deps.access.ready(genesisId)
    const range = await this.compareRange(repo, base)
    const commits = parseLog((await this.deps.access.read(repo, args.rangeLogArgs(range.from, 'HEAD', 200))).stdout)
    if (commits.length === 0)
      throw new AppError('NOTHING_TO_COMPARE', 'Aucun commit à proposer par rapport à cette base.')
    const secret = this.deps.authorSecret()
    const aliases = this.deps.repository.aliases(genesisId)
    const keys = commits.map((commit) => mainKeyOf(authorKey(secret, commit.authorEmail), aliases))
    const names = pseudonyms(keys)
    const stat = await this.deps.access.read(repo, args.numstatRangeArgs(range.from))
    const files = stat.stdout
      .split('\0')
      .map((line) => /^(\d+|-)\t(\d+|-)\t(.+)$/s.exec(line.replace(/^\n+/, '')))
      .flatMap((match) =>
        match === null
          ? []
          : [{ path: match[3] ?? '', additions: Number(match[1]) || 0, deletions: Number(match[2]) || 0 }]
      )
    const text = await this.deps.prText(
      prTextInput({
        commits: commits.map((commit, index) => ({
          date: commit.date,
          author: names.get(keys[index] ?? '') ?? 'Auteur ?',
          subject: commit.subject
        })),
        files
      })
    )
    if (text === null) throw new AppError('AI_UNAVAILABLE', 'Claude n’a pas pu proposer de texte.')
    return { title: text.title, body: withoutCoAuthors(text.body) }
  }

  /** Relecture d'une PR par Claude, gardée dans l'app (rien n'est publié). */
  async prReview(genesisId: string, number: number): Promise<PrReviewView> {
    this.assertShareable(genesisId)
    const pr = await this.prView(genesisId, number)
    const review = await this.deps.prReview(prReviewInput({ title: pr.title, body: pr.body, diff: pr.diff }))
    if (review === null) throw new AppError('AI_UNAVAILABLE', 'Claude n’a pas pu relire cette PR.')
    return {
      summary: withoutCoAuthors(review.summary),
      comments: review.comments.slice(0, GITHUB_LIMITS.reviewComments)
    }
  }

  async issuePropose(genesisId: string, neuronId: string): Promise<{ readonly title: string; readonly body: string }> {
    this.assertShareable(genesisId)
    const note = this.deps.neuron(genesisId, neuronId)
    if (note === null) throw new AppError('NOT_FOUND', 'Idée introuvable dans ce projet.')
    const text = await this.deps.issueText(issueTextInput(note))
    if (text === null) throw new AppError('AI_UNAVAILABLE', 'Claude n’a pas pu proposer d’issue.')
    return { title: text.title, body: withoutCoAuthors(text.body) }
  }

  // Écritures sur GitHub : seulement sur clic confirmé (le schéma exige `confirm: true`), journalisées sans contenu.

  private async logged<T>(
    genesisId: string,
    kind: GitOperationKind,
    work: () => Promise<T & { readonly number?: number }>
  ): Promise<T> {
    const startedAt = this.now().toISOString()
    try {
      const result = await work()
      this.deps.repository.logOperation({
        genesisId,
        kind,
        status: 'ok',
        host: 'github.com',
        ...(result.number === undefined ? {} : { number: result.number }),
        startedAt,
        finishedAt: this.now().toISOString()
      })
      this.forget(genesisId)
      return result
    } catch (error) {
      this.deps.repository.logOperation({
        genesisId,
        kind,
        status: 'failed',
        errorCode: error instanceof AppError ? error.code : 'UNKNOWN',
        host: 'github.com',
        startedAt,
        finishedAt: this.now().toISOString()
      })
      throw error
    }
  }

  async prComment(genesisId: string, number: number, body: string): Promise<{ readonly url: string }> {
    const { slug } = await this.github(genesisId)
    const { url } = await this.logged(genesisId, 'pr_comment', async () => {
      const result = await this.deps.gh.run(ghPrCommentArgs(slug, number), { stdin: withoutCoAuthors(body) })
      if (result.code !== 0) throw ghError(result)
      return { url: this.urlIn(result.stdout), number }
    })
    return { url }
  }

  /**
   * PR de la branche courante vers `base`, sur l'état vu (`expectedHead`) : la branche doit être poussée et à jour sur
   * le distant ; dans un fork, la PR part vers le dépôt d'origine (`upstream`).
   */
  async prCreate(input: {
    readonly genesisId: string
    readonly base: string
    readonly title: string
    readonly body: string
    readonly draft: boolean
    readonly expectedHead: string
  }): Promise<{ readonly number: number; readonly url: string }> {
    const { repo, slug } = await this.github(input.genesisId)
    const status = await this.deps.access.readStatus(repo)
    if (status.branch === null || status.detached) {
      throw new AppError('DETACHED_HEAD', 'Tu n’es sur aucune branche : passe sur une branche pour proposer une PR.')
    }
    const head = await this.deps.access.head(repo)
    if (head === null || !head.startsWith(input.expectedHead)) {
      throw new AppError('HEAD_CHANGED', 'Le dépôt a changé depuis ton aperçu : relis-le avant de proposer.')
    }
    if (status.upstream === null || status.ahead > 0) {
      throw new AppError('BRANCH_NOT_PUSHED', 'Pousse d’abord ta branche : la PR montre ce qui est sur GitHub.')
    }
    const upstream = this.deps.repository.repo(input.genesisId)?.upstreamRepo ?? null
    const target = upstream ?? slug
    const owner = slug.split('/')[0] ?? ''
    const branch = status.upstream.branch
    return this.logged(input.genesisId, 'pr_create', async () => {
      const result = await this.deps.gh.run(
        ghPrCreateArgs({
          repo: target,
          base: input.base,
          head: upstream === null ? branch : `${owner}:${branch}`,
          title: input.title,
          draft: input.draft
        }),
        { stdin: withoutCoAuthors(input.body) }
      )
      if (result.code !== 0) throw ghError(result)
      const url = this.urlIn(result.stdout)
      const number = Number(/\/pull\/(\d+)/.exec(url)?.[1] ?? 0)
      return { number, url }
    })
  }

  async issueCreate(input: {
    readonly genesisId: string
    readonly title: string
    readonly body: string
    readonly fromNeuronId?: string
  }): Promise<{ readonly number: number; readonly url: string; readonly linkBatchId: string | null }> {
    const { slug } = await this.github(input.genesisId)
    const created = await this.logged(input.genesisId, 'issue_create', async () => {
      const result = await this.deps.gh.run(ghIssueCreateArgs(slug, input.title), {
        stdin: withoutCoAuthors(input.body)
      })
      if (result.code !== 0) throw ghError(result)
      const url = this.urlIn(result.stdout)
      return { number: Number(/\/issues\/(\d+)/.exec(url)?.[1] ?? 0), url }
    })
    // Une issue née d'une idée lui est reliée d'office (lien annulable, dans l'app).
    const linkBatchId =
      input.fromNeuronId === undefined || created.number === 0
        ? null
        : this.link(input.genesisId, 'issue', created.number, input.fromNeuronId).batchId
    return { ...created, linkBatchId }
  }

  /** Aperçu du fork : dépôt d'origine, fork visé sur le compte connecté, déjà forké ou non. */
  async forkPreview(genesisId: string): Promise<ForkPreviewView> {
    const { slug } = await this.github(genesisId)
    const gh = await this.deps.gh.status()
    if (gh.login === null) {
      throw new AppError('GH_NOT_LOGGED_IN', 'gh n’est pas connecté : lance « gh auth login » dans un terminal.')
    }
    const [owner, name = ''] = slug.split('/')
    if (owner?.toLowerCase() === gh.login.toLowerCase()) throw new AppError('OWN_REPO', 'Ce dépôt est déjà à toi.')
    const target = ownerRepo(`${gh.login}/${name}`)
    const existing = await this.deps.gh.run(ghRepoViewArgs(target))
    return { source: slug, target, alreadyForked: existing.code === 0 }
  }

  /**
   * Fork sur clic confirmé : `gh repo fork` (sans clone ni remote), puis l'original devient `upstream` et le fork
   * `origin` ; un fork existant est réutilisé.
   */
  async fork(genesisId: string): Promise<{ readonly fork: string }> {
    const preview = await this.forkPreview(genesisId)
    const repo = await this.deps.access.writable(genesisId)
    return this.logged(genesisId, 'fork', () =>
      this.deps.queue.run(genesisId, repo.gitDir, async () => {
        if (!preview.alreadyForked) {
          const forked = await this.deps.gh.run(ghRepoForkArgs(preview.source))
          if (forked.code !== 0) throw ghError(forked)
        }
        const view = parseJson(await this.deps.gh.run(ghRepoViewArgs(preview.target)), RepoUrl)
        const check = checkGitUrl(`${githubUrl(view.url).replace(/\/$/, '')}.git`)
        if (!check.ok || check.host !== 'github.com') throw new AppError('GH_FAILED', 'Adresse du fork inattendue.')
        const remotes = (await this.deps.access.read(repo, args.remotesArgs())).stdout
          .split(/\r?\n/)
          .map((r) => r.trim())
        if (remotes.includes('upstream')) throw new AppError('CONFLICT', 'Ce dépôt a déjà un remote « upstream ».')
        await this.deps.access.write(repo, args.remoteRenameArgs('origin', 'upstream'))
        await this.deps.access.write(repo, args.remoteAddNamedArgs('origin', check.url))
        this.deps.repository.saveRepo(genesisId, {
          githubRepo: view.nameWithOwner,
          upstreamRepo: preview.source,
          defaultRemote: 'origin',
          remoteUrl: check.display
        })
        this.deps.changed(genesisId)
        return { fork: view.nameWithOwner }
      })
    )
  }

  /** Branche `pr/<n>` tirée d'une PR pour l'essayer : récupérée seulement, jamais extraite ni exécutée. */
  async prFetchBranch(genesisId: string, number: number): Promise<{ readonly branch: string }> {
    const repo = await this.deps.access.writable(genesisId)
    const branch = `pr/${number}`
    if ((await this.deps.access.read(repo, args.branchExistsArgs(branch))).code === 0) {
      throw new AppError('NAME_TAKEN', `La branche ${branch} existe déjà.`)
    }
    const remote = this.deps.repository.repo(genesisId)?.upstreamRepo === null ? 'origin' : 'upstream'
    const remotes = (await this.deps.access.read(repo, args.remotesArgs())).stdout.split(/\r?\n/).map((r) => r.trim())
    const result = await this.deps.access.run(
      repo,
      args.prFetchArgs(remotes.includes(remote) ? remote : 'origin', number),
      {
        timeoutMs: 120_000
      }
    )
    if (result.code !== 0) throw new AppError('GIT_FAILED', 'La branche de cette PR n’a pas pu être récupérée.')
    this.deps.changed(genesisId)
    return { branch }
  }

  // Liens issue / PR ↔ idée : dans l'app seulement, un lot « git » annulable.

  issueLinks(genesisId: string): readonly IssueLinkView[] {
    return this.deps.repository
      .issueLinks(genesisId)
      .map((row) => ({ id: row.id, kind: row.kind, number: row.number, neuronId: row.neuronId }))
  }

  link(
    genesisId: string,
    kind: 'issue' | 'pr',
    number: number,
    neuronId: string
  ): { readonly linkId: string; readonly batchId: string } {
    if (this.deps.neuron(genesisId, neuronId) === null)
      throw new AppError('NOT_FOUND', 'Idée introuvable dans ce projet.')
    const existing = this.deps.repository
      .issueLinks(genesisId)
      .find((row) => row.kind === kind && row.number === number && row.neuronId === neuronId)
    if (existing !== undefined) throw new AppError('CONFLICT', 'Ce lien existe déjà.')
    const batchId = randomUUID()
    const linkId = this.deps.repository.transaction(() => {
      const id = this.deps.repository.insertIssueLink({ genesisId, kind, number, neuronId })
      this.deps.repository.log(
        batchId,
        [{ kind: 'git', entity: ENTITY, entityId: id, before: null, after: { kind, number, neuronId } }],
        'user'
      )
      return id
    })
    this.deps.changed(genesisId)
    return { linkId, batchId }
  }

  unlink(genesisId: string, kind: 'issue' | 'pr', number: number, neuronId: string): { readonly batchId: string } {
    const row = this.deps.repository
      .issueLinks(genesisId)
      .find((link) => link.kind === kind && link.number === number && link.neuronId === neuronId)
    if (row === undefined) throw new AppError('NOT_FOUND', 'Ce lien n’existe plus.')
    const batchId = randomUUID()
    this.deps.repository.transaction(() => {
      this.deps.repository.setIssueLinkDeleted(row.id, this.now().toISOString())
      this.deps.repository.log(
        batchId,
        [{ kind: 'git', entity: ENTITY, entityId: row.id, before: { kind, number, neuronId }, after: null }],
        'user'
      )
    })
    this.deps.changed(genesisId)
    return { batchId }
  }

  /** Annulation depuis l'Historique : un lien retiré revient, un lien créé s'efface. */
  historyHandlers(): Readonly<Record<string, EntityHandler>> {
    const { repository } = this.deps
    return {
      [ENTITY]: {
        snapshot: (id) => {
          const row = repository.issueLink(id)
          return row === undefined || row.deletedAt !== null
            ? null
            : { kind: row.kind, number: row.number, neuronId: row.neuronId }
        },
        apply: (id, target) => {
          const row = repository.issueLink(id)
          if (row === undefined) return
          repository.setIssueLinkDeleted(id, target === null ? this.now().toISOString() : null)
          this.deps.changed(row.genesisId)
        }
      }
    }
  }

  /** Première adresse github.com d'une sortie de `gh` ; vide sinon. */
  private urlIn(output: string): string {
    return output.split(/\s+/).find((word) => /^https:\/\/github\.com\//.test(word)) ?? ''
  }

  /** Base de comparaison d'une PR (empreinte) : `origin/<base>` s'il existe, sinon la branche locale `<base>`. */
  private async compareRange(repo: ReadyRepo, base: string): Promise<{ readonly from: string }> {
    for (const candidate of [`origin/${base}`, base]) {
      const result = await this.deps.access.read(repo, args.refHeadArgs(candidate))
      if (result.code === 0) return { from: result.stdout.trim() }
    }
    throw new AppError('NOTHING_TO_COMPARE', `La branche ${base} est introuvable.`)
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date()
  }
}
