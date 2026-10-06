import { existsSync, realpathSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { ProjectCreateInput, ProjectCreatedView, ProjectSettingsView } from '@shared/ipc/projects'
import { PROJECT_LIMITS } from '@shared/ipc/projects'
import { AppError } from '../../domain/errors'
import {
  cleanText,
  firstCommitMessage,
  GITIGNORE,
  type ProjectIdentity,
  registryWithBranch,
  registryWithProject,
  scaffoldFiles,
  slugProblem
} from '../../domain/projects/project'
import type { ConversationNeuron } from '../../infrastructure/db/repositories/ConversationRepository'
import type { GitResult } from '../../infrastructure/projects/GitCli'
import { HubRegistry } from '../../infrastructure/projects/HubRegistry'
import { createProjectFolder, writeIfAbsent } from '../../infrastructure/projects/ProjectFolder'

export interface ProjectDeps {
  readonly settings: { projectsRoot(): string | null; saveProjectsRoot(root: string): void }
  /** Sélecteur de dossier natif (main) ; `undefined` si annulé. Jamais un chemin venu de l'interface. */
  readonly pickRoot: () => Promise<string | undefined>
  readonly neuron: (id: string) => ConversationNeuron | undefined
  /** Lie le genesis à son dossier (la conversation repart dans ce dossier). */
  readonly attach: (neuronId: string, dir: string) => void
  readonly git: (cwd: string, args: readonly string[]) => Promise<GitResult>
  readonly now?: () => Date
}

const pad = (value: number): string => String(value).padStart(2, '0')

/**
 * « Faire de ce genesis un projet » et « Initialiser git » (spec 016). Le dossier est toujours `racine/slug`, la racine
 * venant du sélecteur natif ; un workspace ProjectMaster reçoit le projet dans son registre.
 */
export class ProjectService {
  constructor(private readonly deps: ProjectDeps) {}

  settings(): ProjectSettingsView {
    const root = this.root()
    return { root, hub: root !== null && HubRegistry.locate(root) !== null }
  }

  async chooseRoot(): Promise<ProjectSettingsView> {
    const picked = await this.deps.pickRoot()
    if (picked !== undefined) this.deps.settings.saveProjectsRoot(realpathSync(picked))
    return this.settings()
  }

  /** Crée le projet ; `null` si mentalyas annule le choix de la racine. */
  async create(input: ProjectCreateInput): Promise<ProjectCreatedView | null> {
    const neuron = this.genesisOrThrow(input.neuronId)
    if (neuron.projectDir !== null) {
      throw new AppError('CONFLICT', 'Ce genesis a déjà un dossier de projet.')
    }
    const problem = slugProblem(input.slug)
    if (problem !== null) throw new AppError('VALIDATION', problem)
    const name = cleanText(input.name, PROJECT_LIMITS.name)
    if (name === '') throw new AppError('VALIDATION', 'Donne un nom au projet.')
    const description = cleanText(input.description, PROJECT_LIMITS.description)

    let root = this.root()
    if (root === null) {
      const picked = await this.deps.pickRoot()
      if (picked === undefined) return null
      root = realpathSync(picked)
      this.deps.settings.saveProjectsRoot(root)
    }
    const identity = this.identity(name, input, description)
    const entry = (folder: string): Parameters<typeof registryWithProject>[1] => ({
      ...identity,
      folder,
      createdAt: this.now().toISOString()
    })
    const registry = HubRegistry.locate(root)
    // Vérifié avant d'écrire le dossier : un slug déjà inscrit ne laisse rien derrière lui.
    if (registry !== null) {
      new HubRegistry(registry).update((current) => {
        registryWithProject(current, entry(input.slug))
        return null
      })
    }
    const dir = createProjectFolder(root, input.slug, scaffoldFiles(identity))
    if (registry !== null) {
      new HubRegistry(registry).update((current) => registryWithProject(current, entry(basename(dir))))
    }
    this.deps.attach(neuron.id, dir)
    return { folder: basename(dir), registered: registry !== null }
  }

  /** Fait du dossier du genesis un dépôt git avec un premier commit (spec 016 US2). */
  async initGit(neuronId: string): Promise<{ readonly ok: true }> {
    const neuron = this.genesisOrThrow(neuronId)
    const dir = neuron.projectDir
    if (dir === null || !existsSync(dir)) {
      throw new AppError('FOLDER_MISSING', 'Fais d’abord de ce genesis un projet : il n’a pas de dossier.')
    }
    if (existsSync(join(dir, '.git'))) throw new AppError('CONFLICT', 'Ce projet est déjà un dépôt git.')
    const slug = basename(dir)
    writeIfAbsent(join(dir, '.gitignore'), GITIGNORE)
    const init = await this.deps.git(dir, ['init', '-b', 'main'])
    if (init.code === null) {
      throw new AppError('GIT_MISSING', 'git est introuvable : installe Git pour Windows, puis réessaie.')
    }
    if (init.code !== 0) throw new AppError('GIT_FAILED', `git init a échoué : ${lastLine(init.output)}`)
    const add = await this.deps.git(dir, ['add', '--all'])
    if (add.code !== 0) throw new AppError('GIT_FAILED', `git add a échoué : ${lastLine(add.output)}`)
    const commit = await this.deps.git(dir, ['commit', '-m', firstCommitMessage(slug)])
    if (commit.code !== 0) {
      throw new AppError(
        'GIT_FAILED',
        /user\.(name|email)|identity/i.test(commit.output)
          ? 'Le dépôt est créé, mais le premier commit a échoué : règle ton identité git (git config --global user.name / user.email).'
          : `Le dépôt est créé, mais le premier commit a échoué : ${lastLine(commit.output)}`
      )
    }
    const root = this.root()
    const registry = root === null ? null : HubRegistry.locate(root)
    if (registry !== null) new HubRegistry(registry).update((current) => registryWithBranch(current, slug, 'main'))
    return { ok: true }
  }

  private root(): string | null {
    const root = this.deps.settings.projectsRoot()
    return root !== null && existsSync(root) ? root : null
  }

  private genesisOrThrow(neuronId: string): ConversationNeuron {
    const neuron = this.deps.neuron(neuronId)
    if (neuron === undefined) throw new AppError('NOT_FOUND', 'Cette idée n’existe plus.')
    if (neuron.genesisId !== null || neuron.kind === 'step' || neuron.kind === 'element') {
      throw new AppError('VALIDATION', 'Seul un genesis devient un projet.')
    }
    return neuron
  }

  private identity(name: string, input: ProjectCreateInput, description: string): ProjectIdentity {
    const now = this.now()
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    return {
      name,
      slug: input.slug,
      type: input.type,
      description,
      date,
      dateTime: `${date} ${pad(now.getHours())}:${pad(now.getMinutes())}`
    }
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date()
  }
}

function lastLine(output: string): string {
  const lines = output.split(/\r?\n/).filter((line) => line.trim() !== '')
  return cleanText(lines.at(-1) ?? 'raison inconnue', 200)
}
