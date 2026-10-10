import { existsSync, readdirSync, realpathSync } from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'
import type { CodeLang } from '@shared/ipc/reprise'
import type { SpecView, TaskFileView, TaskView, WorkflowFileView, WorkflowView } from '@shared/ipc/workflow'
import { AppError } from '../../domain/errors'
import { langOf } from '../../domain/reprise/fileFilter'
import { brainstormDocs, brainstormLevel } from '../../domain/workflow/brainstorm'
import { WORKFLOW_LIMITS } from '../../domain/workflow/limits'
import { foundationSummary, parseSpec } from '../../domain/workflow/parseSpec'
import { hasTasks, parseTaskFile } from '../../domain/workflow/parseTaskFile'
import { parseTasks } from '../../domain/workflow/parseTasks'
import { buildSpec } from '../../domain/workflow/specStatus'
import type { ConversationNeuron } from '../../infrastructure/db/repositories/ConversationRepository'
import { readProjectText } from '../../infrastructure/files/projectFiles'

export interface WorkflowDeps {
  readonly neuron: (id: string) => Pick<ConversationNeuron, 'state' | 'projectDir'> | undefined
  readonly folds: { get(genesisId: string): Record<string, boolean> }
  readonly now?: () => Date
}

/** Fichiers de méthode lisibles dans une carte Workflow, en plus des chemins cités par les tâches. */
const METHOD_FILE =
  /^(specs\/\d{3}[\w.-]*\/(spec|tasks|plan|research|data-model|quickstart)\.md|docs\/brainstorm\/L\d[\w-]*\.md|docs\/FOUNDATION\.md)$/

/** Fichiers qui ont des cases sans être des tâches (D20) : règles, historique, fondation (déjà un nœud). */
const NOT_TASK_FILES = new Set(['claude.md', 'journal.md', 'changelog.md', 'foundation.md'])

type Read = { readonly kind: 'ok'; readonly text: string } | { readonly kind: 'missing' } | { readonly kind: 'refused' }

/**
 * Vue Workflow d'un projet lié (spec 023) : lit en lecture seule, sous le dossier du projet, ses specs (`spec.md`,
 * `tasks.md`), ses documents de brainstorm et sa fondation, puis les assemble (analyse pure). N'écrit jamais rien
 * dans le projet ; un fichier trop gros, binaire, sensible ou hors du dossier est ignoré (lecture partielle).
 */
export class WorkflowService {
  constructor(private readonly deps: WorkflowDeps) {}

  read(genesisId: string): WorkflowView {
    const root = this.rootOf(genesisId)
    const specDirs = this.list(root, 'specs', 'dir')
      .filter((name) => /^\d{3}/.test(name))
      .sort()
      .slice(0, WORKFLOW_LIMITS.specs)
    const specs = specDirs.map((name) => {
      const dir = `specs/${name}`
      const spec = this.readText(root, `${dir}/spec.md`)
      const tasks = this.readText(root, `${dir}/tasks.md`)
      const parsedTasks = tasks.kind === 'ok' ? parseTasks(tasks.text) : null
      return buildSpec({
        dir,
        spec: spec.kind === 'ok' ? parseSpec(spec.text) : null,
        tasks: parsedTasks?.tasks ?? null,
        partial: spec.kind === 'refused' || tasks.kind === 'refused' || parsedTasks?.truncated === true
      })
    })
    const docNames = this.list(root, 'docs/brainstorm', 'file')
      .filter((name) => brainstormLevel(name) !== null)
      .sort()
      .slice(0, WORKFLOW_LIMITS.brainstormDocs)
    const brainstorm = brainstormDocs(
      docNames.map((name) => {
        const read = this.readText(root, `docs/brainstorm/${name}`)
        return { name, text: read.kind === 'ok' ? read.text : '' }
      }),
      specs
    )
    const taskFiles = this.taskFiles(root)
    const foundationFile = this.readText(root, 'docs/FOUNDATION.md')
    const summary = foundationFile.kind === 'ok' ? foundationSummary(foundationFile.text) : null
    return {
      genesisId,
      foundation: summary === null ? null : { path: 'docs/FOUNDATION.md', summary },
      specs,
      brainstorm,
      taskFiles,
      folded: this.deps.folds.get(genesisId),
      empty: specs.length === 0 && brainstorm.length === 0 && taskFiles.length === 0,
      missingFiles: this.missing(root, [...specTasks(specs), ...taskFiles.flatMap(fileTasks)]),
      readAt: (this.deps.now ?? (() => new Date()))().toISOString()
    }
  }

  /** Un fichier pour le lecteur d'une carte : fichier de méthode, ou chemin cité par une tâche du projet. */
  file(genesisId: string, path: string): WorkflowFileView {
    const { root, path: normalized, lang } = this.target(genesisId, path)
    const text = readProjectText(root, normalized)
    return { path: normalized, lang, lines: text.split(/\r?\n/) }
  }

  /** Fichier lisible depuis une carte : dossier du projet, chemin normalisé et langage ; sinon NOT_FOUND. */
  target(genesisId: string, path: string): { root: string; path: string; lang: CodeLang } {
    const root = this.rootOf(genesisId)
    const normalized = path.replace(/\\/g, '/')
    if (
      !METHOD_FILE.test(normalized) &&
      !this.taskFilePaths(root).includes(normalized) &&
      !this.citedFiles(root).has(normalized)
    ) {
      throw new AppError('NOT_FOUND', 'Ce fichier n’est cité par aucune tâche de ce projet.')
    }
    return { root, path: normalized, lang: langOf(normalized) }
  }

  /**
   * Fichiers de tâches du projet (D20) : Markdown avec au moins une case, à la racine et directement dans `docs/`,
   * hors règles, historique et fondation ; racine d'abord, puis `docs/`, par ordre alphabétique.
   */
  private taskFiles(root: string): TaskFileView[] {
    return this.taskFilePaths(root).flatMap((path) => {
      const read = this.readText(root, path)
      if (read.kind === 'missing') return []
      if (read.kind === 'refused') return [{ ...parseTaskFile(path, ''), partial: true }]
      return [parseTaskFile(path, read.text)]
    })
  }

  private taskFilePaths(root: string): string[] {
    const candidates = [
      ...this.list(root, '.', 'file').sort(),
      ...this.list(root, 'docs', 'file')
        .sort()
        .map((name) => `docs/${name}`)
    ].filter((path) => {
      const name = path.split('/').at(-1)?.toLowerCase() ?? ''
      return name.endsWith('.md') && !NOT_TASK_FILES.has(name)
    })
    const paths: string[] = []
    for (const path of candidates) {
      if (paths.length >= WORKFLOW_LIMITS.taskFiles) break
      const read = this.readText(root, path)
      if (read.kind === 'ok' && hasTasks(read.text)) paths.push(path)
    }
    return paths
  }

  /** Chemins cités introuvables sous la racine (un lien qui sort du projet compte comme introuvable). */
  private missing(root: string, tasks: readonly TaskView[]): string[] {
    const cited = new Set(tasks.flatMap((task) => task.files))
    let real: string
    try {
      real = realpathSync(root)
    } catch {
      return [...cited]
    }
    return [...cited]
      .filter((path) => {
        try {
          const inside = relative(real, realpathSync(join(real, ...path.split('/'))))
          return inside === '' || inside.startsWith('..') || isAbsolute(inside)
        } catch {
          return true
        }
      })
      .sort()
  }

  private citedFiles(root: string): Set<string> {
    const cited = new Set<string>()
    for (const name of this.list(root, 'specs', 'dir').slice(0, WORKFLOW_LIMITS.specs)) {
      const tasks = this.readText(root, `specs/${name}/tasks.md`)
      if (tasks.kind !== 'ok') continue
      for (const task of parseTasks(tasks.text).tasks) for (const file of task.files) cited.add(file)
    }
    for (const file of this.taskFiles(root))
      for (const task of fileTasks(file)) for (const path of task.files) cited.add(path)
    return cited
  }

  private rootOf(genesisId: string): string {
    const genesis = this.deps.neuron(genesisId)
    if (genesis === undefined || genesis.state === 'archived') throw new AppError('NOT_FOUND', 'Projet introuvable.')
    if (genesis.projectDir === null || !existsSync(genesis.projectDir)) {
      throw new AppError('FOLDER_MISSING', 'Le dossier de ce projet est introuvable.')
    }
    return genesis.projectDir
  }

  private readText(root: string, relPath: string): Read {
    try {
      return { kind: 'ok', text: readProjectText(root, relPath, { maxBytes: WORKFLOW_LIMITS.fileBytes }) }
    } catch (error) {
      return error instanceof AppError && error.code === 'NOT_FOUND' ? { kind: 'missing' } : { kind: 'refused' }
    }
  }

  /** Noms des dossiers ou fichiers d'un sous-dossier du projet, sans le suivre s'il sort du projet ; vide s'il manque. */
  private list(root: string, relDir: string, kind: 'dir' | 'file'): string[] {
    try {
      const real = realpathSync(root)
      const target = realpathSync(join(real, ...relDir.split('/')))
      const inside = relative(real, target)
      if ((inside === '' && relDir !== '.') || inside.startsWith('..') || isAbsolute(inside)) return []
      return readdirSync(target, { withFileTypes: true })
        .filter((entry) => (kind === 'dir' ? entry.isDirectory() : entry.isFile()))
        .map((entry) => entry.name)
    } catch {
      return []
    }
  }
}

const specTasks = (specs: readonly SpecView[]): TaskView[] =>
  specs.flatMap((spec) => [...spec.socle, ...spec.stories.flatMap((story) => story.tasks)])

const fileTasks = (file: TaskFileView): TaskView[] => [
  ...file.tasks,
  ...file.lots.flatMap((lot) => [...lot.tasks, ...lot.groups.flatMap((group) => group.tasks)])
]
