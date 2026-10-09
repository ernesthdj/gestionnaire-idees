import { existsSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import type { BrainstormCloneProgress } from '@shared/ipc/brainstorms'
import type { ProjectType } from '@shared/ipc/projects'
import { AppError } from '../../domain/errors'
import { cleanText, registryWithProject, slugProblem } from '../../domain/projects/project'
import type { BrainstormRepository } from '../../infrastructure/db/repositories/BrainstormRepository'
import { HubRegistry } from '../../infrastructure/projects/HubRegistry'
import type { CloneFailureCode, CloneRequest, CloneResult } from '../reprise/CloneService'

export interface CloneBrainstormDeps {
  readonly repository: BrainstormRepository
  readonly projectsRoot: () => string | null
  /** `CloneService.clone` (profil `historique`) : adresse contrôlée, sans hooks ni sous-modules. */
  readonly clone: (request: CloneRequest) => Promise<CloneResult>
  readonly createGenesis: (title: string, content: string | null, brainstormId: string) => string
  readonly attach: (neuronId: string, dir: string) => void
  readonly emit: (progress: BrainstormCloneProgress) => void
  readonly now?: () => Date
}

/** Ce que mentalyas lit quand un clone échoue (jamais la sortie de git, qui peut contenir l'adresse avec identifiant). */
const FAILURES: Readonly<Record<CloneFailureCode, string>> = {
  URL_REFUSED: 'Ce lien n’est pas accepté : seuls https://… et git@hôte:… le sont.',
  GIT_MISSING: 'git est introuvable : installe Git pour Windows, puis réessaie.',
  BUSY: 'Un autre clone est en cours : attends sa fin.',
  TARGET_EXISTS: 'Un dossier de ce nom existe déjà dans le coffre.',
  TARGET_REFUSED: 'Ce dossier de destination est refusé.',
  NOT_FOUND: 'Dépôt introuvable : vérifie le lien (ou tes droits d’accès).',
  AUTH_FAILED: 'Accès refusé : ce dépôt demande une connexion.',
  NETWORK: 'Le réseau ne répond pas : vérifie ta connexion.',
  TIMEOUT: 'Le clone a pris trop de temps et a été arrêté.',
  CANCELLED: 'Clone annulé : rien n’est resté dans le coffre.',
  DISK_FULL: 'Le disque est plein.',
  INVALID_PATH: 'Ce dépôt contient un chemin de fichier refusé.',
  TOO_LARGE: 'Ce dépôt est trop volumineux.',
  FAILED: 'Le clone a échoué.'
}

const pad = (value: number): string => String(value).padStart(2, '0')

/**
 * Nouveau brainstorm depuis un lien Git (spec 024 US5, D11) : clone partiel dans `projects/<slug>` du coffre par le
 * service de clone commun (spec 017/021), inscription au registre, brainstorm « cloné » et son genesis. Le contenu
 * cloné n'est jamais exécuté ; le rôle par défaut est « collaborateur » (on ne pousse pas vers un dépôt qui n'est pas à
 * soi), le choix fork / collaborateur viendra avec la spec 021.
 */
export class CloneBrainstormService {
  private controller: AbortController | null = null

  constructor(private readonly deps: CloneBrainstormDeps) {}

  async clone(input: {
    readonly url: string
    readonly name: string
    readonly slug: string
    readonly type: ProjectType
    readonly full: boolean
  }): Promise<{ readonly id: string }> {
    const problem = slugProblem(input.slug)
    if (problem !== null) throw new AppError('VALIDATION', problem)
    const name = cleanText(input.name, 100)
    if (name === '') throw new AppError('VALIDATION', 'Donne un nom au projet.')
    const rootSetting = this.deps.projectsRoot()
    if (rootSetting === null || !existsSync(rootSetting)) {
      throw new AppError('NO_ROOT', 'Choisis d’abord le dossier des projets de ton coffre.')
    }
    const root = realpathSync.native(rootSetting)
    const target = join(root, input.slug)
    if (existsSync(target) || this.deps.repository.bySlug(input.slug) !== undefined) {
      throw new AppError('CONFLICT', `Un projet « ${input.slug} » existe déjà.`)
    }
    if (this.controller !== null) throw new AppError('BUSY', FAILURES.BUSY)
    this.controller = new AbortController()
    let result: CloneResult
    try {
      result = await this.deps.clone({
        url: input.url,
        profile: 'historique',
        target,
        full: input.full,
        signal: this.controller.signal,
        onProgress: (progress) => this.deps.emit(progress)
      })
    } finally {
      this.controller = null
    }
    if (!result.ok) throw new AppError(`CLONE_${result.code}`, FAILURES[result.code])
    const dir = realpathSync.native(result.dir)
    const description = `Cloné depuis ${result.display}`
    const registry = HubRegistry.locate(root)
    if (registry !== null) {
      const now = this.deps.now?.() ?? new Date()
      const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
      new HubRegistry(registry).update((current) =>
        registryWithProject(current, {
          name,
          slug: input.slug,
          type: input.type,
          description,
          date,
          dateTime: `${date} ${pad(now.getHours())}:${pad(now.getMinutes())}`,
          folder: input.slug,
          createdAt: now.toISOString()
        })
      )
    }
    const { repository } = this.deps
    const created = repository.transaction(() => {
      const row = repository.insert({
        name,
        slug: input.slug,
        description,
        type: input.type,
        location: 'vault',
        origin: 'clone',
        folderPath: dir,
        gitRole: 'collaborator',
        github: false
      })
      return { id: row.id, genesisId: this.deps.createGenesis(name, description, row.id) }
    })
    this.deps.attach(created.genesisId, dir)
    return { id: created.id }
  }

  /** Annule le clone en cours : le dossier commencé est retiré par le service de clone. */
  cancel(): { readonly ok: boolean } {
    if (this.controller === null) return { ok: false }
    this.controller.abort()
    return { ok: true }
  }
}
