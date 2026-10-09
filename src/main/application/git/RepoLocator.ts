import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { localConfigNamesArgs } from '../../domain/git/args'
import { parseConfigNames } from '../../domain/git/parse'
import { classifyConfig, type RiskyConfig } from '../../domain/git/riskyConfig'
import { projectKey } from '../../domain/conversation/permissions'
import { AppError } from '../../domain/errors'
import type { GitRunner } from '../../infrastructure/git/GitRunner'

/** Dépôt d'un genesis, prêt à recevoir des commandes git (ou pas : `blocked`). */
export interface RepoContext {
  readonly genesisId: string
  /** Dossier réel du projet. */
  readonly dir: string
  /** Dossier `.git` réel (`null` : pas de dépôt). */
  readonly gitDir: string | null
  readonly trusted: boolean
  readonly risky: RiskyConfig
  /** Configuration à risque dans un dépôt non de confiance : AUCUNE autre commande git (research R3). */
  readonly blocked: boolean
}

export interface RepoLocatorDeps {
  readonly projectDir: (genesisId: string) => string | null | undefined
  readonly isTrusted: (key: string) => boolean
  readonly runner: Pick<GitRunner, 'run'>
  /** Dossier de données de l'app : jamais un dépôt à manipuler. */
  readonly dataDir: string
}

const inside = (child: string, parent: string): boolean => {
  const rel = relative(parent.toLowerCase(), child.toLowerCase())
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/**
 * Trouve le dépôt d'un genesis (spec 021 T009) : dossier réel du projet lié, existant, hors du dossier de données ;
 * confiance lue dans `trusted_projects` (spec 014) ; configuration locale lue AVANT toute autre commande — dans un
 * dépôt non de confiance qui porte une clé non neutralisable, rien d'autre n'est lancé (FR-005, analyse H1).
 */
export class RepoLocator {
  constructor(private readonly deps: RepoLocatorDeps) {}

  async locate(genesisId: string): Promise<RepoContext> {
    const stored = this.deps.projectDir(genesisId)
    if (stored === undefined) throw new AppError('NOT_FOUND', 'Projet introuvable.')
    if (stored === null || !existsSync(stored))
      throw new AppError('DIR_MISSING', 'Le dossier du projet est introuvable.')
    const dir = realpathSync(stored)
    if (inside(dir, realpathSync(this.deps.dataDir)) || inside(realpathSync(this.deps.dataDir), dir)) {
      throw new AppError('NOT_FOUND', 'Ce dossier contient les données de l’app : refusé.')
    }
    const trusted = this.deps.isTrusted(projectKey(dir))
    const gitDir = gitDirOf(dir)
    if (gitDir === null) {
      return { genesisId, dir, gitDir: null, trusted, risky: { blocking: [], neutralized: [] }, blocked: false }
    }
    // Lire la configuration locale ne déclenche ni filtre ni programme : c'est la seule commande avant le verdict.
    const config = await this.deps.runner.run(dir, localConfigNamesArgs(), { trusted, read: true, timeoutMs: 15_000 })
    if (config.code === null && config.spawnFailed)
      throw new AppError('GIT_MISSING', 'git est introuvable : installe Git pour Windows.')
    const risky = classifyConfig(parseConfigNames(config.stdout))
    return { genesisId, dir, gitDir, trusted, risky, blocked: !trusted && risky.blocking.length > 0 }
  }
}

/** Dossier `.git` réel : un dossier, ou le fichier `gitdir: …` d'un worktree ; lu sans lancer git. */
export function gitDirOf(dir: string): string | null {
  const dotGit = join(dir, '.git')
  if (!existsSync(dotGit)) return null
  if (statSync(dotGit).isDirectory()) return dotGit
  const pointer = /^gitdir:\s*(.+)\s*$/m.exec(readFileSync(dotGit, 'utf8'))?.[1]
  if (pointer === undefined) return null
  const target = resolve(dir, pointer)
  return existsSync(target) ? target : null
}
