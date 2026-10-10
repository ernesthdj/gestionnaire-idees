import type { SpecView, StoryView, TaskFileView, TaskGroupView, TaskView, WorkflowView } from '@shared/ipc/workflow'
import type { SheetData, WidgetInputData } from '@shared/ipc/widgetIo'

/** Entrées d'un widget tirées d'une carte de structure ou de la vue Workflow (spec 023 D24). Fonctions pures. */

type ElementInput = Extract<WidgetInputData, { kind: 'element' }>
type WorkflowInput = Extract<WidgetInputData, { kind: 'workflow' }>

/** Taille maximale d'une entrée Workflow (comme les autres entrées, spec 015 R2). */
const WORKFLOW_INPUT_MAX_CHARS = 200_000

export interface ElementFacts {
  readonly id: string
  readonly genesisId: string
  readonly parentId: string
  readonly type: string
  readonly title: string
  readonly content: string | null
  readonly paths: readonly string[]
  readonly sheet: SheetData
}

/** Élément branché : son contexte et le chemin de ses parents dans la carte ; `undefined` s'il a disparu. */
export function elementInput(elements: readonly ElementFacts[], id: string): ElementInput | undefined {
  const byId = new Map(elements.map((element) => [element.id, element] as const))
  const element = byId.get(id)
  if (element === undefined) return undefined
  const path: { readonly id: string; readonly title: string; readonly type: string }[] = []
  for (let parent = byId.get(element.parentId); parent !== undefined && path.length < 20;) {
    path.unshift({ id: parent.id, title: parent.title, type: parent.type })
    parent = byId.get(parent.parentId)
  }
  return {
    kind: 'element',
    id: element.id,
    genesisId: element.genesisId,
    title: element.title,
    type: element.type,
    summary: element.content,
    paths: element.paths,
    sheet: element.sheet,
    path
  }
}

const listed = (tasks: readonly TaskView[]): WorkflowInput['tasks'] =>
  tasks.map((task) => ({ id: task.id, text: task.text, state: task.state }))
const cited = (tasks: readonly TaskView[]): string[] => [...new Set(tasks.flatMap((task) => task.files))]
const groupTasks = (group: TaskGroupView): TaskView[] => [...group.tasks, ...group.groups.flatMap((g) => g.tasks)]
const fileTasks = (file: TaskFileView): TaskView[] => [...file.tasks, ...file.lots.flatMap(groupTasks)]
const specTasks = (spec: SpecView): TaskView[] => [...spec.socle, ...spec.stories.flatMap((story) => story.tasks)]
const storyState = (story: StoryView): string =>
  story.delivered ? 'delivered' : story.done > 0 || story.tasks.some((t) => t.state === 'doing') ? 'active' : 'planned'

/**
 * Nœud de la vue Workflow retrouvé par sa clé de carte (`wf:<genesis>:<sorte>:…`, celle de `workflowTree`) dans la vue
 * relue : fichier de tâches, lot ou groupe, tâche d'un fichier, spec, user story, socle, tâche d'un `tasks.md`.
 * `undefined` : clé inconnue, nœud qui n'existe plus, ou sorte non branchable (branche, message, tâches faites).
 */
export function workflowInput(view: WorkflowView, key: string): WorkflowInput | undefined {
  const [prefix, genesisId, kind, first, second] = key.split(':')
  if (prefix !== 'wf' || genesisId !== view.genesisId || first === undefined) return undefined
  const base = { kind: 'workflow' as const, key, genesisId }
  if (kind === 'tfile') {
    const file = view.taskFiles.find((entry) => entry.key === first)
    if (file === undefined) return undefined
    const tasks = fileTasks(file)
    return bounded({
      ...base,
      node: 'file',
      title: file.title,
      state: file.status,
      file: file.path,
      section: null,
      files: cited(tasks),
      tasks: listed(tasks)
    })
  }
  if (kind === 'tgroup') {
    for (const file of view.taskFiles) {
      for (const lot of file.lots) {
        for (const group of [lot, ...lot.groups]) {
          if (group.key !== first) continue
          const tasks = groupTasks(group)
          return bounded({
            ...base,
            node: 'group',
            title: group.title,
            state: group.status,
            file: file.path,
            section: group === lot ? file.title : lot.title,
            files: cited(tasks),
            tasks: listed(tasks)
          })
        }
      }
    }
    return undefined
  }
  if (kind === 'ttask') {
    for (const file of view.taskFiles) {
      const owners: { readonly title: string | null; readonly tasks: readonly TaskView[] }[] = [
        { title: null, tasks: file.tasks },
        ...file.lots.flatMap((lot) => [lot, ...lot.groups])
      ]
      for (const owner of owners) {
        const task = owner.tasks.find((entry) => (entry.key ?? entry.id) === first)
        if (task === undefined) continue
        return {
          ...base,
          node: 'task',
          title: task.text,
          state: task.state,
          file: file.path,
          section: owner.title,
          files: task.files,
          tasks: []
        }
      }
    }
    return undefined
  }
  const spec = view.specs.find((entry) => entry.number === first)
  if (spec === undefined) return undefined
  const tasksFile = `${spec.dir}/tasks.md`
  if (kind === 'spec') {
    const tasks = specTasks(spec)
    return bounded({
      ...base,
      node: 'spec',
      title: spec.title,
      state: spec.status,
      file: `${spec.dir}/spec.md`,
      section: null,
      files: cited(tasks),
      tasks: listed(tasks)
    })
  }
  if (kind === 'socle') {
    return bounded({
      ...base,
      node: 'socle',
      title: 'Socle',
      state: spec.status,
      file: tasksFile,
      section: spec.title,
      files: cited(spec.socle),
      tasks: listed(spec.socle)
    })
  }
  if (kind === 'story') {
    const story = spec.stories.find((entry) => String(entry.number) === second)
    if (story === undefined) return undefined
    return bounded({
      ...base,
      node: 'story',
      title: `US${story.number} · ${story.title}`,
      state: storyState(story),
      file: tasksFile,
      section: spec.title,
      files: story.files,
      tasks: listed(story.tasks)
    })
  }
  if (kind === 'task') {
    const task = specTasks(spec).find((entry) => entry.id === second)
    if (task === undefined) return undefined
    const story = spec.stories.find((entry) => entry.number === task.story)
    return {
      ...base,
      node: 'task',
      title: `${task.id} · ${task.text}`,
      state: task.state,
      file: tasksFile,
      section: story === undefined ? `${spec.title} (socle)` : `US${story.number} · ${story.title}`,
      files: task.files,
      tasks: []
    }
  }
  return undefined
}

/** Une liste de tâches trop longue est coupée (les premières gardées) : l'entrée reste sous sa borne. */
function bounded(input: WorkflowInput): WorkflowInput {
  if (JSON.stringify(input).length <= WORKFLOW_INPUT_MAX_CHARS) return input
  let tasks = input.tasks
  while (tasks.length > 0 && JSON.stringify({ ...input, tasks }).length > WORKFLOW_INPUT_MAX_CHARS) {
    tasks = tasks.slice(0, Math.floor(tasks.length / 2))
  }
  return { ...input, tasks, truncated: true }
}
