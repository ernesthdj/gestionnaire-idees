import type { GitStatusView } from '@shared/git/model'
import type { PushPreviewView } from '@shared/git/sync'
import { checkGitUrl } from '@shared/reprise/gitUrl'
import { z } from 'zod'
import * as args from '../../domain/git/args'
import { ghRepoViewArgs } from '../../domain/git/ghArgs'
import { pushVerdict, unacceptedFindings, type RepoPermission } from '../../domain/git/pushRules'
import { AppError } from '../../domain/errors'
import type { GhRunner } from '../../infrastructure/git/GhRunner'
import type { GitRepository } from '../../infrastructure/db/repositories/GitRepository'
import type { GitWriteQueue } from '../../infrastructure/git/GitWriteQueue'
import type { ProcessResult } from '../../infrastructure/process/ProcessRunner'
import { lastLines, type GitAccess, type ReadyRepo } from './GitAccess'
import { scanOutgoing } from './SensitiveScan'

export interface SyncDeps {
  readonly access: GitAccess
  readonly queue: Pick<GitWriteQueue, 'run'>
  readonly repository: Pick<GitRepository, 'repo' | 'saveRepo'>
  readonly gh: Pick<GhRunner, 'run' | 'status'>
  readonly status: (genesisId: string) => Promise<GitStatusView>
  readonly changed: (genesisId: string) => void
  readonly now?: () => Date
}

/** Délai d'une commande réseau (fetch, push). */
const NETWORK_TIMEOUT_MS = 120_000
const MAX_COMMITS_SHOWN = 200

const RepoView = z.looseObject({
  viewerPermission: z.string().nullish(),
  owner: z.looseObject({ login: z.string() }),
  defaultBranchRef: z.looseObject({ name: z.string() }).nullish()
})

const PERMISSIONS: Readonly<Record<string, RepoPermission>> = {
  ADMIN: 'admin',
  MAINTAIN: 'maintain',
  WRITE: 'write',
  TRIAGE: 'triage',
  READ: 'read'
}

/** Erreur réseau de git en mots (jamais la sortie brute, qui peut contenir l'adresse avec identifiant). */
function networkError(result: ProcessResult): AppError {
  const output = result.stderr
  if (/authentication failed|could not read username|permission denied|403|401/i.test(output)) {
    return new AppError(
      'AUTH_FAILED',
      'Accès refusé : connecte-toi à ce dépôt (gh auth login ou ton gestionnaire Git).'
    )
  }
  if (/could not resolve host|unable to access|timed out|network|connection/i.test(output)) {
    return new AppError('NETWORK', 'Le distant ne répond pas : vérifie ta connexion.')
  }
  if (/repository not found|not found/i.test(output)) return new AppError('NOT_FOUND', 'Dépôt distant introuvable.')
  return new AppError('GIT_FAILED', 'git a échoué en contactant le distant.')
}

/**
 * Publier, tirer, pousser (spec 021 US2) — partie synchronisation : vérifier le distant (`fetch`, sur geste ou à
 * l'ouverture du volet), tirer en avance rapide, fusionner deux historiques divergents après confirmation, aperçu puis
 * push d'une branche vers une branche, après contrôle des fichiers sensibles de toute la plage et des droits (R10).
 * Aucune commande de forçage n'est constructible ; tout se fait sur l'état que mentalyas a vu (research R5).
 */
export class SyncService {
  constructor(private readonly deps: SyncDeps) {}

  async fetch(genesisId: string): Promise<GitStatusView> {
    const repo = await this.deps.access.ready(genesisId)
    const remote = await this.remoteOf(repo)
    if (remote === null) throw new AppError('NO_REMOTE', 'Ce dépôt n’a pas de distant : publie-le d’abord.')
    const result = await this.deps.access.run(repo, args.fetchArgs(remote), { timeoutMs: NETWORK_TIMEOUT_MS })
    if (result.code !== 0) throw networkError(result)
    this.deps.repository.saveRepo(genesisId, { lastFetchAt: this.now().toISOString() })
    this.deps.changed(genesisId)
    return this.deps.status(genesisId)
  }

  /** Tirer : avance rapide seulement ; deux historiques divergents → `diverged` (fusion proposée à part). */
  async pull(genesisId: string): Promise<{
    readonly result: 'up_to_date' | 'fast_forward' | 'diverged'
    readonly incoming: number
    /** Divergence : empreinte du distant vue, à renvoyer pour fusionner (research R5). */
    readonly upstreamHead?: string
  }> {
    const repo = await this.deps.access.writable(genesisId)
    return this.deps.queue.run(genesisId, repo.gitDir, async () => {
      const status = await this.deps.access.readStatus(repo)
      if (status.upstream === null) throw new AppError('NO_UPSTREAM', 'Cette branche ne suit aucune branche distante.')
      if (status.entries.some((entry) => entry.status !== '?')) {
        throw new AppError('DIRTY_TREE', 'Des fichiers sont modifiés : commite-les avant de tirer.')
      }
      const upstream = `${status.upstream.remote}/${status.upstream.branch}`
      const behind = status.behind
      if (behind === 0) return { result: 'up_to_date' as const, incoming: 0 }
      if (status.ahead > 0) {
        const ref = `refs/remotes/${status.upstream.remote}/${status.upstream.branch}`
        const upstreamHead = (await this.deps.access.read(repo, args.refHeadArgs(ref))).stdout.trim()
        return { result: 'diverged' as const, incoming: behind, upstreamHead }
      }
      const merged = await this.deps.access.run(repo, args.pullFfArgs(upstream), {})
      if (merged.code !== 0) throw new AppError('GIT_FAILED', lastLines(merged.stderr.trim(), 400) || 'git a échoué.')
      this.deps.changed(genesisId)
      return { result: 'fast_forward' as const, incoming: behind }
    })
  }

  /** Fusion de deux historiques (après confirmation) ; tant que les conflits guidés (US4) n'existent pas, on abandonne. */
  async merge(
    genesisId: string,
    expectedUpstreamHead: string
  ): Promise<{ readonly result: 'merged'; readonly hash: string }> {
    const repo = await this.deps.access.writable(genesisId)
    return this.deps.queue.run(genesisId, repo.gitDir, async () => {
      const status = await this.deps.access.readStatus(repo)
      if (status.upstream === null) throw new AppError('NO_UPSTREAM', 'Cette branche ne suit aucune branche distante.')
      if (status.entries.some((entry) => entry.status !== '?')) {
        throw new AppError('DIRTY_TREE', 'Des fichiers sont modifiés : commite-les avant de fusionner.')
      }
      const ref = `refs/remotes/${status.upstream.remote}/${status.upstream.branch}`
      const upstreamHead = (await this.deps.access.read(repo, args.refHeadArgs(ref))).stdout.trim()
      if (upstreamHead !== expectedUpstreamHead) {
        throw new AppError('UPSTREAM_CHANGED', 'Le distant a changé depuis ton aperçu : vérifie de nouveau.')
      }
      const merged = await this.deps.access.run(repo, args.mergeArgs(upstreamHead), {})
      if (merged.code !== 0) {
        await this.deps.access.run(repo, args.mergeAbortArgs(), {})
        this.deps.changed(genesisId)
        throw new AppError(
          'CONFLICTS_ABORTED',
          'La fusion a des conflits : elle a été annulée, ton dépôt est intact. Résous-la en terminal pour l’instant.'
        )
      }
      this.deps.changed(genesisId)
      return { result: 'merged' as const, hash: (await this.deps.access.head(repo)) ?? '' }
    })
  }

  async pushPreview(genesisId: string): Promise<PushPreviewView> {
    const repo = await this.deps.access.writable(genesisId)
    const status = await this.deps.access.readStatus(repo)
    if (status.detached || status.branch === null) {
      throw new AppError('DETACHED_HEAD', 'Tu n’es sur aucune branche : passe sur une branche pour pousser.')
    }
    const remote = status.upstream?.remote ?? (await this.remoteOf(repo))
    if (remote === null) throw new AppError('NO_REMOTE', 'Ce dépôt n’a pas de distant : publie-le d’abord.')
    const branch = status.branch
    const targetBranch = status.upstream?.branch ?? branch
    const upstream = status.upstream === null ? null : `${status.upstream.remote}/${status.upstream.branch}`
    const range = { branch, remote, upstream }
    const total =
      Number((await this.deps.access.read(repo, args.outgoingCountArgs(branch, remote, upstream))).stdout.trim()) || 0
    const log = await this.deps.access.read(repo, args.outgoingArgs(branch, remote, upstream, MAX_COMMITS_SHOWN))
    const commits = log.stdout
      .split('\0')
      .filter((record) => record.trim() !== '')
      .map((record) => {
        const [hash = '', date = '', subject = ''] = record.replace(/^\n/, '').split('\x1f')
        return { hash, date, subject }
      })
    const scan = await scanOutgoing(this.deps.access, repo, range)
    const remoteUrl = await this.remoteDisplay(repo, remote)
    const github = await this.githubOf(genesisId, remoteUrl)
    const verdict = pushVerdict({ findings: scan.findings, github, targetBranch })
    return {
      remote,
      remoteUrl: remoteUrl ?? '',
      githubRepo: github === null ? null : (this.deps.repository.repo(genesisId)?.githubRepo ?? null),
      branch,
      targetBranch,
      firstPush: upstream === null,
      head: (await this.deps.access.head(repo)) ?? '',
      commits,
      total,
      findings: scan.findings,
      namesOnly: scan.namesOnly,
      permission: github?.permission ?? 'unknown',
      isDefaultBranch: verdict.isDefaultBranch,
      ownedByViewer: verdict.ownedByViewer,
      blocked: verdict.blocked,
      checkedAt: this.now().toISOString()
    }
  }

  /** Push d'une branche vers une branche, sur l'état vu ; constats non bloquants acceptés un par un. */
  async push(input: {
    readonly genesisId: string
    readonly expectedHead: string
    readonly expectedRemote: string
    readonly expectedBranch: string
    readonly acceptFindings: readonly string[]
  }): Promise<{ readonly pushed: number }> {
    const repo = await this.deps.access.writable(input.genesisId)
    return this.deps.queue.run(input.genesisId, repo.gitDir, async () => {
      const preview = await this.pushPreview(input.genesisId)
      if (
        preview.head !== input.expectedHead ||
        preview.remote !== input.expectedRemote ||
        preview.branch !== input.expectedBranch
      ) {
        throw new AppError('HEAD_CHANGED', 'Le dépôt a changé depuis ton aperçu : relis-le avant de pousser.')
      }
      if (preview.blocked !== null) throw new AppError(preview.blocked, blockText(preview.blocked))
      if (unacceptedFindings(preview.findings, input.acceptFindings).length > 0) {
        throw new AppError('SENSITIVE_IN_HISTORY', 'Des constats n’ont pas été acceptés : relis-les avant de pousser.')
      }
      if (preview.total === 0) return { pushed: 0 }
      const result = await this.deps.access.run(
        repo,
        args.pushArgs(preview.remote, preview.branch, preview.targetBranch, preview.firstPush),
        { timeoutMs: NETWORK_TIMEOUT_MS }
      )
      if (result.code !== 0) {
        if (/\[rejected\]|non-fast-forward|fetch first/i.test(`${result.stdout}\n${result.stderr}`)) {
          throw new AppError('NON_FAST_FORWARD', 'Le distant a des commits que tu n’as pas : tire d’abord.')
        }
        if (/pre-push hook|hook declined/i.test(result.stderr)) {
          throw new AppError('HOOK_FAILED', 'Le hook pre-push a refusé le push.', {
            hookOutput: lastLines(result.stderr, 8_000)
          })
        }
        throw networkError(result)
      }
      this.deps.changed(input.genesisId)
      return { pushed: preview.total }
    })
  }

  /** Abandon d'une fusion ouverte par l'app. */
  async mergeAbort(genesisId: string): Promise<GitStatusView> {
    const repo = await this.deps.access.ready(genesisId)
    if (this.deps.access.operationOf(repo) !== 'merge') throw new AppError('NO_MERGE', 'Aucune fusion en cours.')
    await this.deps.queue.run(genesisId, repo.gitDir, () => this.deps.access.write(repo, args.mergeAbortArgs()))
    this.deps.changed(genesisId)
    return this.deps.status(genesisId)
  }

  /** Remote à utiliser : `origin` s'il existe, sinon le seul remote, sinon `null`. */
  private async remoteOf(repo: ReadyRepo): Promise<string | null> {
    const remotes = (await this.deps.access.read(repo, args.remotesArgs())).stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== '')
    if (remotes.includes('origin')) return 'origin'
    return remotes.length === 1 ? (remotes[0] ?? null) : null
  }

  /** Adresse du remote sans identifiant ; `null` si illisible. */
  private async remoteDisplay(repo: ReadyRepo, remote: string): Promise<string | null> {
    const url = (await this.deps.access.read(repo, args.remoteUrlArgs(remote))).stdout.trim()
    const check = checkGitUrl(url)
    return check.ok ? check.display : url === '' ? null : 'dépôt local'
  }

  /** Droits GitHub (R10), si le remote est sur github.com et que `gh` est connecté ; sinon `null` (hors GitHub). */
  private async githubOf(
    genesisId: string,
    remoteUrl: string | null
  ): Promise<Parameters<typeof pushVerdict>[0]['github']> {
    const check = remoteUrl === null ? null : checkGitUrl(remoteUrl)
    if (
      check === null ||
      !check.ok ||
      check.host !== 'github.com' ||
      check.owner === undefined ||
      check.repo === undefined
    ) {
      return null
    }
    const repoName = `${check.owner}/${check.repo.replace(/\.git$/, '')}`
    this.deps.repository.saveRepo(genesisId, { githubRepo: repoName })
    const status = await this.deps.gh.status()
    if (status.login === null) {
      return { permission: 'unknown', ownerLogin: check.owner, viewerLogin: null, defaultBranch: null }
    }
    try {
      const result = await this.deps.gh.run(ghRepoViewArgs(repoName))
      const parsed = RepoView.safeParse(JSON.parse(result.stdout))
      if (result.code !== 0 || !parsed.success) {
        return { permission: 'unknown', ownerLogin: check.owner, viewerLogin: status.login, defaultBranch: null }
      }
      return {
        permission: PERMISSIONS[parsed.data.viewerPermission ?? ''] ?? 'none',
        ownerLogin: parsed.data.owner.login,
        viewerLogin: status.login,
        defaultBranch: parsed.data.defaultBranchRef?.name ?? null
      }
    } catch {
      return { permission: 'unknown', ownerLogin: check.owner, viewerLogin: status.login, defaultBranch: null }
    }
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date()
  }
}

export function blockText(block: NonNullable<PushPreviewView['blocked']>): string {
  switch (block) {
    case 'SENSITIVE_IN_HISTORY':
      return 'Un fichier sensible est dans les commits à pousser : retire-le de l’historique avant de pousser.'
    case 'THIRD_PARTY_DEFAULT_BRANCH':
      return 'C’est la branche principale d’un dépôt qui n’est pas à toi : crée une branche et propose une PR.'
    case 'NO_WRITE_ACCESS':
      return 'Tu n’as pas le droit d’écrire dans ce dépôt : fais-en un fork.'
  }
}
