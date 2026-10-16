import {
  WORKFLOW_KEY,
  type TaskFileView,
  type TaskGroupView,
  type TaskView,
  type WorkflowView
} from '@shared/ipc/workflow'

/**
 * Nœud de la vue Workflow auquel des agents sont connectés (L1o D14) : une tâche, un lot, un fichier de tâches, une
 * spec, une user story ou un document de brainstorm, désigné par sa clé de carte `wf:<genesis>:<sorte>:…`. Le contexte
 * donné aux agents se lit dans les fichiers du projet : ce que dit la tâche, les fichiers qu'elle cite et les documents
 * d'où elle vient (l'agent les ouvre lui-même dans son worktree). Pur.
 */

export interface WorkflowHost {
  readonly genesisId: string
  readonly kind: string
  readonly title: string
  /** Ce que l'agent doit savoir du nœud, en Markdown. */
  readonly content: string
  /** Case de la tâche dans son fichier `docs/TACHES-*.md` (nœud tâche seulement) : cochée à la fusion (L1o D23). */
  readonly box?: TaskBox
}

/** Une tâche d'un fichier de tâches : son chemin dans le projet et sa clé (`parseTaskFile`). */
export interface TaskBox {
  readonly path: string
  readonly key: string
}

/** Clé de carte d'un nœud du Workflow (`WORKFLOW_KEY`) qui désigne bien un nœud (pas un message). */
export const isWorkflowHost = (nodeId: string): boolean =>
  WORKFLOW_KEY.test(nodeId) && HOST_KINDS.has(nodeId.split(':')[2] ?? '')

const HOST_KINDS: ReadonlySet<string> = new Set(['doc', 'spec', 'story', 'task', 'tfile', 'tgroup', 'ttask'])

/** Genesis d'une clé du Workflow ; `null` pour un autre identifiant. */
export function workflowHostGenesis(nodeId: string): string | null {
  return isWorkflowHost(nodeId) ? (nodeId.split(':')[1] ?? null) : null
}

const STATE_LABEL: Readonly<Record<TaskView['state'], string>> = { todo: 'à faire', doing: 'en cours', done: 'faite' }

const taskLine = (task: TaskView): string =>
  `- ${task.id === '' ? '' : `${task.id} `}${task.text} (${STATE_LABEL[task.state]})`

const filesOf = (tasks: readonly TaskView[]): string[] => [...new Set(tasks.flatMap((task) => task.files))]

function section(title: string, lines: readonly string[]): string[] {
  return lines.length === 0 ? [] : ['', `${title} :`, ...lines]
}

const groupTasks = (group: TaskGroupView): TaskView[] => [...group.tasks, ...group.groups.flatMap(groupTasks)]
const fileTasks = (file: TaskFileView): TaskView[] => [...file.tasks, ...file.lots.flatMap(groupTasks)]

function findGroup(file: TaskFileView, key: string): TaskGroupView | undefined {
  const walk = (groups: readonly TaskGroupView[]): TaskGroupView | undefined => {
    for (const group of groups) {
      if (group.key === key) return group
      const inner = walk(group.groups)
      if (inner !== undefined) return inner
    }
    return undefined
  }
  return walk(file.lots)
}

/** Documents de brainstorm qui nomment ce fichier de tâches (`**Tâches**`). */
const docsOfFile = (view: WorkflowView, path: string): string[] =>
  view.brainstorm.filter((doc) => doc.taskPaths.includes(path)).map((doc) => doc.path)

function describe(
  kind: string,
  title: string,
  tasks: readonly TaskView[],
  sources: readonly string[],
  extra: readonly string[] = []
): Omit<WorkflowHost, 'genesisId'> {
  const lines = [
    ...extra,
    ...section('Tâches', tasks.map(taskLine)),
    ...section(
      'Fichiers cités',
      filesOf(tasks).map((path) => `- ${path}`)
    ),
    ...section(
      'À lire d’abord',
      sources.map((path) => `- ${path}`)
    )
  ]
  return { kind, title, content: lines.join('\n').trim() }
}

/** Contexte d'un nœud du Workflow ; `undefined` s'il n'existe plus dans les fichiers du projet. */
export function workflowHost(view: WorkflowView, nodeId: string): WorkflowHost | undefined {
  if (!isWorkflowHost(nodeId)) return undefined
  const [, genesisId = '', kind = '', first = '', second = ''] = nodeId.split(':')
  if (genesisId !== view.genesisId) return undefined
  const described = ((): Omit<WorkflowHost, 'genesisId'> | undefined => {
    switch (kind) {
      case 'doc': {
        const doc = view.brainstorm.find((entry) => entry.name.replace(/\.md$/i, '') === first)
        if (doc === undefined) return undefined
        const path = doc.path
        return describe('brainstorm', doc.title, [], [path, ...doc.taskPaths], [`Document de brainstorm : ${path}.`])
      }
      case 'spec':
      case 'story':
      case 'task': {
        const spec = view.specs.find((entry) => entry.number === first)
        if (spec === undefined) return undefined
        const sources = [`${spec.dir}/spec.md`, `${spec.dir}/tasks.md`]
        if (kind === 'spec') {
          return describe(
            'spec',
            `${spec.number} · ${spec.title}`,
            [...spec.socle, ...spec.stories.flatMap((s) => s.tasks)],
            sources
          )
        }
        if (kind === 'story') {
          const story = spec.stories.find((entry) => String(entry.number) === second)
          return story === undefined
            ? undefined
            : describe('user story', `US${story.number} · ${story.title}`, story.tasks, sources, [
                `Spec ${spec.number} · ${spec.title}.`
              ])
        }
        const task = [...spec.socle, ...spec.stories.flatMap((s) => s.tasks)].find((entry) => entry.id === second)
        return task === undefined
          ? undefined
          : describe('tâche', task.id === '' ? task.text : `${task.id} · ${task.text}`, [task], sources, [
              `Spec ${spec.number} · ${spec.title}.`
            ])
      }
      case 'tfile': {
        const file = view.taskFiles.find((entry) => entry.key === first)
        return file === undefined
          ? undefined
          : describe('fichier de tâches', file.title, fileTasks(file), [file.path, ...docsOfFile(view, file.path)])
      }
      case 'tgroup': {
        for (const file of view.taskFiles) {
          const group = findGroup(file, first)
          if (group !== undefined) {
            return describe(
              'lot',
              group.title,
              groupTasks(group),
              [file.path, ...docsOfFile(view, file.path)],
              [`Lot de ${file.path}.`]
            )
          }
        }
        return undefined
      }
      case 'ttask': {
        for (const file of view.taskFiles) {
          const task = fileTasks(file).find((entry) => entry.key === first)
          if (task !== undefined) {
            return {
              ...describe(
                'tâche',
                task.id === '' ? task.text : `${task.id} · ${task.text}`,
                [task],
                [file.path, ...docsOfFile(view, file.path)],
                [`Tâche de ${file.path} : quand elle est faite, coche sa case (« - [x] »).`]
              ),
              box: { path: file.path, key: first }
            }
          }
        }
        return undefined
      }
      default:
        return undefined
    }
  })()
  return described === undefined ? undefined : { genesisId, ...described }
}
