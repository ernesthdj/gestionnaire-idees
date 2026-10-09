import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import type { GitStatusView } from '@shared/git/model'
import { GIT_LIMITS } from '@shared/git/model'
import * as args from '../../domain/git/args'
import { parseStatus, type ParsedStatus } from '../../domain/git/parse'
import { AppError } from '../../domain/errors'
import type { GitRunner, GitRunOptions } from '../../infrastructure/git/GitRunner'
import type { GitRepository } from '../../infrastructure/db/repositories/GitRepository'
import type { ProcessResult } from '../../infrastructure/process/ProcessRunner'
import type { RepoContext, RepoLocator } from './RepoLocator'

/** Dépôt utilisable : un dépôt git, pas en mode « configuration à risque ». */
export interface ReadyRepo extends RepoContext {
  readonly gitDir: string
}

export interface GitAccessDeps {
  readonly locator: Pick<RepoLocator, 'locate'>
  readonly runner: Pick<GitRunner, 'run'>
  readonly repository: Pick<GitRepository, 'openMergeHead'>
}

export const lastLines = (text: string, max: number): string => (text.length <= max ? text : text.slice(-max))

/**
 * Accès commun au dépôt d'un genesis (spec 021) : dépôt prêt (ni absent ni « configuration à risque »), dépôt
 * modifiable (aucune opération lancée hors de l'app), lectures et écritures par le `GitRunner` avec la confiance du
 * projet, état analysé. Partagé par les services du dépôt local, de la synchronisation et de la publication.
 */
export class GitAccess {
  constructor(private readonly deps: GitAccessDeps) {}

  async ready(genesisId: string): Promise<ReadyRepo> {
    const context = await this.deps.locator.locate(genesisId)
    if (context.gitDir === null) throw new AppError('NOT_FOUND', 'Ce projet n’est pas un dépôt git.')
    if (context.blocked) {
      throw new AppError('RISKY_CONFIG', 'Configuration à risque : aucune commande git n’est lancée.', {
        keys: context.risky.blocking
      })
    }
    return context as ReadyRepo
  }

  /** Dépôt où l'app peut écrire : pas d'opération lancée hors de l'app (rebase, fusion en terminal…). */
  async writable(genesisId: string): Promise<ReadyRepo> {
    const repo = await this.ready(genesisId)
    if (this.operationOf(repo) === 'other') {
      throw new AppError('READ_ONLY_STATE', 'Une opération git est en cours hors de l’app : termine-la en terminal.')
    }
    return repo
  }

  /** `merge` : fusion ouverte par l'app (même `MERGE_HEAD`) ; `other` : toute opération lancée ailleurs. */
  operationOf(repo: ReadyRepo): GitStatusView['operation'] {
    const has = (name: string): boolean => existsSync(join(repo.gitDir, name))
    if (has('MERGE_HEAD')) {
      const mergeHead = readFileSync(join(repo.gitDir, 'MERGE_HEAD'), 'utf8').trim().split(/\s+/)[0] ?? ''
      return this.deps.repository.openMergeHead(repo.genesisId) === mergeHead ? 'merge' : 'other'
    }
    return has('rebase-merge') ||
      has('rebase-apply') ||
      has('CHERRY_PICK_HEAD') ||
      has('REVERT_HEAD') ||
      has('BISECT_LOG')
      ? 'other'
      : 'none'
  }

  /** Chemin d'un fichier dans le dépôt, sans en sortir. */
  inside(repo: ReadyRepo, path: string): string {
    const full = resolve(repo.dir, path)
    const rel = relative(repo.dir, full)
    if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) throw new AppError('VALIDATION', 'Chemin hors du dépôt.')
    return full
  }

  async readStatus(repo: ReadyRepo): Promise<ParsedStatus & { readonly total: number }> {
    const result = await this.read(repo, args.statusArgs(), { maxOutput: 8 * 1024 * 1024 })
    return parseStatus(result.stdout, GIT_LIMITS.statusFiles)
  }

  async read(
    repo: ReadyRepo,
    command: readonly string[],
    options: Partial<GitRunOptions> = {}
  ): Promise<ProcessResult> {
    const result = await this.deps.runner.run(repo.dir, command, { ...options, trusted: repo.trusted, read: true })
    return checked(result)
  }

  async run(repo: ReadyRepo, command: readonly string[], options: Partial<GitRunOptions> = {}): Promise<ProcessResult> {
    const result = await this.deps.runner.run(repo.dir, command, { ...options, trusted: repo.trusted })
    return checked(result)
  }

  async write(repo: ReadyRepo, command: readonly string[]): Promise<void> {
    const result = await this.run(repo, command, {})
    if (result.code !== 0) throw new AppError('GIT_FAILED', lastLines(result.stderr.trim(), 400) || 'git a échoué.')
  }

  /** Empreinte de HEAD ; `null` sur une branche sans commit. */
  async head(repo: ReadyRepo): Promise<string | null> {
    const result = await this.read(repo, args.headArgs())
    return result.code === 0 ? result.stdout.trim() : null
  }
}

function checked(result: ProcessResult): ProcessResult {
  if (result.spawnFailed) throw new AppError('GIT_MISSING', 'git est introuvable : installe Git pour Windows.')
  if (result.timedOut) throw new AppError('TIMEOUT', 'git n’a pas répondu à temps.')
  return result
}
