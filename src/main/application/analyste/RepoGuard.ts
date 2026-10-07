import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { join, relative, resolve, isAbsolute } from 'node:path'
import type { AnalysteInactiveReason } from '@shared/ipc/analyste'
import { AppError } from '../../domain/errors'
import type { GitResult } from '../../infrastructure/projects/GitCli'

/** Nom du paquet du Brainstormer (`package.json`). */
const PACKAGE_NAME = 'gestionnaire-idees'
/** Fichier qui distingue le dépôt du Brainstormer d'un autre dépôt du même nom. */
const MARKER = join('src', 'main', 'bootstrap.ts')
/** Nom du secret de la clé HMAC (empreintes et pseudonymes, spec 019 R3). */
export const HMAC_SECRET = 'analyste-hmac'

export interface RepoGuardDeps {
  readonly isPackaged: boolean
  /** Dossier d'où tourne l'app (`app.getAppPath()`). */
  readonly appPath: string
  readonly git: (cwd: string, args: readonly string[]) => Promise<GitResult>
  readonly storedRepo: () => string | null
  readonly storeRepo: (path: string) => void
  readonly secrets: { getOrCreateRandomKey(name: string): string; get(name: string): string | null }
}

export interface RepoState {
  readonly available: boolean
  readonly active: boolean
  readonly repoPath: string | null
  readonly reason: AnalysteInactiveReason | null
}

export const real = (path: string): string | null => {
  try {
    return realpathSync.native(path)
  } catch {
    return null
  }
}

/** Même dossier, en ignorant la casse et le séparateur sous Windows. */
export const sameDir = (a: string, b: string): boolean => {
  const norm = (path: string): string => {
    const clean = resolve(path).replace(/[\\/]+$/, '')
    return process.platform === 'win32' ? clean.toLowerCase() : clean
  }
  return norm(a) === norm(b)
}

export const inside = (child: string, parent: string): boolean => {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/**
 * Garde du dépôt source (spec 019 FR-001, FR-002, R12) : l'Analyste n'existe que si l'app tourne depuis un dépôt git
 * du Brainstormer désigné par mentalyas. Revérifié au démarrage et chaque heure : un dépôt déplacé met la sonde en
 * pause, sans rien effacer.
 */
export class RepoGuard {
  private state: RepoState

  constructor(private readonly deps: RepoGuardDeps) {
    this.state = deps.isPackaged
      ? { available: false, active: false, repoPath: null, reason: 'PACKAGED_APP' }
      : { available: true, active: false, repoPath: deps.storedRepo(), reason: 'NOT_DESIGNATED' }
  }

  current(): RepoState {
    return this.state
  }

  /** Dossier choisi au sélecteur natif : vérifié, enregistré, la clé HMAC est créée. */
  async designate(dir: string): Promise<RepoState> {
    if (this.deps.isPackaged) throw new AppError('PACKAGED_APP', "L'Analyste n'existe pas dans l'app installée")
    const problem = await this.verify(dir)
    if (problem === 'NOT_A_REPO' || problem === 'REPO_MOVED') {
      throw new AppError('NOT_BRAINSTORMER_REPO', "Ce dossier n'est pas un dépôt git du Brainstormer")
    }
    if (problem !== null) throw new AppError(problem, this.messageOf(problem))
    const path = real(dir) ?? dir
    this.deps.storeRepo(path)
    this.deps.secrets.getOrCreateRandomKey(HMAC_SECRET)
    this.state = { available: true, active: true, repoPath: path, reason: null }
    return this.state
  }

  /** Revérifie le dépôt enregistré (démarrage, chaque heure). */
  async check(): Promise<RepoState> {
    if (this.deps.isPackaged) return this.state
    const stored = this.deps.storedRepo()
    if (stored === null) {
      this.state = { available: true, active: false, repoPath: null, reason: 'NOT_DESIGNATED' }
      return this.state
    }
    const problem = await this.verify(stored)
    const reason: AnalysteInactiveReason | null =
      problem === null ? null : problem === 'REPO_MOVED' || problem === 'NOT_A_REPO' ? problem : 'NOT_A_REPO'
    const active = reason === null && this.deps.secrets.get(HMAC_SECRET) !== null
    this.state = { available: true, active, repoPath: stored, reason: active ? null : (reason ?? 'NOT_DESIGNATED') }
    return this.state
  }

  /** Clé des empreintes, seulement quand la sonde est active. */
  hmacKey(): string | null {
    return this.state.active ? this.deps.secrets.get(HMAC_SECRET) : null
  }

  private async verify(
    dir: string
  ): Promise<'REPO_MOVED' | 'NOT_A_REPO' | 'NOT_BRAINSTORMER_REPO' | 'NOT_RUNNING_FROM_REPO' | null> {
    const path = real(dir)
    if (path === null) return 'REPO_MOVED'
    const top = await this.deps.git(path, ['rev-parse', '--show-toplevel'])
    if (top.code !== 0 || !sameDir(real(top.output.trim()) ?? top.output.trim(), path)) return 'NOT_A_REPO'
    if (!existsSync(join(path, MARKER)) || this.packageName(path) !== PACKAGE_NAME) return 'NOT_BRAINSTORMER_REPO'
    const app = real(this.deps.appPath) ?? this.deps.appPath
    if (!inside(app, path)) return 'NOT_RUNNING_FROM_REPO'
    return null
  }

  private packageName(dir: string): string | null {
    try {
      const parsed: unknown = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
      return typeof parsed === 'object' && parsed !== null && 'name' in parsed && typeof parsed.name === 'string'
        ? parsed.name
        : null
    } catch {
      return null
    }
  }

  private messageOf(code: 'NOT_BRAINSTORMER_REPO' | 'NOT_RUNNING_FROM_REPO'): string {
    return code === 'NOT_BRAINSTORMER_REPO'
      ? "Ce dossier n'est pas un dépôt git du Brainstormer"
      : "L'app ne tourne pas depuis ce dépôt : lance-la avec npm run dev depuis ce dossier"
  }
}
