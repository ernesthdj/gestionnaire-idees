import type { TaskState, TaskView } from '@shared/ipc/workflow'
import { clip, WORKFLOW_LIMITS } from './limits'

const TASK = /^\s*-\s\[( |x|X|~)\]\s+(T\d{3,4}[a-z]?)\b(.*)$/
const LABEL = /^\s*\[(P|US(\d+))\]/
/** Chemin relatif plausible : au moins un dossier, un nom avec extension ; ni absolu ni remontée. */
const PATH = /^[\w.@-]+(?:\/[\w.@-]+)+$/
const EXTENSION = /\.[A-Za-z0-9]{1,8}$/

/**
 * Chemins de fichiers cités par un texte de tâche (research R2) : mots qui ressemblent à un chemin relatif de fichier
 * (`src/x.ts`, entre backticks ou non), dédoublonnés, au plus `WORKFLOW_LIMITS.pathsPerTask` ; jamais un chemin absolu,
 * une adresse ni une remontée `..`. Pur.
 */
export function citedPaths(text: string): string[] {
  const found = new Set<string>()
  for (const raw of text.split(/[\s`'"()[\]{},;«»]+/)) {
    const token = raw.replace(/[.:]+$/, '')
    if (!PATH.test(token) || !EXTENSION.test(token)) continue
    if (token.split('/').some((segment) => segment === '..' || segment === '.')) continue
    found.add(token)
    if (found.size >= WORKFLOW_LIMITS.pathsPerTask) break
  }
  return [...found]
}

/** Nom cité seul entre backticks : `WindowManager`, `arbre.ts`, `progressionOf()`. */
const NAMED = /`([^`\s/]+)`/g
const IDENTIFIER = /^[A-Za-z_][\w-]*$/

/**
 * Noms de fichiers cités sans chemin par un texte de tâche (spec 032 Q6) : entre backticks, un nom avec extension
 * (`arbre.ts`) ou un identifiant d'au moins 4 caractères qui porte une majuscule (`WindowManager`, `progressionOf`),
 * rendus sans extension, dédoublonnés, au plus `WORKFLOW_LIMITS.pathsPerTask`. Un mot en minuscules (`kind`) n'est
 * pas retenu : trop d'homonymes. Pur.
 */
export function citedNames(text: string): string[] {
  const found = new Set<string>()
  for (const match of text.matchAll(NAMED)) {
    const token = (match[1] ?? '').replace(/\(\)$/, '')
    const withExtension = EXTENSION.test(token)
    const name = token.replace(EXTENSION, '')
    if (!IDENTIFIER.test(name) || name.length < 4 || (!withExtension && !/[A-Z]/.test(name))) continue
    found.add(name)
    if (found.size >= WORKFLOW_LIMITS.pathsPerTask) break
  }
  return [...found]
}

/** Champ `names` d'une tâche, omis s'il est vide. */
export const namesOf = (text: string): { readonly names?: readonly string[] } => {
  const names = citedNames(text)
  return names.length > 0 ? { names } : {}
}

/** État d'une case (D21) : `x` faite, `~` en cours, sinon à faire. Pur. */
export function taskState(mark: string): TaskState {
  if (mark === 'x' || mark === 'X') return 'done'
  return mark === '~' ? 'doing' : 'todo'
}

/** Tâches d'un `tasks.md` : `- [ ] T012 [P] [US1] description` (`- [~]` : en cours) (identifiant suffixé `T009b` admis) ; `truncated` au-delà de la borne. Pur. */
export function parseTasks(text: string): { readonly tasks: TaskView[]; readonly truncated: boolean } {
  const tasks: TaskView[] = []
  const seen = new Set<string>()
  for (const line of text.split(/\r?\n/)) {
    const match = TASK.exec(line)
    if (match === null) continue
    const id = match[2] ?? ''
    if (seen.has(id)) continue
    if (tasks.length >= WORKFLOW_LIMITS.tasksPerSpec) return { tasks, truncated: true }
    seen.add(id)
    let rest = match[3] ?? ''
    let story: number | null = null
    for (let label = LABEL.exec(rest); label !== null; label = LABEL.exec(rest)) {
      if (label[2] !== undefined && story === null) story = Number(label[2])
      rest = rest.slice(label[0].length)
    }
    const description = rest.trim()
    const state = taskState(match[1] ?? ' ')
    tasks.push({
      id,
      done: state === 'done',
      state,
      story,
      text: clip(description, WORKFLOW_LIMITS.taskText),
      files: citedPaths(description),
      ...namesOf(description)
    })
  }
  return { tasks, truncated: false }
}
