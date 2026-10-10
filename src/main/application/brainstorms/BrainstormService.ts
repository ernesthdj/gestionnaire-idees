import { existsSync, realpathSync } from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'
import type {
  BrainstormCreatedView,
  BrainstormListItem,
  BrainstormOpenView,
  BrainstormScratch,
  BrainstormView
} from '@shared/ipc/brainstorms'
import { parseViewState, VIEW_STATE_LIMITS, type ViewState } from '@shared/brainstorms/viewState'
import { slugify } from '@shared/projects/slug'
import { AppError } from '../../domain/errors'
import { hubAnomalies, journalHeadings } from '../../domain/brainstorms/anomalies'
import { slugProblem } from '../../domain/projects/project'
import type { BrainstormRepository, BrainstormRow } from '../../infrastructure/db/repositories/BrainstormRepository'
import { LOOSE_SLUG } from '../../infrastructure/db/repositories/BrainstormRepository'
import { hubActiveSession, projectJournal, registryProjects } from '../../infrastructure/hub/HubFiles'
import type { BrainstormScope } from './BrainstormScope'

export interface BrainstormDeps {
  readonly repository: BrainstormRepository
  readonly scope: BrainstormScope
  /** Dossier `projects/` du coffre (réglage de la spec 016) ; `null` : pas encore choisi. */
  readonly projectsRoot: () => string | null
  /** Dossier des données de l'app : jamais un projet (spec 021 R5, spec 024 contrats). */
  readonly dataDir: string
  /** Nouveau genesis (nœud de départ du projet) dans son brainstorm. */
  readonly createGenesis: (title: string, content: string | null, brainstormId: string) => string
  /** Lie le genesis à son dossier (spec 016) : sa conversation s'y ouvre. */
  readonly attach: (neuronId: string, dir: string) => void
  /** Retire un genesis tout juste créé (création de zéro qui échoue). */
  readonly discardGenesis: (neuronId: string) => void
  /** Range les blocs sans vue dans la vue affichée du canevas (spec 023 D25), à l'ouverture. */
  readonly assignBlockViews?: (brainstormId: string) => void
  /** État git déjà lu, sans `git fetch` (spec 021) ; `null` : pas de dépôt, illisible ou git absent. */
  readonly gitState: (
    genesisId: string
  ) => Promise<{ readonly files: number; readonly ahead: number; readonly behind: number } | null>
  /** Création du dossier, du registre et du dépôt (spec 016, `ProjectService`). */
  readonly projects: {
    create(input: {
      neuronId: string
      name: string
      slug: string
      type: BrainstormScratch['type']
      description: string
    }): Promise<{ readonly folder: string } | null>
    initGit(neuronId: string): Promise<unknown>
  }
  readonly now?: () => Date
}

const inside = (parent: string, child: string): boolean => {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

const realOrSelf = (path: string): string => {
  try {
    return realpathSync.native(path)
  } catch {
    return path
  }
}

/**
 * Project Manager (spec 024 US1, US3) : la liste des brainstorms (ceux de l'app et les projets du registre du coffre),
 * l'ouverture d'un brainstorm (il devient le canevas actif ; `/hub work` en lecture : session, anomalies git, JOURNAL),
 * sa fermeture, son état de vue, la création d'un projet de zéro dans le coffre.
 */
export class BrainstormService {
  constructor(private readonly deps: BrainstormDeps) {}

  list(): BrainstormListItem[] {
    const root = this.root()
    const registry = root === null ? [] : registryProjects(root)
    const session = root === null ? null : hubActiveSession(root)
    const rows = this.deps.repository.list().filter((row) => row.slug !== LOOSE_SLUG || this.hasContent(row))
    const lastId = rows.find((row) => row.lastOpenedAt !== null)?.id ?? null
    const known = new Set(rows.flatMap((row) => [row.slug, ...(row.folderPath === null ? [] : [row.folderPath])]))
    const fromApp = rows.map((row): BrainstormListItem => {
      const entry = registry.find((project) => project.slug === row.slug)
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        type: row.type,
        location: row.location,
        folder: row.folderPath,
        folderMissing: row.folderPath !== null && !existsSync(row.folderPath),
        branch: entry?.branch ?? null,
        lastSession: row.lastOpenedAt ?? entry?.lastSession ?? null,
        openSession: session?.slug === row.slug,
        last: row.id === lastId
      }
    })
    const fromRegistry = registry
      .filter((project) => !known.has(project.slug) && !known.has(realOrSelf(project.dir)))
      .map((project): BrainstormListItem => ({
        id: null,
        slug: project.slug,
        name: project.name,
        description: project.description,
        type: project.type,
        location: 'vault',
        folder: project.dir,
        folderMissing: !existsSync(project.dir),
        branch: project.branch,
        lastSession: project.lastSession,
        openSession: session?.slug === project.slug,
        last: false
      }))
      .sort((a, b) => (b.lastSession ?? '').localeCompare(a.lastSession ?? ''))
    return [...fromApp, ...fromRegistry]
  }

  /** Brainstorm actif (relu par l'interface après un rechargement) ; `null` : Project Manager. */
  active(): BrainstormView | null {
    const id = this.deps.scope.active()
    const row = id === null ? undefined : this.deps.repository.get(id)
    return row === undefined ? null : this.view(row)
  }

  /** Ouvre un brainstorm (ou fait naître celui d'un projet du registre) : il devient le seul canevas affiché. */
  async open(target: { readonly id: string } | { readonly slug: string }): Promise<BrainstormOpenView> {
    const row = 'id' in target ? this.deps.repository.get(target.id) : this.fromRegistry(target.slug)
    if (row === undefined || row.archivedAt !== null) throw new AppError('NOT_FOUND', 'Ce brainstorm n’existe plus.')
    if (row.folderPath !== null && !existsSync(row.folderPath)) {
      throw new AppError(
        'FOLDER_MISSING',
        `Le dossier de « ${row.name} » est introuvable : il a été déplacé ou supprimé.`
      )
    }
    this.deps.scope.set(row.id)
    this.deps.repository.touchOpened(row.id, this.now().toISOString())
    this.deps.assignBlockViews?.(row.id)
    const view = this.view(row)
    const root = this.root()
    const git = view.genesisId === null || row.folderPath === null ? null : await this.deps.gitState(view.genesisId)
    return {
      brainstorm: view,
      viewState: parseViewState(row.viewStateJson),
      anomalies: hubAnomalies({ slug: row.slug, hubSession: root === null ? null : hubActiveSession(root), git }),
      journal: row.folderPath === null ? [] : journalHeadings(projectJournal(row.folderPath))
    }
  }

  /** Retour au Project Manager : plus aucun canevas actif (l'état de vue est déjà écrit par l'interface). */
  close(): { readonly ok: true } {
    this.deps.scope.set(null)
    return { ok: true }
  }

  saveViewState(id: string, state: ViewState): { readonly ok: true } {
    if (this.deps.repository.get(id) === undefined) throw new AppError('NOT_FOUND', 'Ce brainstorm n’existe plus.')
    const json = JSON.stringify(state)
    if (json.length > VIEW_STATE_LIMITS.bytes) throw new AppError('VALIDATION', 'État de vue trop volumineux.')
    this.deps.repository.saveViewState(id, json)
    return { ok: true }
  }

  /**
   * Nouveau brainstorm de zéro (spec 024 US3, D8) : le projet naît dans le coffre avec la structure ProjectMaster
   * (`ProjectService`, spec 016) et son dépôt git local ; GitHub viendra avec la spec 021 (lot B).
   */
  async createScratch(input: BrainstormScratch): Promise<BrainstormCreatedView> {
    if (input.github) {
      throw new AppError(
        'VALIDATION',
        'Le dépôt GitHub viendra avec la spec 021 : crée le projet en local pour l’instant.'
      )
    }
    const problem = slugProblem(input.slug)
    if (problem !== null) throw new AppError('VALIDATION', problem)
    const root = this.root()
    if (root === null) throw new AppError('NO_ROOT', 'Choisis d’abord le dossier des projets de ton coffre.')
    if (this.deps.repository.bySlug(input.slug) !== undefined || existsSync(join(root, input.slug))) {
      throw new AppError('CONFLICT', `Un projet « ${input.slug} » existe déjà.`)
    }
    const { repository } = this.deps
    const created = repository.transaction(() => {
      const brainstorm = repository.insert({
        name: input.name.trim(),
        slug: input.slug,
        description: input.description.trim(),
        type: input.type,
        location: 'vault',
        origin: 'scratch',
        folderPath: null,
        gitRole: 'none',
        github: false
      })
      const genesisId = this.deps.createGenesis(input.name.trim(), input.description.trim() || null, brainstorm.id)
      return { id: brainstorm.id, genesisId }
    })
    let folder: string
    try {
      const made = await this.deps.projects.create({
        neuronId: created.genesisId,
        name: input.name,
        slug: input.slug,
        type: input.type,
        description: input.description
      })
      if (made === null) throw new AppError('NO_ROOT', 'Choisis d’abord le dossier des projets de ton coffre.')
      folder = realOrSelf(join(root, made.folder))
    } catch (error) {
      repository.transaction(() => {
        this.deps.discardGenesis(created.genesisId)
        repository.remove(created.id)
      })
      throw error
    }
    repository.setFolder(created.id, folder)
    let warning: string | null = null
    try {
      await this.deps.projects.initGit(created.genesisId)
      repository.setGitRole(created.id, 'owner')
    } catch (error) {
      warning = error instanceof AppError ? error.message : 'Le dépôt git n’a pas pu être créé.'
    }
    return { id: created.id, warning }
  }

  /** Brainstorm d'un projet du registre, créé à sa première ouverture (genesis au nom du projet, lié à son dossier). */
  private fromRegistry(slug: string): BrainstormRow | undefined {
    const existing = this.deps.repository.bySlug(slug)
    if (existing !== undefined) return existing
    const root = this.root()
    const project = root === null ? undefined : registryProjects(root).find((entry) => entry.slug === slug)
    if (project === undefined) return undefined
    if (!existsSync(project.dir)) {
      throw new AppError('FOLDER_MISSING', `Le dossier de « ${project.name} » est introuvable.`)
    }
    const dir = realOrSelf(project.dir)
    this.refuseAppFolder(dir)
    const byFolder = this.deps.repository.byFolder(dir)
    if (byFolder !== undefined) return byFolder
    const { repository } = this.deps
    const row = repository.transaction(() => {
      const brainstorm = repository.insert({
        name: project.name,
        slug: project.slug,
        description: project.description,
        type: project.type,
        location: 'vault',
        origin: 'existing',
        folderPath: dir,
        gitRole: existsSync(join(dir, '.git')) ? 'owner' : 'none',
        github: false
      })
      const genesisId = this.deps.createGenesis(project.name, project.description || null, brainstorm.id)
      return { brainstorm, genesisId }
    })
    this.deps.attach(row.genesisId, dir)
    return row.brainstorm
  }

  private refuseAppFolder(dir: string): void {
    const data = realOrSelf(this.deps.dataDir)
    if (inside(data, dir) || inside(dir, data)) {
      throw new AppError('FOLDER_REFUSED', 'Ce dossier contient les données de l’app : il ne peut pas être un projet.')
    }
  }

  private view(row: BrainstormRow): BrainstormView {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      location: row.location,
      folder: row.folderPath,
      genesisId: this.deps.repository.genesisOf(row.id)
    }
  }

  /** « Idées en vrac » n'est listé que s'il a reçu quelque chose. */
  private hasContent(row: BrainstormRow): boolean {
    return this.deps.repository.genesisOf(row.id) !== null
  }

  private root(): string | null {
    const root = this.deps.projectsRoot()
    return root !== null && existsSync(root) ? root : null
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date()
  }
}

/** Slug libre pour un brainstorm migré : celui du dossier, suffixé au besoin (`-2`, `-3`…). */
export function freeSlug(base: string, taken: (slug: string) => boolean): string {
  const start = slugify(base).slice(0, 46) || 'projet'
  const candidate = start.length < 2 ? `${start}-p` : start
  if (!taken(candidate)) return candidate
  for (let index = 2; index < 1000; index += 1) {
    if (!taken(`${candidate}-${index}`)) return `${candidate}-${index}`
  }
  throw new AppError('CONFLICT', 'Aucun nom de brainstorm libre.')
}
