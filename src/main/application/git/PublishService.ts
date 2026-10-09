import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { GitStatusView } from '@shared/git/model'
import type { PublishPreviewView } from '@shared/git/sync'
import { checkGitUrl } from '@shared/reprise/gitUrl'
import * as args from '../../domain/git/args'
import { ghRepoCreateArgs, REPO_NAME } from '../../domain/git/ghArgs'
import { GITIGNORE } from '../../domain/projects/project'
import { AppError } from '../../domain/errors'
import type { GhRunner } from '../../infrastructure/git/GhRunner'
import type { GitRepository } from '../../infrastructure/db/repositories/GitRepository'
import type { GitWriteQueue } from '../../infrastructure/git/GitWriteQueue'
import { writeIfAbsent } from '../../infrastructure/projects/ProjectFolder'
import type { GitAccess, ReadyRepo } from './GitAccess'
import { scanOutgoing } from './SensitiveScan'

export interface PublishDeps {
  readonly access: GitAccess
  readonly queue: Pick<GitWriteQueue, 'run'>
  readonly repository: Pick<GitRepository, 'saveRepo'>
  readonly gh: Pick<GhRunner, 'run' | 'status'>
  readonly status: (genesisId: string) => Promise<GitStatusView>
  readonly changed: (genesisId: string) => void
}

/** Nom proposé pour le dépôt GitHub : celui du dossier, ramené aux caractères permis. */
export function suggestedRepoName(dir: string): string {
  const name = basename(dir)
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[.-]+/, '')
    .slice(0, 100)
  return REPO_NAME.test(name) ? name : 'projet'
}

/**
 * Publier un dépôt local sur GitHub (spec 021 US2, research R9) : `gh repo create` SANS `--source` ni `--push` (git
 * n'est jamais lancé par `gh`), privé par défaut, public seulement après une seconde confirmation ; puis `git remote
 * add origin` et le push de la branche par le `GitRunner`. Un fichier sensible dans l'historique bloque tout, sans
 * contournement. Si le push échoue après la création, le dépôt reste « créé, pas encore poussé ».
 */
export class PublishService {
  constructor(private readonly deps: PublishDeps) {}

  async preview(genesisId: string): Promise<PublishPreviewView> {
    const repo = await this.deps.access.writable(genesisId)
    const gh = await this.deps.gh.status()
    if (!gh.installed) throw new AppError('GH_MISSING', 'gh (GitHub CLI) est introuvable : installe-le pour publier.')
    if (gh.login === null) {
      throw new AppError('GH_NOT_LOGGED_IN', 'gh n’est pas connecté : lance « gh auth login » dans un terminal.')
    }
    const remotes = (await this.deps.access.read(repo, args.remotesArgs())).stdout.trim()
    if (remotes !== '') throw new AppError('HAS_REMOTE', 'Ce dépôt a déjà un distant : pousse plutôt.')
    const status = await this.deps.access.readStatus(repo)
    if (status.branch === null || status.detached) {
      throw new AppError('DETACHED_HEAD', 'Tu n’es sur aucune branche : passe sur une branche pour publier.')
    }
    const head = await this.deps.access.head(repo)
    if (head === null) throw new AppError('NOTHING_TO_PUSH', 'Aucun commit à publier : commite d’abord.')
    const count = Number((await this.deps.access.read(repo, args.countArgs('HEAD'))).stdout.trim()) || 0
    const scan = await scanOutgoing(this.deps.access, repo, { branch: status.branch, remote: 'origin', upstream: null })
    return {
      login: gh.login,
      suggestedName: suggestedRepoName(repo.dir),
      branch: status.branch,
      head,
      commitsToPush: count,
      hasGitignore: existsSync(join(repo.dir, '.gitignore')),
      findings: scan.findings,
      blocked: scan.findings.some((finding) => finding.blocking)
    }
  }

  async publish(input: {
    readonly genesisId: string
    readonly name: string
    readonly description: string
    readonly visibility: 'private' | 'public'
    readonly confirmPublic: boolean
    readonly expectedHead: string
  }): Promise<{ readonly githubRepo: string; readonly url: string }> {
    if (input.visibility === 'public' && !input.confirmPublic) {
      throw new AppError('PUBLIC_NOT_CONFIRMED', 'Confirme une seconde fois pour un dépôt public.')
    }
    if (!REPO_NAME.test(input.name)) throw new AppError('NAME_INVALID', 'Nom de dépôt GitHub invalide.')
    const repo = await this.deps.access.writable(input.genesisId)
    return this.deps.queue.run(input.genesisId, repo.gitDir, async () => {
      const preview = await this.preview(input.genesisId)
      if (preview.head !== input.expectedHead) {
        throw new AppError('HEAD_CHANGED', 'Le dépôt a changé depuis ton aperçu : relis-le avant de publier.')
      }
      if (preview.blocked) {
        throw new AppError('SENSITIVE_IN_HISTORY', 'Un fichier sensible est dans l’historique : rien n’est publié.')
      }
      const created = await this.deps.gh.run(ghRepoCreateArgs(input.name, input.visibility, input.description))
      if (created.code !== 0) {
        if (/already exists|name already/i.test(created.stderr)) {
          throw new AppError('NAME_TAKEN', 'Tu as déjà un dépôt GitHub de ce nom.')
        }
        throw new AppError('GH_FAILED', 'GitHub a refusé la création du dépôt.')
      }
      const url = this.createdUrl(created.stdout, preview.login, input.name)
      await this.deps.access.write(repo, args.remoteAddArgs(url))
      const githubRepo = `${preview.login}/${input.name}`
      this.deps.repository.saveRepo(input.genesisId, { githubRepo, defaultRemote: 'origin', remoteUrl: url })
      await this.pushFirst(repo, preview.branch)
      this.deps.changed(input.genesisId)
      return { githubRepo, url }
    })
  }

  /** Ajoute le `.gitignore` de ProjectMaster s'il manque (proposé avant de publier). */
  async addGitignore(genesisId: string): Promise<GitStatusView> {
    const repo = await this.deps.access.writable(genesisId)
    if (existsSync(join(repo.dir, '.gitignore'))) throw new AppError('CONFLICT', 'Ce projet a déjà un .gitignore.')
    writeIfAbsent(join(repo.dir, '.gitignore'), GITIGNORE)
    this.deps.changed(genesisId)
    return this.deps.status(genesisId)
  }

  private async pushFirst(repo: ReadyRepo, branch: string): Promise<void> {
    const pushed = await this.deps.access.run(repo, args.pushArgs('origin', branch, branch, true), {
      timeoutMs: 120_000
    })
    if (pushed.code !== 0) {
      throw new AppError(
        'PUSH_FAILED',
        'Le dépôt GitHub est créé, mais le premier push a échoué : réessaie « Pousser » depuis le volet.'
      )
    }
  }

  /** Adresse du dépôt créé (sortie de `gh`), contrôlée ; sinon l'adresse attendue. */
  private createdUrl(output: string, login: string, name: string): string {
    const fromGh = output
      .trim()
      .split(/\s+/)
      .find((word) => word.startsWith('https://github.com/'))
    const candidate = `${fromGh ?? `https://github.com/${login}/${name}`}`.replace(/\/$/, '')
    const url = candidate.endsWith('.git') ? candidate : `${candidate}.git`
    const check = checkGitUrl(url)
    if (!check.ok || check.hadCredentials || check.host !== 'github.com') {
      throw new AppError('GH_FAILED', 'Adresse du dépôt créé inattendue : rien n’a été relié.')
    }
    return check.display
  }
}
