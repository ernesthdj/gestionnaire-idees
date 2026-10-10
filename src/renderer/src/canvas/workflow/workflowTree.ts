import {
  isToBrainstorm,
  type BrainstormDocView,
  type SpecStatus,
  type SpecView,
  type StoryView,
  type TaskFileView,
  type TaskGroupView,
  type TaskState,
  type TaskView,
  type WorkflowView
} from '@shared/ipc/workflow'
import type { NodeIconKey, NodeStatus } from '../living/nodeVisual'

/**
 * Arbre de la vue Workflow (spec 023 D5, D8, D16) : le genesis du projet, quatre branches (En cours, À venir, Livrées, À
 * brainstormer), puis spec › user stories › tâches restantes, et le socle des tâches sans user story ; sous chaque user
 * story et chaque socle, « ✓ Faites (N) » regroupe ses tâches cochées. Repli par défaut (Livrées, specs à venir, user
 * stories livrées, socle, tâches faites) corrigé par les choix mémorisés de mentalyas. Fonctions pures.
 */

/** Vue lue, ou message d'erreur (dossier introuvable…). */
export type WorkflowEntry = { readonly view: WorkflowView } | { readonly error: string }

export type WorkflowBranch = 'active' | 'upcoming' | 'delivered' | 'brainstorm'

export type WorkflowSubject =
  | { readonly kind: 'branch'; readonly branch: WorkflowBranch; readonly specs: readonly SpecView[] }
  | { readonly kind: 'spec'; readonly spec: SpecView }
  | { readonly kind: 'story'; readonly spec: SpecView; readonly story: StoryView }
  | { readonly kind: 'socle'; readonly spec: SpecView }
  | {
      readonly kind: 'done'
      readonly spec: SpecView
      readonly story: StoryView | null
      readonly tasks: readonly TaskView[]
    }
  | { readonly kind: 'task'; readonly spec: SpecView; readonly story: StoryView | null; readonly task: TaskView }
  | { readonly kind: 'doc'; readonly doc: BrainstormDocView; readonly family: readonly BrainstormDocView[] }
  /** Fichier de tâches (D20), son lot ou son groupe, une de ses tâches, ses tâches faites. */
  | { readonly kind: 'taskFile'; readonly file: TaskFileView }
  | { readonly kind: 'taskGroup'; readonly file: TaskFileView; readonly group: TaskGroupView }
  | {
      readonly kind: 'fileTask'
      readonly file: TaskFileView
      readonly group: TaskGroupView | null
      readonly task: TaskView
    }
  | {
      readonly kind: 'fileDone'
      readonly file: TaskFileView
      readonly group: TaskGroupView | null
      readonly tasks: readonly TaskView[]
    }
  | { readonly kind: 'message'; readonly text: string; readonly missing: boolean }

export interface WorkflowItem {
  /** Clé stable (research R7), aussi identifiant du nœud sur la carte. */
  readonly key: string
  /** Parent : clé d'un autre nœud, ou le genesis. */
  readonly parentKey: string
  readonly title: string
  readonly icon: NodeIconKey
  readonly status?: NodeStatus
  /** Jauge « faites / toutes ». */
  readonly progress?: { readonly done: number; readonly total: number }
  /** Ses descendants sont masqués. */
  readonly collapsed: boolean
  /** Nombre de ses descendants (pour la pastille ▸ N). */
  readonly descendants: number
  /** Lecture partielle d'un fichier (spec mal formée, trop grosse…). */
  readonly partial: boolean
  /** Nom accessible du nœud. */
  readonly label: string
  readonly subject: WorkflowSubject
}

export interface WorkflowTree {
  /** Tous les nœuds, en ordre de parcours (parent avant enfants). */
  readonly items: readonly WorkflowItem[]
  /** Nœuds affichés : ceux dont aucun ancêtre n'est replié. */
  readonly visible: readonly WorkflowItem[]
}

export const SPEC_STATUS_LABELS: Readonly<Record<SpecStatus, string>> = {
  specified: 'spécifiée',
  planned: 'planifiée',
  active: 'en cours',
  paused: 'en pause',
  delivered: 'livrée',
  abandoned: 'abandonnée'
}

export const BRANCH_TITLES: Readonly<Record<WorkflowBranch, string>> = {
  active: 'En cours',
  upcoming: 'À venir',
  delivered: 'Livrées',
  brainstorm: 'À brainstormer'
}

const BRANCH_ICONS: Readonly<Record<WorkflowBranch, NodeIconKey>> = {
  active: 'branchActive',
  upcoming: 'branchUpcoming',
  delivered: 'branchDelivered',
  brainstorm: 'branchBrainstorm'
}

const SPEC_NODE_STATUS: Readonly<Record<SpecStatus, NodeStatus>> = {
  specified: 'todo',
  planned: 'todo',
  active: 'doing',
  paused: 'todo',
  delivered: 'done',
  abandoned: 'done'
}

export const TASK_STATE_LABELS: Readonly<Record<TaskState, string>> = {
  todo: 'à faire',
  doing: 'en cours',
  done: 'faite'
}

/** Clé d'un nœud Workflow : `wf:<genesisId>:<sorte>[:<numéro>[:<identifiant>]]`. */
export const workflowKey = (genesisId: string, ...parts: readonly string[]): string =>
  ['wf', genesisId, ...parts].join(':')

const short = (text: string, max: number): string => {
  const plain = text.replace(/`/g, '').replace(/\s+/g, ' ').trim()
  return plain.length <= max ? plain : `${plain.slice(0, max - 1)}…`
}

const branchOf = (status: SpecStatus): WorkflowBranch =>
  status === 'active' ? 'active' : status === 'delivered' || status === 'abandoned' ? 'delivered' : 'upcoming'

const storyStatus = (story: StoryView): NodeStatus =>
  story.delivered ? 'done' : story.done > 0 || story.tasks.some((task) => task.state === 'doing') ? 'doing' : 'todo'

interface Draft extends Omit<WorkflowItem, 'collapsed' | 'descendants'> {
  /** Repli par défaut, avant les choix de mentalyas. */
  readonly foldedByDefault: boolean
}

export function workflowTree(entry: WorkflowEntry, genesisId: string): WorkflowTree {
  const drafts: Draft[] = []
  const add = (draft: Draft): void => {
    drafts.push(draft)
  }
  const message = (text: string, missing: boolean): void =>
    add({
      key: workflowKey(genesisId, 'message', missing ? 'missing' : 'empty'),
      parentKey: genesisId,
      title: text,
      icon: 'info',
      partial: false,
      label: text,
      subject: { kind: 'message', text, missing },
      foldedByDefault: false
    })
  if ('error' in entry) {
    message(entry.error, true)
    return finish(drafts, {})
  }
  const { view } = entry
  const ideas = view.brainstorm.filter(isToBrainstorm)
  if (view.empty || (view.specs.length === 0 && ideas.length === 0 && view.taskFiles.length === 0)) {
    message(
      'Brainstorme une idée, puis spécifie-la (ou tiens un fichier de tâches à cases) : la carte se remplira.',
      false
    )
    return finish(drafts, view.folded)
  }
  const groups: Readonly<Record<WorkflowBranch, readonly SpecView[]>> = {
    active: view.specs.filter((spec) => branchOf(spec.status) === 'active'),
    upcoming: view.specs.filter((spec) => branchOf(spec.status) === 'upcoming'),
    delivered: view.specs.filter((spec) => branchOf(spec.status) === 'delivered'),
    brainstorm: []
  }
  const task = (spec: SpecView, story: StoryView | null, item: TaskView, parentKey: string): void =>
    add({
      key: workflowKey(genesisId, 'task', spec.number, item.id),
      parentKey,
      title: `${item.done ? '✓ ' : ''}${item.id} · ${short(item.text, 56)}`,
      icon: 'task',
      status: item.state,
      partial: false,
      label: `Tâche ${item.id} ${TASK_STATE_LABELS[item.state]} : ${short(item.text, 200)}`,
      subject: { kind: 'task', spec, story, task: item },
      foldedByDefault: false
    })
  // Tâches faites d'une user story ou d'un socle (D16) : un nœud replié d'office, qui s'ouvre sur elles.
  const doneGroup = (spec: SpecView, story: StoryView | null, tasks: readonly TaskView[], parentKey: string): void => {
    const done = tasks.filter((entry) => entry.done)
    if (done.length === 0) return
    const key = workflowKey(genesisId, 'done', spec.number, story === null ? 'socle' : String(story.number))
    add({
      key,
      parentKey,
      title: `✓ Faites (${done.length})`,
      icon: 'branchDelivered',
      status: 'done',
      partial: false,
      label: `${done.length} tâche${done.length > 1 ? 's' : ''} faite${done.length > 1 ? 's' : ''} ${story === null ? 'du socle' : `de l'US${story.number}`}`,
      subject: { kind: 'done', spec, story, tasks: done },
      foldedByDefault: true
    })
    for (const item of done) task(spec, story, item, key)
  }
  const specNode = (spec: SpecView, branch: WorkflowBranch, parentKey: string): void => {
    const key = workflowKey(genesisId, 'spec', spec.number)
    const closed = branch === 'delivered'
    add({
      key,
      parentKey,
      title: `${spec.number} · ${spec.title}`,
      icon: 'spec',
      status: SPEC_NODE_STATUS[spec.status],
      ...(spec.total === 0 ? {} : { progress: { done: spec.done, total: spec.total } }),
      partial: spec.partial,
      label: `Spec ${spec.number} ${spec.title}, ${SPEC_STATUS_LABELS[spec.status]}${spec.total === 0 ? '' : `, ${spec.done} sur ${spec.total} tâches`}${spec.partial ? ', lecture partielle' : ''}`,
      subject: { kind: 'spec', spec },
      foldedByDefault: branch !== 'active'
    })
    for (const story of spec.stories) {
      const storyKey = workflowKey(genesisId, 'story', spec.number, String(story.number))
      const title = story.described ? story.title : '(user story non décrite)'
      add({
        key: storyKey,
        parentKey: key,
        title: `US${story.number} · ${title}`,
        icon: 'story',
        status: closed && !story.delivered ? 'done' : storyStatus(story),
        ...(story.total === 0 ? {} : { progress: { done: story.done, total: story.total } }),
        partial: false,
        label: `User story ${story.number}${story.priority === null ? '' : ` (P${story.priority})`} ${title}, ${story.delivered ? 'livrée' : `${story.done} sur ${story.total} tâches`}`,
        subject: { kind: 'story', spec, story },
        foldedByDefault: story.delivered
      })
      // Une spec livrée ou abandonnée ne montre pas ses reliquats en nœuds : ils sont listés dans sa carte (D7).
      if (!closed) for (const item of story.tasks.filter((entry) => !entry.done)) task(spec, story, item, storyKey)
      doneGroup(spec, story, story.tasks, storyKey)
    }
    const remaining = closed ? [] : spec.socle.filter((entry) => !entry.done)
    const socleDone = spec.socle.some((entry) => entry.done)
    if (remaining.length > 0 || socleDone) {
      const socleKey = workflowKey(genesisId, 'socle', spec.number)
      add({
        key: socleKey,
        parentKey: key,
        title: 'Socle',
        icon: 'socle',
        status: remaining.length > 0 ? 'doing' : 'done',
        progress: { done: spec.socle.filter((entry) => entry.done).length, total: spec.socle.length },
        partial: false,
        label: `Socle de la spec ${spec.number} (mise en place, fondations, finitions), ${remaining.length} tâches restantes`,
        subject: { kind: 'socle', spec },
        foldedByDefault: true
      })
      for (const item of remaining) task(spec, null, item, socleKey)
      doneGroup(spec, null, spec.socle, socleKey)
    }
  }
  for (const branch of ['active', 'upcoming', 'delivered'] as const) {
    const specs = groups[branch]
    if (specs.length === 0) continue
    const key = workflowKey(genesisId, 'branch', branch)
    add({
      key,
      parentKey: genesisId,
      title: `${BRANCH_TITLES[branch]} (${specs.length})`,
      icon: BRANCH_ICONS[branch],
      partial: false,
      label: `${BRANCH_TITLES[branch]} : ${specs.length} spec${specs.length > 1 ? 's' : ''}`,
      subject: { kind: 'branch', branch, specs },
      foldedByDefault: branch === 'delivered'
    })
    for (const spec of specs) specNode(spec, branch, key)
  }
  // Fichiers de tâches (D20, D21) : une branche par fichier, dans l'ordre lu ; lots, groupes, tâches restantes (en cours
  // comprises, jamais repliées) et « ✓ Faites (N) » sous chaque titre.
  const fileTask = (file: TaskFileView, group: TaskGroupView | null, item: TaskView, parentKey: string): void =>
    add({
      key: workflowKey(genesisId, 'ttask', item.key ?? item.id),
      parentKey,
      title: `${item.state === 'done' ? '✓ ' : ''}${item.id === '' ? '' : `${item.id} · `}${short(item.text, 56)}`,
      icon: 'task',
      status: item.state,
      partial: false,
      label: `Tâche ${TASK_STATE_LABELS[item.state]} : ${short(item.text, 200)}`,
      subject: { kind: 'fileTask', file, group, task: item },
      foldedByDefault: false
    })
  const fileTasks = (
    file: TaskFileView,
    group: TaskGroupView | null,
    tasks: readonly TaskView[],
    ownerKey: string,
    parentKey: string
  ): void => {
    for (const item of tasks.filter((entry) => !entry.done)) fileTask(file, group, item, parentKey)
    const done = tasks.filter((entry) => entry.done)
    if (done.length === 0) return
    const key = workflowKey(genesisId, 'tdone', ownerKey)
    add({
      key,
      parentKey,
      title: `✓ Faites (${done.length})`,
      icon: 'branchDelivered',
      status: 'done',
      partial: false,
      label: `${done.length} tâche${done.length > 1 ? 's' : ''} faite${done.length > 1 ? 's' : ''} de « ${group?.title ?? file.title} »`,
      subject: { kind: 'fileDone', file, group, tasks: done },
      foldedByDefault: true
    })
    for (const item of done) fileTask(file, group, item, key)
  }
  const groupNode = (file: TaskFileView, group: TaskGroupView, parentKey: string, lot: boolean): void => {
    const key = workflowKey(genesisId, 'tgroup', group.key)
    const doing = [...group.tasks, ...group.groups.flatMap((entry) => entry.tasks)].some((t) => t.state === 'doing')
    add({
      key,
      parentKey,
      title: group.title,
      icon: lot ? 'feature' : 'story',
      status: SPEC_NODE_STATUS[group.status],
      progress: { done: group.done, total: group.total },
      partial: false,
      label: `${lot ? 'Lot' : 'Groupe'} ${group.title}, ${SPEC_STATUS_LABELS[group.status]}, ${group.done} sur ${group.total} tâches`,
      subject: { kind: 'taskGroup', file, group },
      foldedByDefault: group.status === 'delivered' && !doing
    })
    fileTasks(file, group, group.tasks, group.key, key)
    for (const child of group.groups) groupNode(file, child, key, false)
  }
  for (const file of view.taskFiles) {
    const key = workflowKey(genesisId, 'tfile', file.key)
    add({
      key,
      parentKey: genesisId,
      title: file.title,
      icon: 'document',
      status: SPEC_NODE_STATUS[file.status],
      ...(file.total === 0 ? {} : { progress: { done: file.done, total: file.total } }),
      partial: file.partial,
      label: `Fichier de tâches ${file.path}, ${SPEC_STATUS_LABELS[file.status]}, ${file.done} sur ${file.total} tâches${file.partial ? ', lecture partielle' : ''}`,
      subject: { kind: 'taskFile', file },
      foldedByDefault: file.status === 'delivered'
    })
    fileTasks(file, null, file.tasks, file.key, key)
    for (const lot of file.lots) groupNode(file, lot, key, true)
  }
  if (ideas.length > 0) {
    const key = workflowKey(genesisId, 'branch', 'brainstorm')
    add({
      key,
      parentKey: genesisId,
      title: `${BRANCH_TITLES.brainstorm} (${ideas.length})`,
      icon: BRANCH_ICONS.brainstorm,
      partial: false,
      label: `${BRANCH_TITLES.brainstorm} : ${ideas.length} idée${ideas.length > 1 ? 's' : ''}`,
      subject: { kind: 'branch', branch: 'brainstorm', specs: [] },
      foldedByDefault: false
    })
    for (const doc of ideas) {
      add({
        key: workflowKey(genesisId, 'doc', doc.name.replace(/\.md$/i, '')),
        parentKey: key,
        title: doc.title,
        icon: 'idea',
        status: 'todo',
        partial: false,
        label: `Idée à brainstormer : ${doc.title}`,
        subject: { kind: 'doc', doc, family: view.brainstorm.filter((other) => other.family === doc.name) },
        foldedByDefault: false
      })
    }
  }
  return finish(drafts, view.folded)
}

/** Applique le repli (défaut corrigé par les choix mémorisés), compte les descendants, calcule les nœuds affichés. */
function finish(drafts: readonly Draft[], folded: Readonly<Record<string, boolean>>): WorkflowTree {
  const children = new Map<string, Draft[]>()
  for (const draft of drafts) children.set(draft.parentKey, [...(children.get(draft.parentKey) ?? []), draft])
  const count = (key: string): number => (children.get(key) ?? []).reduce((total, kid) => total + 1 + count(kid.key), 0)
  const items = drafts.map(({ foldedByDefault, ...draft }): WorkflowItem => {
    const descendants = count(draft.key)
    return { ...draft, descendants, collapsed: descendants > 0 && (folded[draft.key] ?? foldedByDefault) }
  })
  const byKey = new Map(items.map((item) => [item.key, item] as const))
  const shown = (item: WorkflowItem): boolean => {
    for (let parent = byKey.get(item.parentKey); parent !== undefined; parent = byKey.get(parent.parentKey)) {
      if (parent.collapsed) return false
    }
    return true
  }
  return { items, visible: items.filter(shown) }
}
