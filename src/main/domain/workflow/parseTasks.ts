import type { TaskView } from '@shared/ipc/workflow'
import { clip, WORKFLOW_LIMITS } from './limits'

const TASK = /^\s*-\s\[( |x|X)\]\s+(T\d{3,4}[a-z]?)\b(.*)$/
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

/** Tâches d'un `tasks.md` : `- [ ] T012 [P] [US1] description` (identifiant suffixé `T009b` admis) ; `truncated` au-delà de la borne. Pur. */
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
    tasks.push({
      id,
      done: match[1] !== ' ',
      story,
      text: clip(description, WORKFLOW_LIMITS.taskText),
      files: citedPaths(description)
    })
  }
  return { tasks, truncated: false }
}
