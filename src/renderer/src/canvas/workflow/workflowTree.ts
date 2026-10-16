import {
  type BrainstormDocView,
  type SpecStatus,
  type SpecView,
  type StoryView,
  type TaskFileView,
  type TaskGroupView,
  type TaskState,
  type TaskView,
  type WorkflowTreeNode,
  type WorkflowView
} from '@shared/ipc/workflow'
import type { NodeIconKey, NodeStatus } from '../living/nodeVisual'

/**
 * Arbre de la vue Workflow (spec 032 D2 à D6) : l'arbre des ronds (on y brainstorme et documente) et des carrés (on y
 * implémente) lu par le main dans les fichiers du projet, traduit en nœuds de la carte avec leur sujet (spec, user
 * story, tâche, document, fichier de tâches, lot) pour la carte de détails. Repli par défaut des ronds dont tout est
 * fait, corrigé par les choix mémorisés de mentalyas. Fonctions pures.
 */

/** Vue lue, ou message d'erreur (dossier introuvable…). */
export type WorkflowEntry = { readonly view: WorkflowView } | { readonly error: string }

export type WorkflowSubject =
  | { readonly kind: 'spec'; readonly spec: SpecView }
  | { readonly kind: 'story'; readonly spec: SpecView; readonly story: StoryView }
  | { readonly kind: 'task'; readonly spec: SpecView; readonly story: StoryView | null; readonly task: TaskView }
  | { readonly kind: 'doc'; readonly doc: BrainstormDocView; readonly family: readonly BrainstormDocView[] }
  /** Fichier de tâches (D20), son lot ou son groupe, une de ses tâches. */
  | { readonly kind: 'taskFile'; readonly file: TaskFileView }
  | { readonly kind: 'taskGroup'; readonly file: TaskFileView; readonly group: TaskGroupView }
  | {
      readonly kind: 'fileTask'
      readonly file: TaskFileView
      readonly group: TaskGroupView | null
      readonly task: TaskView
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
  /** Rond (brainstorm et doc) ou carré (tâche à implémenter) ; `undefined` pour un message. */
  readonly shape?: 'round' | 'square'
  /** Rond : maturité de son brainstorm en % (anneau extérieur) ; `null` : non évalué. */
  readonly maturity?: number | null
  /** Carré d'un brainstorm pas complet : une ébauche (D5). */
  readonly sketch?: boolean
  /** Le carré « ▶ Bosser ici » (D6). */
  readonly next?: boolean
  /** Le rond du brainstorm à compléter d'abord, quand aucune tâche n'est travaillable (« ▶ Compléter ici », D18). */
  readonly complete?: boolean
  /** Document de brainstorm d'où vient le nœud (le sien pour un rond-document) ; `null` : aucun. */
  readonly origin?: string | null
  /** Rond d'une spec ou d'un fichier de tâches abandonné : en rouge sur la carte (demande de mentalyas, 2026-10-15). */
  readonly abandoned?: true
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

export const TASK_STATE_LABELS: Readonly<Record<TaskState, string>> = {
  todo: 'à faire',
  doing: 'en cours',
  done: 'faite'
}

/** Clé d'un nœud Workflow : `wf:<genesisId>:<sorte>[:<numéro>[:<identifiant>]]`. */
export const workflowKey = (genesisId: string, ...parts: readonly string[]): string =>
  ['wf', genesisId, ...parts].join(':')

/** Sorte d'un rond dans l'arbre (`spec:017`) → sorte de sa clé sur la carte (celles de `describe`, plus bas). */
const ROUND_KINDS: Readonly<Record<string, string>> = { doc: 'doc', spec: 'spec', file: 'tfile', lot: 'tgroup' }

/** Clé sur la carte d'un rond de l'arbre du Workflow (spec 032 Q8 : la Progression y mène) ; `null` hors rond. */
export function roundNodeKey(genesisId: string, treeKey: string): string | null {
  const [kind = '', first = ''] = treeKey.split(':')
  const mapped = ROUND_KINDS[kind]
  return mapped === undefined || first === '' ? null : workflowKey(genesisId, mapped, first)
}

const short = (text: string, max: number): string => {
  const plain = text.replace(/`/g, '').replace(/\s+/g, ' ').trim()
  return plain.length <= max ? plain : `${plain.slice(0, max - 1)}…`
}

interface Draft extends Omit<WorkflowItem, 'collapsed' | 'descendants'> {
  /** Repli par défaut, avant les choix de mentalyas. */
  readonly foldedByDefault: boolean
}

/** Statut affiché d'un rond : tout fait, commencé, ou rien encore. */
const roundStatus = (node: WorkflowTreeNode): NodeStatus =>
  node.total > 0 && node.done === node.total ? 'done' : node.done > 0 || hasDoing(node) ? 'doing' : 'todo'
const hasDoing = (node: WorkflowTreeNode): boolean =>
  node.state === 'doing' || node.children.some((child) => hasDoing(child))

const ROUND_ICONS: Readonly<Record<WorkflowTreeNode['source'], NodeIconKey>> = {
  doc: 'idea',
  spec: 'spec',
  story: 'story',
  taskFile: 'document',
  lot: 'feature',
  task: 'task'
}

/** Le groupe (lot `##` ou groupe `###`) d'un fichier de tâches, par sa clé. */
function groupOf(file: TaskFileView, key: string): TaskGroupView | null {
  const walk = (groups: readonly TaskGroupView[]): TaskGroupView | null => {
    for (const group of groups) {
      if (group.key === key) return group
      const inner = walk(group.groups)
      if (inner !== null) return inner
    }
    return null
  }
  return walk(file.lots)
}

const fileTasksOf = (file: TaskFileView): TaskView[] => {
  const ofGroup = (group: TaskGroupView): TaskView[] => [...group.tasks, ...group.groups.flatMap(ofGroup)]
  return [...file.tasks, ...file.lots.flatMap(ofGroup)]
}

export function workflowTree(entry: WorkflowEntry, genesisId: string): WorkflowTree {
  const drafts: Draft[] = []
  const message = (text: string, missing: boolean): void => {
    drafts.push({
      key: workflowKey(genesisId, 'message', missing ? 'missing' : 'empty'),
      parentKey: genesisId,
      title: text,
      icon: 'info',
      partial: false,
      label: text,
      subject: { kind: 'message', text, missing },
      foldedByDefault: false
    })
  }
  if ('error' in entry) {
    message(entry.error, true)
    return finish(drafts, {})
  }
  const { view } = entry
  if (view.empty || view.tree.nodes.length === 0) {
    message('Lance « ✦ Nouveau brainstorm » : son document et ses tâches pousseront ici, en ronds et en carrés.', false)
    return finish(drafts, view.folded)
  }
  const specs = new Map(view.specs.map((spec) => [spec.number, spec] as const))
  const files = new Map(view.taskFiles.map((file) => [file.key, file] as const))
  const docs = new Map(view.brainstorm.map((doc) => [doc.name.replace(/\.md$/i, ''), doc] as const))

  /** Contexte d'un nœud : la spec, la user story, le fichier et le groupe où il se trouve. */
  interface Context {
    readonly spec: SpecView | null
    readonly story: StoryView | null
    readonly file: TaskFileView | null
    readonly group: TaskGroupView | null
    /** Document de brainstorm le plus proche au-dessus. */
    readonly doc: string | null
  }
  const none: Context = { spec: null, story: null, file: null, group: null, doc: null }

  /** La clé de la carte (celles de la spec 023, pour garder conversations et replis) et le sujet d'un nœud. */
  const describe = (
    node: WorkflowTreeNode,
    context: Context
  ): { readonly key: string; readonly subject: WorkflowSubject; readonly context: Context } | null => {
    const [kind, first = '', second = ''] = node.key.split(':')
    switch (kind) {
      case 'doc': {
        const doc = docs.get(first)
        if (doc === undefined) return null
        const family = view.brainstorm.filter((other) => other.family === doc.name)
        return {
          key: workflowKey(genesisId, 'doc', first),
          subject: { kind: 'doc', doc, family },
          context: { ...none, doc: doc.path }
        }
      }
      case 'spec': {
        const spec = specs.get(first)
        if (spec === undefined) return null
        return {
          key: workflowKey(genesisId, 'spec', first),
          subject: { kind: 'spec', spec },
          context: { ...none, spec, doc: context.doc }
        }
      }
      case 'story': {
        const spec = specs.get(first)
        const story = spec?.stories.find((entry) => String(entry.number) === second)
        if (spec === undefined || story === undefined) return null
        return {
          key: workflowKey(genesisId, 'story', first, second),
          subject: { kind: 'story', spec, story },
          context: { ...none, spec, story, doc: context.doc }
        }
      }
      case 'task': {
        const spec = specs.get(first)
        const all = spec === undefined ? [] : [...spec.socle, ...spec.stories.flatMap((story) => story.tasks)]
        const task = all.find((entry) => entry.id === second) ?? all.find((entry) => entry.text === node.title)
        if (spec === undefined || task === undefined) return null
        const story = spec.stories.find((entry) => entry.number === task.story) ?? null
        return {
          key: workflowKey(genesisId, 'task', first, task.id),
          subject: { kind: 'task', spec, story, task },
          context
        }
      }
      case 'file': {
        const file = files.get(first)
        if (file === undefined) return null
        return {
          key: workflowKey(genesisId, 'tfile', first),
          subject: { kind: 'taskFile', file },
          context: { ...none, file, doc: context.doc }
        }
      }
      case 'lot': {
        const file = context.file
        const group = file === null ? null : groupOf(file, first)
        if (file === null || group === null) return null
        return {
          key: workflowKey(genesisId, 'tgroup', first),
          subject: { kind: 'taskGroup', file, group },
          context: { ...context, group }
        }
      }
      case 'ftask': {
        const file = context.file
        const task = file === null ? undefined : fileTasksOf(file).find((entry) => entry.key === first)
        if (file === null || task === undefined) return null
        return {
          key: workflowKey(genesisId, 'ttask', first),
          subject: { kind: 'fileTask', file, group: context.group, task },
          context
        }
      }
      default:
        return null
    }
  }

  const add = (node: WorkflowTreeNode, parentKey: string, context: Context): void => {
    const described = describe(node, context)
    if (described === null) return
    const { key, subject } = described
    if (node.kind === 'square') {
      const task = subject.kind === 'task' || subject.kind === 'fileTask' ? subject.task : null
      const id = task === null || task.id === '' ? '' : `${task.id} · `
      const next = view.tree.next === node.key
      drafts.push({
        key,
        parentKey,
        title: `${node.state === 'done' ? '✓ ' : ''}${id}${short(node.title, 56)}`,
        icon: 'task',
        status: node.state ?? 'todo',
        partial: false,
        label: `${node.sketch ? 'Ébauche' : 'Carré'} ${id}${short(node.title, 200)}, ${TASK_STATE_LABELS[node.state ?? 'todo']}${
          node.sketch ? ', en attente du brainstorm' : ''
        }, contexte ${node.maturity === null ? 'non évalué' : `${node.maturity} %`}${next ? ', bosser ici' : ''}`,
        subject,
        shape: 'square',
        sketch: node.sketch,
        // Jauge de contexte (D18) : la maturité du brainstorm de la tâche.
        maturity: node.maturity,
        next,
        origin: described.context.doc,
        foldedByDefault: false
      })
      return
    }
    const title = subject.kind === 'spec' ? `${subject.spec.number} · ${node.title}` : node.title
    const brainstorm = node.maturity === null ? 'brainstorm non évalué' : `brainstorm ${node.maturity} %`
    drafts.push({
      key,
      parentKey,
      title,
      icon: ROUND_ICONS[node.source],
      status: roundStatus(node),
      ...(node.total === 0 ? {} : { progress: { done: node.done, total: node.total } }),
      partial:
        subject.kind === 'spec' ? subject.spec.partial : subject.kind === 'taskFile' ? subject.file.partial : false,
      label: `Rond ${title}, ${brainstorm}${node.total === 0 ? '' : `, ${node.done} sur ${node.total} tâches`}${
        view.tree.complete === node.key ? ', compléter ici' : ''
      }`,
      subject,
      shape: 'round',
      maturity: node.maturity,
      ...(view.tree.complete === node.key ? { complete: true } : {}),
      origin: described.context.doc,
      ...(node.status === 'abandoned' ? { abandoned: true as const } : {}),
      // Tout est fait : replié d'office (la carte reste lisible) ; mentalyas le déplie, son choix est gardé.
      foldedByDefault: node.total > 0 && node.done === node.total
    })
    for (const child of node.children) add(child, key, described.context)
  }
  for (const node of view.tree.nodes) add(node, genesisId, none)
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
