import { existsSync, readdirSync, realpathSync } from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'
import type { SpecView, WorkflowFileView, WorkflowView } from '@shared/ipc/workflow'
import { AppError } from '../../domain/errors'
import { langOf } from '../../domain/reprise/fileFilter'
import { brainstormDocs, brainstormLevel } from '../../domain/workflow/brainstorm'
import { WORKFLOW_LIMITS } from '../../domain/workflow/limits'
import { foundationSummary, parseSpec } from '../../domain/workflow/parseSpec'
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
    const foundationFile = this.readText(root, 'docs/FOUNDATION.md')
    const summary = foundationFile.kind === 'ok' ? foundationSummary(foundationFile.text) : null
    return {
      genesisId,
      foundation: summary === null ? null : { path: 'docs/FOUNDATION.md', summary },
      specs,
      brainstorm,
      folded: this.deps.folds.get(genesisId),
      empty: specs.length === 0 && brainstorm.length === 0,
      missingFiles: this.missing(root, specs),
      readAt: (this.deps.now ?? (() => new Date()))().toISOString()
    }
  }

  /** Un fichier pour le lecteur d'une carte : fichier de méthode, ou chemin cité par une tâche du projet. */
  file(genesisId: string, path: string): WorkflowFileView {
    const root = this.rootOf(genesisId)
    const normalized = path.replace(/\\/g, '/')
    if (!METHOD_FILE.test(normalized) && !this.citedFiles(root).has(normalized)) {
      throw new AppError('NOT_FOUND', 'Ce fichier n’est cité par aucune tâche de ce projet.')
    }
    const text = readProjectText(root, normalized)
    return { path: normalized, lang: langOf(normalized), lines: text.split(/\r?\n/) }
  }

  /** Chemins cités introuvables sous la racine (un lien qui sort du projet compte comme introuvable). */
  private missing(root: string, specs: readonly SpecView[]): string[] {
    const cited = new Set(
      specs.flatMap((spec) => [...spec.socle, ...spec.stories.flatMap((story) => story.tasks)].flatMap((t) => t.files))
    )
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
      if (inside === '' || inside.startsWith('..') || isAbsolute(inside)) return []
      return readdirSync(target, { withFileTypes: true })
        .filter((entry) => (kind === 'dir' ? entry.isDirectory() : entry.isFile()))
        .map((entry) => entry.name)
    } catch {
      return []
    }
  }
}
