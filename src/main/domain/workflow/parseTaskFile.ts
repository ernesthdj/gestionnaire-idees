import type { TaskFileView, TaskGroupView, TaskView } from '@shared/ipc/workflow'
import { clip, WORKFLOW_LIMITS } from './limits'
import { citedPaths, taskState } from './parseTasks'
import { specStatus } from './specStatus'

const CHECKBOX = /^\s*[-*+]\s\[( |x|X|~)\]\s+(.+)$/
const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/
const FENCE = /^\s*(```|~~~)/
const TASK_ID = /^(T\d{3,4}[a-z]?)\b\s*/

/** Le texte contient au moins une case hors bloc de code : c'est un fichier de tâches (D20). Pur. */
export function hasTasks(text: string): boolean {
  let fenced = false
  for (const line of text.split(/\r?\n/)) {
    if (FENCE.test(line)) fenced = !fenced
    else if (!fenced && CHECKBOX.test(line)) return true
  }
  return false
}

interface Draft {
  readonly key: string
  readonly title: string
  readonly tasks: TaskView[]
  readonly groups: Draft[]
}

/**
 * Fichier Markdown de tâches (spec 023 D20, D21) : son `#` est le titre, ses `##` des lots, ses `###` (et plus) des
 * groupes du lot courant, ses cases `- [ ]`, `- [~]`, `- [x]` des tâches du dernier titre (une case indentée reste dans
 * le groupe de sa case parente). Les cases d'un bloc de code sont ignorées ; un titre sans tâche disparaît. Clés
 * stables et compactes (`WORKFLOW_KEY`) : empreintes du chemin, des titres et du texte, jamais du rang. Pur.
 */
export function parseTaskFile(path: string, text: string): TaskFileView {
  const fileKey = `f${fnv(path)}`
  const keys = new Keys()
  const root: Draft = { key: fileKey, title: '', tasks: [], groups: [] }
  let title: string | null = null
  let lot: Draft | null = null
  let group: Draft | null = null
  let count = 0
  let truncated = false
  let fenced = false
  for (const line of text.split(/\r?\n/)) {
    if (FENCE.test(line)) {
      fenced = !fenced
      continue
    }
    if (fenced) continue
    const heading = HEADING.exec(line)
    if (heading !== null) {
      const level = heading[1]?.length ?? 1
      const name = clip(heading[2] ?? '', WORKFLOW_LIMITS.title)
      if (level === 1 && title === null) {
        title = name
      } else if (level <= 2 || lot === null) {
        lot = { key: keys.next(`${fileKey}-`, name), title: name, tasks: [], groups: [] }
        root.groups.push(lot)
        group = null
      } else {
        group = { key: keys.next(`${lot.key}-`, name), title: name, tasks: [], groups: [] }
        lot.groups.push(group)
      }
      continue
    }
    const box = CHECKBOX.exec(line)
    if (box === null) continue
    if (count >= WORKFLOW_LIMITS.tasksPerSpec) {
      truncated = true
      break
    }
    count += 1
    const raw = (box[2] ?? '').trim()
    const id = TASK_ID.exec(raw)?.[1] ?? ''
    const description = raw.slice(id === '' ? 0 : (TASK_ID.exec(raw)?.[0].length ?? 0)).trim()
    const owner = group ?? lot ?? root
    const state = taskState(box[1] ?? ' ')
    owner.tasks.push({
      id,
      key: keys.next(`${owner.key}-`, description),
      done: state === 'done',
      state,
      story: null,
      text: clip(description, WORKFLOW_LIMITS.taskText),
      files: citedPaths(description)
    })
  }
  const lots = root.groups.map(finish).filter((entry) => entry.total > 0)
  const tasks = [...root.tasks, ...lots.flatMap(allTasks)]
  return {
    key: fileKey,
    path,
    title: title ?? path.split('/').at(-1)?.replace(/\.md$/i, '') ?? path,
    tasks: root.tasks,
    lots,
    done: tasks.filter((task) => task.done).length,
    total: tasks.length,
    status: specStatus(null, tasks),
    partial: truncated
  }
}

function finish(draft: Draft): TaskGroupView {
  const groups = draft.groups.map(finish).filter((entry) => entry.total > 0)
  const tasks = [...draft.tasks, ...groups.flatMap((entry) => entry.tasks)]
  return {
    key: draft.key,
    title: draft.title,
    tasks: draft.tasks,
    groups,
    done: tasks.filter((task) => task.done).length,
    total: tasks.length,
    status: specStatus(null, tasks)
  }
}

const allTasks = (lot: TaskGroupView): TaskView[] => [...lot.tasks, ...lot.groups.flatMap((entry) => entry.tasks)]

/** Clés courtes et stables : empreinte FNV-1a du texte, suffixée en cas de doublon (deux tâches au même texte). */
class Keys {
  private readonly seen = new Map<string, number>()

  next(prefix: string, text: string): string {
    const base = `${prefix}${fnv(text)}`
    const rank = (this.seen.get(base) ?? 0) + 1
    this.seen.set(base, rank)
    return rank === 1 ? base : `${base}.${rank}`
  }
}

function fnv(text: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(36)
}
