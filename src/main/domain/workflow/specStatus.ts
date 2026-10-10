import type { SpecMarker, SpecStatus, SpecView, StoryView, TaskView } from '@shared/ipc/workflow'
import type { ParsedSpec } from './parseSpec'

/**
 * Statut retenu d'une spec (spec 023 D7, data-model) : le marqueur de sa ligne `**Status**` prime ; sinon calculé
 * depuis ses cases (sans `tasks.md` : spécifiée ; aucune cochée ni en cours : planifiée ; toutes : livrée ; sinon en cours). Pur.
 */
export function specStatus(marker: SpecMarker | null, tasks: readonly TaskView[] | null): SpecStatus {
  if (marker !== null) return marker
  if (tasks === null) return 'specified'
  const done = tasks.filter((task) => task.done).length
  if (done === 0 && !tasks.some((task) => task.state === 'doing')) return 'planned'
  return done === tasks.length ? 'delivered' : 'active'
}

const union = (tasks: readonly TaskView[]): string[] => [...new Set(tasks.flatMap((task) => task.files))]

export interface SpecInput {
  /** `specs/022-noeuds-vivants`. */
  readonly dir: string
  /** `spec.md` lue ; `null` si absente ou illisible. */
  readonly spec: ParsedSpec | null
  /** Tâches de `tasks.md` ; `null` sans `tasks.md`. */
  readonly tasks: readonly TaskView[] | null
  /** Un fichier trop gros, illisible ou tronqué. */
  readonly partial: boolean
}

/**
 * Assemble la vue d'une spec : user stories décrites et citées par des tâches (`described: false` sinon), livrées quand
 * toutes leurs tâches sont cochées (sans tâche étiquetée : quand la spec l'est), socle (tâches sans user story), compteurs, reliquats d'une spec marquée livrée ou
 * abandonnée. Pur.
 */
export function buildSpec(input: SpecInput): SpecView {
  const name = input.dir.split('/').at(-1) ?? input.dir
  const number = /^(\d+)/.exec(name)?.[1] ?? name
  const tasks = input.tasks ?? []
  const marker = input.spec?.marker ?? null
  const status = specStatus(marker, input.tasks)
  const described = new Map((input.spec?.stories ?? []).map((story) => [story.number, story] as const))
  const numbers = [
    ...new Set([...described.keys(), ...tasks.flatMap((task) => (task.story === null ? [] : [task.story]))])
  ].sort((a, b) => a - b)
  const stories = numbers.map((storyNumber): StoryView => {
    const own = tasks.filter((task) => task.story === storyNumber)
    const done = own.filter((task) => task.done).length
    const story = described.get(storyNumber)
    return {
      number: storyNumber,
      title: story?.title ?? `User story ${storyNumber}`,
      priority: story?.priority ?? null,
      described: story !== undefined,
      tasks: own,
      done,
      total: own.length,
      // Sans tâche étiquetée (specs anciennes), une user story suit sa spec.
      delivered: own.length > 0 ? done === own.length : status === 'delivered',
      files: union(own)
    }
  })
  const done = tasks.filter((task) => task.done).length
  return {
    number,
    dir: input.dir,
    title: input.spec?.title ?? name.replace(/^\d+-/, '').replace(/-/g, ' '),
    statusLine: input.spec?.statusLine ?? null,
    marker,
    status,
    createdAt: input.spec?.createdAt ?? null,
    decisions: input.spec?.decisions ?? 0,
    stories,
    socle: tasks.filter((task) => task.story === null),
    done,
    total: tasks.length,
    leftovers: status === 'delivered' || status === 'abandoned' ? tasks.filter((task) => !task.done) : [],
    citedDocs: input.spec?.citedDocs ?? [],
    partial: input.partial || input.spec === null || input.spec.title === null
  }
}
