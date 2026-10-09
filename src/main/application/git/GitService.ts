import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type {
  AuthorView,
  GitBranchView,
  GitCommitView,
  GitDiffView,
  GitFileView,
  GitStatusView
} from '@shared/git/model'
import { GIT_LIMITS } from '@shared/git/model'
import * as args from '../../domain/git/args'
import { authorKey, authorViews } from '../../domain/git/authors'
import { addedFileDiff, parseBranches, parseDiff, parseLog, type ParsedStatus } from '../../domain/git/parse'
import { isSensitivePath } from '../../domain/git/sensitive'
import { AppError } from '../../domain/errors'
import type { GitMessageInput, GitMessageProposal } from '../ai/GitMessageTask'
import type { GitRunner, GitRunOptions } from '../../infrastructure/git/GitRunner'
import type { GitWriteQueue } from '../../infrastructure/git/GitWriteQueue'
import type { GitOperationKind, GitRepository } from '../../infrastructure/db/repositories/GitRepository'
import type { ProcessResult } from '../../infrastructure/process/ProcessRunner'
import type { RepoLocator } from './RepoLocator'
import { GitAccess, lastLines, type ReadyRepo } from './GitAccess'

export interface GitServiceDeps {
  readonly locator: Pick<RepoLocator, 'locate'>
  readonly runner: Pick<GitRunner, 'run'>
  readonly queue: Pick<GitWriteQueue, 'run'>
  readonly repository: Pick<GitRepository, 'repo' | 'logOperation' | 'openMergeHead'>
  /** Secret des clés d'auteur (`git-author-hmac`). */
  readonly authorSecret: () => string
  /** Événement `git:changed` vers le renderer. */
  readonly changed: (genesisId: string) => void
  /** Projet « Local uniquement » : aucune tâche d'IA (FR-038). */
  readonly localOnly?: (genesisId: string) => boolean
  /** Tâche `git_message` relue (`null` : indisponible). */
  readonly proposeMessage?: (input: GitMessageInput, staged: readonly string[]) => Promise<GitMessageProposal | null>
  readonly now?: () => Date
}

const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && [...a].sort().every((value, index) => value === [...b].sort()[index])

/**
 * Dépôt local d'un projet (spec 021 US1) : état, diff, branches, derniers commits, préparation, commit, branches,
 * annulation d'un commit. Chaque commande passe par le `GitRunner` (préfixe sûr, hooks selon la confiance), chaque
 * écriture par la file du projet et vérifie l'état que mentalyas a vu (research R5). Un dépôt « configuration à risque »
 * ne reçoit aucune commande ; une opération lancée hors de l'app (rebase, fusion en terminal…) met le volet en lecture
 * seule.
 */
export class GitService {
  private readonly access: GitAccess

  constructor(private readonly deps: GitServiceDeps) {
    this.access = new GitAccess(deps)
  }

  // ── Lectures ───────────────────────────────────────────────────────────────────────────────────────────────────

  async status(genesisId: string): Promise<GitStatusView> {
    const context = await this.deps.locator.locate(genesisId)
    const row = this.deps.repository.repo(genesisId)
    const base = {
      branch: null,
      detached: false,
      upstream: null,
      ahead: 0,
      behind: 0,
      lastFetchAt: row?.lastFetchAt ?? null,
      files: [],
      filesTotal: 0,
      operation: 'none' as const,
      onPrBranch: false,
      trusted: context.trusted,
      riskyConfig: [...context.risky.blocking, ...context.risky.neutralized],
      github:
        row?.githubRepo === null || row?.githubRepo === undefined
          ? null
          : { repo: row.githubRepo, isGitHub: true as const },
      newSinceVisit: 0
    }
    if (context.gitDir === null) return { ...base, state: 'no_repo' }
    if (context.blocked) return { ...base, state: 'risky_config' }
    const repo = context as ReadyRepo
    const parsed = await this.readStatus(repo)
    return {
      ...base,
      state: 'ok',
      branch: parsed.branch,
      detached: parsed.detached,
      upstream: parsed.upstream,
      ahead: parsed.ahead,
      behind: parsed.behind,
      files: parsed.entries.map((entry): GitFileView => ({ ...entry, sensitive: isSensitivePath(entry.path) })),
      filesTotal: parsed.total,
      operation: this.operationOf(repo),
      onPrBranch: parsed.branch?.startsWith('pr/') === true
    }
  }

  async diff(genesisId: string, path: string, staged: boolean): Promise<GitDiffView> {
    const repo = await this.ready(genesisId)
    if (isSensitivePath(path)) throw new AppError('SENSITIVE_FILE', 'Fichier sensible : il n’est jamais lu.')
    const full = this.inside(repo, path)
    const status = await this.readStatus(repo)
    const untracked = status.entries.some((entry) => entry.path === path && entry.status === '?')
    if (untracked && !staged) {
      if (!existsSync(full) || !statSync(full).isFile()) throw new AppError('NOT_FOUND', 'Fichier introuvable.')
      const size = statSync(full).size
      if (size > GIT_LIMITS.untrackedReadBytes) return { path, binary: false, truncated: true, hunks: [] }
      const bytes = readFileSync(full)
      if (bytes.includes(0)) return { path, binary: true, truncated: false, hunks: [] }
      return addedFileDiff(path, bytes.toString('utf8'), GIT_LIMITS.diffLines)
    }
    const result = await this.read(repo, args.diffArgs(path, staged), { maxOutput: 2 * 1024 * 1024 })
    const view = parseDiff(path, result.stdout, GIT_LIMITS.diffLines)
    return result.truncated ? { ...view, truncated: true } : view
  }

  async branches(genesisId: string): Promise<{
    readonly current: string | null
    readonly detached: boolean
    readonly local: readonly GitBranchView[]
    readonly remote: readonly GitBranchView[]
  }> {
    const repo = await this.ready(genesisId)
    const status = await this.readStatus(repo)
    const parsed = parseBranches((await this.read(repo, args.branchesArgs())).stdout)
    const view = (branch: (typeof parsed)[number]): GitBranchView => ({
      name: branch.name,
      current: branch.current,
      upstream: branch.upstream,
      ahead: branch.ahead,
      behind: branch.behind
    })
    return {
      current: status.branch,
      detached: status.detached,
      local: parsed.filter((branch) => !branch.remote).map(view),
      remote: parsed.filter((branch) => branch.remote).map(view)
    }
  }

  async log(
    genesisId: string,
    limit: number
  ): Promise<{ readonly commits: readonly GitCommitView[]; readonly authors: readonly AuthorView[] }> {
    const repo = await this.ready(genesisId)
    const status = await this.readStatus(repo)
    if (status.unborn) return { commits: [], authors: [] }
    const parsed = parseLog((await this.read(repo, args.logArgs(Math.min(limit, GIT_LIMITS.logLimit)))).stdout)
    const secret = this.deps.authorSecret()
    return {
      commits: parsed.map((commit) => ({
        hash: commit.hash,
        subject: commit.subject,
        date: commit.date,
        authorKey: authorKey(secret, commit.authorEmail),
        isMerge: commit.parents.length > 1
      })),
      authors: authorViews(
        secret,
        parsed.map((commit) => ({ name: commit.authorName, email: commit.authorEmail }))
      )
    }
  }

  /**
   * Message proposé pour les fichiers préparés (T014) : diff des fichiers préparés NON sensibles, derniers sujets du
   * dépôt ; rien n'est écrit. Projet « Local uniquement » : proposition vide, aucune tâche lancée.
   */
  async proposeMessage(genesisId: string): Promise<GitMessageProposal> {
    const repo = await this.ready(genesisId)
    const status = await this.readStatus(repo)
    const staged = [...new Set(status.entries.filter((entry) => entry.staged).map((entry) => entry.path))]
    if (staged.length === 0) throw new AppError('NOTHING_STAGED', 'Aucun fichier coché.')
    const empty: GitMessageProposal = { message: '', groups: [], offFormat: false }
    if (this.deps.localOnly?.(genesisId) === true || this.deps.proposeMessage === undefined) return empty
    const readable = staged.filter((path) => !isSensitivePath(path))
    const diff =
      readable.length === 0
        ? ''
        : (await this.read(repo, args.stagedDiffArgs(readable), { maxOutput: 512 * 1024 })).stdout
    const style = status.unborn
      ? []
      : (await this.read(repo, args.subjectsArgs(10))).stdout.split('\n').filter((line) => line.trim() !== '')
    const proposal = await this.deps.proposeMessage({ diff, files: staged, style }, staged)
    if (proposal === null)
      throw new AppError('AI_UNAVAILABLE', 'Claude n’a pas pu proposer de message : écris-le toi-même.')
    return proposal
  }

  // ── Écritures ──────────────────────────────────────────────────────────────────────────────────────────────────

  async stage(genesisId: string, paths: readonly string[]): Promise<GitStatusView> {
    const repo = await this.writable(genesisId)
    const sensitive = paths.filter(isSensitivePath)
    if (sensitive.length > 0) {
      throw new AppError('SENSITIVE_FILE', 'Un fichier sensible ne se prépare jamais.', { paths: sensitive })
    }
    for (const path of paths) this.inside(repo, path)
    await this.deps.queue.run(genesisId, repo.gitDir, async () => {
      await this.write(repo, args.stageArgs(paths))
    })
    return this.status(genesisId)
  }

  async unstage(genesisId: string, paths: readonly string[]): Promise<GitStatusView> {
    const repo = await this.writable(genesisId)
    for (const path of paths) this.inside(repo, path)
    await this.deps.queue.run(genesisId, repo.gitDir, async () => {
      const status = await this.readStatus(repo)
      await this.write(repo, args.unstageArgs(paths, status.unborn))
    })
    return this.status(genesisId)
  }

  async commit(
    genesisId: string,
    message: string,
    expectedStaged: readonly string[]
  ): Promise<{ readonly hash: string; readonly branch: string }> {
    const repo = await this.writable(genesisId)
    // L'app n'ajoute jamais de co-auteur (constitution II) : une telle ligne est retirée du message.
    const text = message
      .split(/\r?\n/)
      .filter((line) => !/^\s*co-authored-by:/i.test(line))
      .join('\n')
      .trim()
    if (text === '') throw new AppError('VALIDATION', 'Le message de commit est vide.')
    return this.deps.queue.run(genesisId, repo.gitDir, async () => {
      const started = this.now()
      const status = await this.readStatus(repo)
      const staged = [...new Set(status.entries.filter((entry) => entry.staged).map((entry) => entry.path))]
      if (staged.length === 0) throw new AppError('NOTHING_STAGED', 'Aucun fichier coché.')
      if (!sameSet(staged, expectedStaged)) {
        throw new AppError('STAGED_CHANGED', 'La sélection a changé depuis ton choix : relis la liste.', { staged })
      }
      if (staged.some(isSensitivePath)) throw new AppError('SENSITIVE_FILE', 'Un fichier sensible est préparé.')
      if (status.detached) throw new AppError('DETACHED_HEAD', 'Aucune branche active : crée ou choisis une branche.')
      if (existsSync(join(repo.gitDir, 'MERGE_HEAD'))) {
        throw new AppError('MERGE_IN_PROGRESS', 'Une fusion est en cours : termine-la d’abord.')
      }
      const result = await this.run(repo, args.commitArgs(), {
        stdin: `${text}\n`,
        onPrBranch: status.branch?.startsWith('pr/') === true
      })
      if (result.code !== 0) {
        const output = lastLines(`${result.stdout}${result.stderr}`.trim(), GIT_LIMITS.hookOutput)
        this.journal(genesisId, 'commit', 'failed', started, { branch: status.branch })
        if (/please tell me who you are|user\.(name|email)|unable to auto-detect email/i.test(output)) {
          throw new AppError(
            'IDENTITY_MISSING',
            'Ton identité git n’est pas réglée (git config --global user.name / user.email).'
          )
        }
        throw new AppError(repo.trusted ? 'HOOK_FAILED' : 'GIT_FAILED', 'Le commit a été refusé.', {
          hookOutput: output
        })
      }
      const hash = (await this.read(repo, args.headArgs())).stdout.trim()
      const branch = status.branch ?? ''
      this.journal(genesisId, 'commit', 'ok', started, { commitHash: hash, branch, count: staged.length })
      this.deps.changed(genesisId)
      return { hash, branch }
    })
  }

  async createBranch(genesisId: string, name: string): Promise<GitStatusView> {
    const repo = await this.writable(genesisId)
    await this.deps.queue.run(genesisId, repo.gitDir, async () => {
      const started = this.now()
      const check = await this.read(repo, args.checkRefFormatArgs(name))
      if (check.code !== 0) throw new AppError('INVALID_NAME', 'Ce nom de branche n’est pas valide.')
      const taken = await this.read(repo, args.branchExistsArgs(name))
      if (taken.code === 0) throw new AppError('NAME_TAKEN', 'Une branche porte déjà ce nom.')
      const result = await this.run(repo, args.createBranchArgs(name), {})
      if (result.code !== 0) throw this.switchError(result)
      this.journal(genesisId, 'branch_create', 'ok', started, { branch: name })
    })
    this.deps.changed(genesisId)
    return this.status(genesisId)
  }

  async switchBranch(genesisId: string, name: string): Promise<GitStatusView> {
    const repo = await this.writable(genesisId)
    await this.deps.queue.run(genesisId, repo.gitDir, async () => {
      const started = this.now()
      const result = await this.run(repo, args.switchBranchArgs(name), {})
      if (result.code !== 0) {
        this.journal(genesisId, 'branch_switch', 'failed', started, { branch: name })
        throw this.switchError(result)
      }
      this.journal(genesisId, 'branch_switch', 'ok', started, { branch: name })
    })
    this.deps.changed(genesisId)
    return this.status(genesisId)
  }

  async revert(genesisId: string, hash: string, expectedHead: string): Promise<{ readonly hash: string }> {
    const repo = await this.writable(genesisId)
    return this.deps.queue.run(genesisId, repo.gitDir, async () => {
      const started = this.now()
      const head = (await this.read(repo, args.headArgs())).stdout.trim()
      if (!head.startsWith(expectedHead))
        throw new AppError('HEAD_CHANGED', 'Le dépôt a changé depuis ton choix : relis l’historique.')
      const status = await this.readStatus(repo)
      if (status.entries.some((entry) => entry.status !== '?')) {
        throw new AppError('DIRTY_TREE', 'Des fichiers sont modifiés : commite-les ou mets-les de côté d’abord.')
      }
      const parents = (await this.read(repo, args.parentsArgs(hash))).stdout.trim().split(/\s+/)
      if (parents.length === 0 || parents[0] === '') throw new AppError('NOT_FOUND', 'Commit introuvable.')
      if (parents.length > 2) throw new AppError('MERGE_COMMIT', 'Annuler un commit de fusion n’est pas proposé.')
      const result = await this.run(repo, args.revertArgs(hash), {
        onPrBranch: status.branch?.startsWith('pr/') === true
      })
      if (result.code !== 0) {
        if (existsSync(join(repo.gitDir, 'REVERT_HEAD'))) {
          await this.run(repo, args.revertAbortArgs(), {})
          this.journal(genesisId, 'revert', 'failed', started, { errorCode: 'CONFLICTS_ABORTED' })
          throw new AppError('CONFLICTS_ABORTED', 'L’annulation entrait en conflit : rien n’a changé.')
        }
        this.journal(genesisId, 'revert', 'failed', started, { errorCode: 'HOOK_FAILED' })
        throw new AppError('HOOK_FAILED', 'L’annulation a été refusée.', {
          hookOutput: lastLines(`${result.stdout}${result.stderr}`.trim(), GIT_LIMITS.hookOutput)
        })
      }
      const newHead = (await this.read(repo, args.headArgs())).stdout.trim()
      this.journal(genesisId, 'revert', 'ok', started, { commitHash: newHead, branch: status.branch })
      this.deps.changed(genesisId)
      return { hash: newHead }
    })
  }

  // ── Outils ─────────────────────────────────────────────────────────────────────────────────────────────────────

  /** Dépôt git utilisable (sinon `NOT_FOUND` ou `RISKY_CONFIG`). */
  private ready(genesisId: string): Promise<ReadyRepo> {
    return this.access.ready(genesisId)
  }

  private writable(genesisId: string): Promise<ReadyRepo> {
    return this.access.writable(genesisId)
  }

  private operationOf(repo: ReadyRepo): GitStatusView['operation'] {
    return this.access.operationOf(repo)
  }

  private inside(repo: ReadyRepo, path: string): string {
    return this.access.inside(repo, path)
  }

  private readStatus(repo: ReadyRepo): Promise<ParsedStatus & { readonly total: number }> {
    return this.access.readStatus(repo)
  }

  private read(
    repo: ReadyRepo,
    command: readonly string[],
    options: Partial<GitRunOptions> = {}
  ): Promise<ProcessResult> {
    return this.access.read(repo, command, options)
  }

  private run(repo: ReadyRepo, command: readonly string[], options: Partial<GitRunOptions>): Promise<ProcessResult> {
    return this.access.run(repo, command, options)
  }

  private write(repo: ReadyRepo, command: readonly string[]): Promise<void> {
    return this.access.write(repo, command)
  }

  private switchError(result: ProcessResult): AppError {
    const output = `${result.stdout}\n${result.stderr}`
    if (/would be overwritten/i.test(output)) {
      const files = output
        .split('\n')
        .filter((line) => /^\t/.test(line))
        .map((line) => line.trim())
        .slice(0, 50)
      return new AppError('DIRTY_TREE', 'Des fichiers modifiés seraient écrasés : commite-les d’abord.', { files })
    }
    if (/invalid reference|did not match|not a valid branch/i.test(output)) {
      return new AppError('NOT_FOUND', 'Branche introuvable.')
    }
    return new AppError('GIT_FAILED', lastLines(result.stderr.trim(), 400) || 'git a échoué.')
  }

  private journal(
    genesisId: string,
    kind: GitOperationKind,
    status: 'ok' | 'failed',
    started: Date,
    extra: {
      readonly commitHash?: string
      readonly branch?: string | null
      readonly count?: number
      readonly errorCode?: string
    }
  ): void {
    this.deps.repository.logOperation({
      genesisId,
      kind,
      status,
      startedAt: started.toISOString(),
      finishedAt: this.now().toISOString(),
      ...(extra.commitHash === undefined ? {} : { commitHash: extra.commitHash }),
      ...(extra.branch === undefined ? {} : { branch: extra.branch }),
      ...(extra.count === undefined ? {} : { count: extra.count }),
      ...(extra.errorCode === undefined ? {} : { errorCode: extra.errorCode })
    })
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date()
  }
}
