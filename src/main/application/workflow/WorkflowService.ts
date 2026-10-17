import { existsSync, readdirSync, realpathSync } from 'node:fs'
import { access, readdir, realpath } from 'node:fs/promises'
import { isAbsolute, join, relative } from 'node:path'
import type { CodeLang } from '@shared/ipc/reprise'
import type {
  SpecView,
  TaskFileView,
  TaskGroupView,
  TaskView,
  WorkflowFileView,
  WorkflowView
} from '@shared/ipc/workflow'
import { AppError } from '../../domain/errors'
import { langOf } from '../../domain/reprise/fileFilter'
import { brainstormDocs, brainstormLevel } from '../../domain/workflow/brainstorm'
import { WORKFLOW_LIMITS } from '../../domain/workflow/limits'
import { foundationSummary, parseSpec } from '../../domain/workflow/parseSpec'
import { hasTasks, parseTaskFile } from '../../domain/workflow/parseTaskFile'
import { parseTasks } from '../../domain/workflow/parseTasks'
import { buildSpec } from '../../domain/workflow/specStatus'
import { workflowArbre } from '@shared/workflow/arbre'
import type { ConversationNeuron } from '../../infrastructure/db/repositories/ConversationRepository'
import { readProjectText, readProjectTextAsync } from '../../infrastructure/files/projectFiles'

export interface WorkflowDeps {
  readonly neuron: (id: string) => Pick<ConversationNeuron, 'state' | 'projectDir'> | undefined
  readonly folds: { get(genesisId: string): Record<string, boolean> }
  readonly now?: () => Date
  /** Clés de tâches numérotées changées (spec 032 D21) : ancienne → nouvelle, pour reporter équipes et conversations. */
  readonly onTaskKeys?: (genesisId: string, moved: readonly { readonly from: string; readonly to: string }[]) => void
}

/** Fichiers de méthode lisibles dans une carte Workflow, en plus des chemins cités par les tâches. */
const METHOD_FILE =
  /^(specs\/\d{3}[\w.-]*\/(spec|tasks|plan|research|data-model|quickstart)\.md|docs\/brainstorm\/L\d[\w-]*\.md|docs\/brainstormer\/\w[\w.-]{0,120}\.md|docs\/FOUNDATION\.md)$/

/** Fichiers qui ont des cases sans être des tâches (D20) : règles, historique, fondation (déjà un nœud). */
const NOT_TASK_FILES = new Set(['claude.md', 'journal.md', 'changelog.md', 'foundation.md'])

const FOUNDATION = 'docs/FOUNDATION.md'

type Read = { readonly kind: 'ok'; readonly text: string } | { readonly kind: 'missing' } | { readonly kind: 'refused' }
type Kind = 'dir' | 'file'

/** Noms lus dans les dossiers du projet : specs, documents de brainstorm, candidats fichiers de tâches (D20). */
interface Listing {
  readonly specDirs: readonly string[]
  readonly docNames: readonly string[]
  /** Documents de l'app (`docs/brainstormer/`, spec 032 D19). */
  readonly appDocNames: readonly string[]
  readonly candidates: readonly string[]
}

/** Dossier des documents écrits par Claude dans l'app (spec 012) : aussi lu comme brainstorm (spec 032 D19). */
const APP_DOCS = 'docs/brainstormer'

/** Ce que la vue lit dans le projet : ses dossiers listés, puis le texte de chaque fichier utile (par chemin). */
interface Scan {
  readonly listing: Listing
  readonly texts: ReadonlyMap<string, Read>
}

/** Ce que la vue assemble avant de vérifier les chemins cités. */
interface Parts {
  readonly specs: SpecView[]
  readonly brainstorm: WorkflowView['brainstorm']
  readonly taskFiles: TaskFileView[]
  readonly foundation: WorkflowView['foundation']
}

/**
 * Vue Workflow d'un projet lié (spec 023) : lit en lecture seule, sous le dossier du projet, ses specs (`spec.md`,
 * `tasks.md`), ses documents de brainstorm et sa fondation, puis les assemble (analyse pure). N'écrit jamais rien
 * dans le projet ; un fichier trop gros, binaire, sensible ou hors du dossier est ignoré (lecture partielle).
 * Les canaux IPC lisent le disque en asynchrone et en parallèle (le processus principal n'est jamais bloqué) ;
 * `readSync` reste pour les entrées de widgets, assemblées en synchrone.
 */
const groupTasks = (group: TaskGroupView): TaskView[] => [...group.tasks, ...group.groups.flatMap(groupTasks)]

export class WorkflowService {
  constructor(private readonly deps: WorkflowDeps) {}

  async read(genesisId: string): Promise<WorkflowView> {
    const root = await this.rootOf(genesisId)
    const parts = assemble(await this.scan(root))
    return this.view(genesisId, parts, await missing(root, citedPaths(parts)))
  }

  /** Même vue que `read`, lue en synchrone : seulement pour les appelants qui ne peuvent pas attendre. */
  readSync(genesisId: string): WorkflowView {
    const root = this.rootOfSync(genesisId)
    const parts = assemble(this.scanSync(root))
    return this.view(genesisId, parts, missingSync(root, citedPaths(parts)))
  }

  /** Un fichier pour le lecteur d'une carte : fichier de méthode, ou chemin cité par une tâche du projet. */
  async file(genesisId: string, path: string): Promise<WorkflowFileView> {
    const { root, path: normalized, lang } = await this.target(genesisId, path)
    const text = await readProjectTextAsync(root, normalized)
    return { path: normalized, lang, lines: text.split(/\r?\n/) }
  }

  /** Fichier lisible depuis une carte : dossier du projet, chemin normalisé et langage ; sinon NOT_FOUND. */
  async target(genesisId: string, path: string): Promise<{ root: string; path: string; lang: CodeLang }> {
    const root = await this.rootOf(genesisId)
    const normalized = path.replace(/\\/g, '/')
    if (!METHOD_FILE.test(normalized)) {
      const parts = assemble(await this.scan(root))
      const readable = new Set([...parts.taskFiles.map((file) => file.path), ...citedPaths(parts)])
      if (!readable.has(normalized)) {
        throw new AppError('NOT_FOUND', 'Ce fichier n’est cité par aucune tâche de ce projet.')
      }
    }
    return { root, path: normalized, lang: langOf(normalized) }
  }

  private view(genesisId: string, parts: Parts, missingFiles: string[]): WorkflowView {
    // Spec 032 D21 : ce qui était accroché à l'ancienne clé d'une tâche numérotée passe sur la nouvelle.
    const moved = parts.taskFiles.flatMap((file) =>
      [...file.tasks, ...file.lots.flatMap(groupTasks)].flatMap((task) =>
        task.legacyKey === undefined || task.key === undefined ? [] : [{ from: task.legacyKey, to: task.key }]
      )
    )
    if (moved.length > 0) this.deps.onTaskKeys?.(genesisId, moved)
    return {
      genesisId,
      ...parts,
      tree: workflowArbre(parts.brainstorm, parts.specs, parts.taskFiles),
      folded: this.deps.folds.get(genesisId),
      empty: parts.specs.length === 0 && parts.brainstorm.length === 0 && parts.taskFiles.length === 0,
      missingFiles,
      readAt: (this.deps.now ?? (() => new Date()))().toISOString()
    }
  }

  /** Dossiers listés puis fichiers lus, chacun en parallèle. */
  private async scan(root: string): Promise<Scan> {
    const [specs, docs, top, docFiles, appDocs] = await Promise.all([
      list(root, 'specs', 'dir'),
      list(root, 'docs/brainstorm', 'file'),
      list(root, '.', 'file'),
      list(root, 'docs', 'file'),
      list(root, APP_DOCS, 'file')
    ])
    const listing = listingOf(specs, docs, top, docFiles, appDocs)
    const candidates = new Set(listing.candidates)
    const texts = await Promise.all(
      pathsOf(listing).map(async (path) => {
        const read = await readText(root, path)
        return [path, candidates.has(path) ? asCandidate(read) : read] as const
      })
    )
    return { listing, texts: new Map(texts) }
  }

  private scanSync(root: string): Scan {
    const listing = listingOf(
      listSync(root, 'specs', 'dir'),
      listSync(root, 'docs/brainstorm', 'file'),
      listSync(root, '.', 'file'),
      listSync(root, 'docs', 'file'),
      listSync(root, APP_DOCS, 'file')
    )
    const candidates = new Set(listing.candidates)
    const texts = pathsOf(listing).map((path) => {
      const read = readTextSync(root, path)
      return [path, candidates.has(path) ? asCandidate(read) : read] as const
    })
    return { listing, texts: new Map(texts) }
  }

  private genesisDir(genesisId: string): string | null {
    const genesis = this.deps.neuron(genesisId)
    if (genesis === undefined || genesis.state === 'archived') throw new AppError('NOT_FOUND', 'Projet introuvable.')
    return genesis.projectDir
  }

  private async rootOf(genesisId: string): Promise<string> {
    const dir = this.genesisDir(genesisId)
    if (dir === null || !(await exists(dir))) throw folderMissing()
    return dir
  }

  private rootOfSync(genesisId: string): string {
    const dir = this.genesisDir(genesisId)
    if (dir === null || !existsSync(dir)) throw folderMissing()
    return dir
  }
}

const folderMissing = (): AppError => new AppError('FOLDER_MISSING', 'Le dossier de ce projet est introuvable.')

const exists = (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false
  )

/** Vrai si `target` n'est pas strictement sous `real` (la racine elle-même compte comme dehors). */
const outside = (real: string, target: string): boolean => {
  const inside = relative(real, target)
  return inside === '' || inside.startsWith('..') || isAbsolute(inside)
}

/** Un sous-dossier qui sort du projet (lien) n'est pas suivi ; `.` désigne la racine elle-même. */
const escapes = (real: string, target: string, relDir: string): boolean => {
  const inside = relative(real, target)
  return (inside === '' && relDir !== '.') || inside.startsWith('..') || isAbsolute(inside)
}

const named = (entries: readonly { name: string; isDirectory(): boolean; isFile(): boolean }[], kind: Kind) =>
  entries.filter((entry) => (kind === 'dir' ? entry.isDirectory() : entry.isFile())).map((entry) => entry.name)

/** Noms des dossiers ou fichiers d'un sous-dossier du projet, sans le suivre s'il sort du projet ; vide s'il manque. */
async function list(root: string, relDir: string, kind: Kind): Promise<string[]> {
  try {
    const real = await realpath(root)
    const target = await realpath(join(real, ...relDir.split('/')))
    if (escapes(real, target, relDir)) return []
    return named(await readdir(target, { withFileTypes: true }), kind)
  } catch {
    return []
  }
}

function listSync(root: string, relDir: string, kind: Kind): string[] {
  try {
    const real = realpathSync(root)
    const target = realpathSync(join(real, ...relDir.split('/')))
    if (escapes(real, target, relDir)) return []
    return named(readdirSync(target, { withFileTypes: true }), kind)
  } catch {
    return []
  }
}

const readFailure = (error: unknown): Read =>
  error instanceof AppError && error.code === 'NOT_FOUND' ? { kind: 'missing' } : { kind: 'refused' }

async function readText(root: string, relPath: string): Promise<Read> {
  try {
    return { kind: 'ok', text: await readProjectTextAsync(root, relPath, { maxBytes: WORKFLOW_LIMITS.fileBytes }) }
  } catch (error) {
    return readFailure(error)
  }
}

function readTextSync(root: string, relPath: string): Read {
  try {
    return { kind: 'ok', text: readProjectText(root, relPath, { maxBytes: WORKFLOW_LIMITS.fileBytes }) }
  } catch (error) {
    return readFailure(error)
  }
}

/** Chemins cités introuvables sous la racine (un lien qui sort du projet compte comme introuvable). */
async function missing(root: string, cited: readonly string[]): Promise<string[]> {
  let real: string
  try {
    real = await realpath(root)
  } catch {
    return [...cited].sort()
  }
  const absent = await Promise.all(
    cited.map(async (path) => {
      try {
        return outside(real, await realpath(join(real, ...path.split('/'))))
      } catch {
        return true
      }
    })
  )
  return cited.filter((_, index) => absent[index] === true).sort()
}

function missingSync(root: string, cited: readonly string[]): string[] {
  let real: string
  try {
    real = realpathSync(root)
  } catch {
    return [...cited].sort()
  }
  return cited
    .filter((path) => {
      try {
        return outside(real, realpathSync(join(real, ...path.split('/'))))
      } catch {
        return true
      }
    })
    .sort()
}

/**
 * Specs numérotées, documents de brainstorm, puis candidats fichiers de tâches (D20) : Markdown à la racine et
 * directement dans `docs/`, hors règles, historique et fondation ; racine d'abord, puis `docs/`, par ordre alphabétique.
 */
function listingOf(specs: string[], docs: string[], top: string[], docFiles: string[], appDocs: string[]): Listing {
  return {
    // Documents de l'app (D19) : seuls ceux qui ont un en-tête de brainstorm deviendront des ronds (à l'assemblage).
    appDocNames: appDocs
      .filter((name) => name.toLowerCase().endsWith('.md'))
      .sort()
      .slice(0, WORKFLOW_LIMITS.brainstormDocs),
    specDirs: specs
      .filter((name) => /^\d{3}/.test(name))
      .sort()
      .slice(0, WORKFLOW_LIMITS.specs),
    docNames: docs
      .filter((name) => brainstormLevel(name) !== null)
      .sort()
      .slice(0, WORKFLOW_LIMITS.brainstormDocs),
    candidates: [...top.sort(), ...docFiles.sort().map((name) => `docs/${name}`)].filter((path) => {
      const name = path.split('/').at(-1)?.toLowerCase() ?? ''
      return name.endsWith('.md') && !NOT_TASK_FILES.has(name)
    })
  }
}

function pathsOf(listing: Listing): string[] {
  return [
    ...listing.specDirs.flatMap((name) => [`specs/${name}/spec.md`, `specs/${name}/tasks.md`]),
    ...listing.docNames.map((name) => `docs/brainstorm/${name}`),
    ...listing.appDocNames.map((name) => `${APP_DOCS}/${name}`),
    ...listing.candidates,
    FOUNDATION
  ]
}

/** Un candidat sans case n'est pas un fichier de tâches : son texte n'est pas gardé en mémoire. */
const asCandidate = (read: Read): Read => (read.kind === 'ok' && !hasTasks(read.text) ? { kind: 'missing' } : read)

/** Assemble la vue (analyse pure) à partir de ce qui a été lu. */
function assemble({ listing, texts }: Scan): Parts {
  const text = (path: string): Read => texts.get(path) ?? { kind: 'missing' }
  const specs = listing.specDirs.map((name) => {
    const dir = `specs/${name}`
    const spec = text(`${dir}/spec.md`)
    const tasks = text(`${dir}/tasks.md`)
    const parsedTasks = tasks.kind === 'ok' ? parseTasks(tasks.text) : null
    return buildSpec({
      dir,
      spec: spec.kind === 'ok' ? parseSpec(spec.text) : null,
      tasks: parsedTasks?.tasks ?? null,
      partial: spec.kind === 'refused' || tasks.kind === 'refused' || parsedTasks?.truncated === true
    })
  })
  const brainstorm = brainstormDocs(
    [
      ...listing.docNames.map((name) => {
        const read = text(`docs/brainstorm/${name}`)
        return { name, text: read.kind === 'ok' ? read.text : '' }
      }),
      // Un nom déjà présent dans docs/brainstorm/ l'emporte : un rond par nom.
      ...listing.appDocNames
        .filter((name) => !listing.docNames.includes(name))
        .map((name) => {
          const path = `${APP_DOCS}/${name}`
          const read = text(path)
          return { name, path, app: true, text: read.kind === 'ok' ? read.text : '' }
        })
    ],
    specs
  )
  const taskFiles = listing.candidates
    .flatMap((path) => {
      const read = text(path)
      return read.kind === 'ok' ? [parseTaskFile(path, read.text)] : []
    })
    .slice(0, WORKFLOW_LIMITS.taskFiles)
  const foundationFile = text(FOUNDATION)
  const summary = foundationFile.kind === 'ok' ? foundationSummary(foundationFile.text) : null
  return {
    specs,
    brainstorm,
    taskFiles,
    foundation: summary === null ? null : { path: FOUNDATION, summary }
  }
}

/** Chemins cités par les tâches des specs et des fichiers de tâches, sans doublon. */
const citedPaths = (parts: Parts): string[] => {
  const tasks = [
    ...parts.specs.flatMap((spec) => [...spec.socle, ...spec.stories.flatMap((story) => story.tasks)]),
    ...parts.taskFiles.flatMap(fileTasks)
  ]
  return [...new Set(tasks.flatMap((task) => task.files))]
}

const fileTasks = (file: TaskFileView): TaskView[] => [
  ...file.tasks,
  ...file.lots.flatMap((lot) => [...lot.tasks, ...lot.groups.flatMap((group) => group.tasks)])
]
