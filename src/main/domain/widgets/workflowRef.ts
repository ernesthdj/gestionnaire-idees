import type { TaskGroupView, TaskView, WorkflowView } from '@shared/ipc/workflow'

/**
 * Nœud du Workflow désigné par Claude avec un repère lisible (spec 026 D10) : une tâche par son identifiant (`T004`,
 * avec son fichier si deux fichiers l'ont : `T004 docs/TACHES-X.md`), un lot par son titre, un fichier de tâches par
 * son chemin, une spec par son numéro, ou la clé `wf:…` elle-même. Les clés internes ne sont jamais montrées à Claude.
 * Fonctions pures.
 */

/** Nœud du Workflow qu'un widget peut lire : sa clé, son libellé pour Claude, et les repères qui le désignent. */
export interface WorkflowRefEntry {
  readonly key: string
  readonly label: string
  readonly aliases: readonly string[]
}

export type WorkflowRefResult =
  | { readonly key: string; readonly label: string }
  | { readonly key: null; readonly reason: 'inconnu' | 'ambigu'; readonly candidates: readonly string[] }

/** Nombre de nœuds rendus à Claude quand un repère ne désigne rien (ou plusieurs). */
const MAX_CANDIDATES = 40

const norm = (text: string): string => text.trim().replace(/\s+/g, ' ').toLowerCase()

/** Tous les nœuds branchables du Workflow d'un projet, dans l'ordre de la vue. */
export function workflowRefs(view: WorkflowView): WorkflowRefEntry[] {
  const at = (kind: string, first: string, second?: string): string =>
    `wf:${view.genesisId}:${kind}:${first}${second === undefined ? '' : `:${second}`}`
  const entries: WorkflowRefEntry[] = []
  for (const spec of view.specs) {
    entries.push({
      key: at('spec', spec.number),
      label: `spec ${spec.number} « ${spec.title} »`,
      aliases: [spec.number, `spec ${spec.number}`, spec.title]
    })
    const specTask = (task: TaskView): void => {
      if (task.id === '') return
      entries.push({
        key: at('task', spec.number, task.id),
        label: `${task.id} (spec ${spec.number}) · ${task.text}`,
        aliases: [task.id, `${task.id} spec ${spec.number}`, `${task.id} ${spec.dir}/tasks.md`]
      })
    }
    for (const task of spec.socle) specTask(task)
    for (const story of spec.stories) {
      entries.push({
        key: at('story', spec.number, String(story.number)),
        label: `spec ${spec.number} US${story.number} « ${story.title} »`,
        aliases: [`${spec.number} us${story.number}`, `spec ${spec.number} us${story.number}`]
      })
      for (const task of story.tasks) specTask(task)
    }
  }
  for (const file of view.taskFiles) {
    entries.push({
      key: at('tfile', file.key),
      label: `fichier ${file.path} « ${file.title} »`,
      aliases: [file.path, file.title]
    })
    const task = (entry: TaskView, section: string | null): void => {
      const id = entry.key ?? entry.id
      if (id === '') return
      entries.push({
        key: at('ttask', id),
        label: `${entry.id === '' ? 'tâche' : entry.id} (${file.path}${section === null ? '' : `, ${section}`}) · ${entry.text}`,
        aliases: entry.id === '' ? [entry.text] : [entry.id, `${entry.id} ${file.path}`, entry.text]
      })
    }
    for (const entry of file.tasks) task(entry, null)
    const group = (owner: TaskGroupView): void => {
      entries.push({
        key: at('tgroup', owner.key),
        label: `lot « ${owner.title} » (${file.path})`,
        aliases: [owner.title, `${owner.title} ${file.path}`]
      })
      for (const entry of owner.tasks) task(entry, owner.title)
      for (const child of owner.groups) group(child)
    }
    for (const lot of file.lots) group(lot)
  }
  return entries
}

/**
 * Le nœud qu'un repère désigne. Un repère exact (identifiant, titre, chemin, clé) l'emporte ; sinon un début de titre
 * s'il est unique. Rien, ou plusieurs : la liste des nœuds possibles, pour que Claude précise.
 */
export function resolveWorkflowRef(view: WorkflowView, ref: string): WorkflowRefResult {
  const entries = workflowRefs(view)
  const wanted = norm(ref)
  const byKey = entries.find((entry) => entry.key === ref.trim())
  if (byKey !== undefined) return { key: byKey.key, label: byKey.label }
  const exact = entries.filter((entry) => entry.aliases.some((alias) => norm(alias) === wanted))
  const matches =
    exact.length > 0
      ? exact
      : wanted.length < 3
        ? []
        : entries.filter((entry) => entry.aliases.some((alias) => norm(alias).startsWith(wanted)))
  const [only] = matches
  if (matches.length === 1 && only !== undefined) return { key: only.key, label: only.label }
  return {
    key: null,
    reason: matches.length === 0 ? 'inconnu' : 'ambigu',
    candidates: (matches.length === 0 ? entries : matches).slice(0, MAX_CANDIDATES).map((entry) => entry.label)
  }
}
