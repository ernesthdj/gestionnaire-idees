import {
  MATURITY_PERCENT,
  type BrainstormDocView,
  type SpecStatus,
  type SpecView,
  type TaskFileView,
  type TaskGroupView,
  type TaskView,
  type WorkflowTreeNode,
  type WorkflowTreeView
} from '@shared/ipc/workflow'

/** Niveaux sous le projet (spec 032 D9) : au-delà, les carrés remontent dans le rond du dernier niveau. */
export const TREE_DEPTH = 4
/** Le document du projet lui-même : ses enfants sont au niveau 1. */
const FOUNDATION_DOC = 'L1-fondation.md'
/** Un carré de ces specs ou fichiers n'est jamais « à bosser » (spec 032 D6). */
const RESTING: ReadonlySet<SpecStatus> = new Set(['delivered', 'abandoned', 'paused'])

/** Nœud en construction : ses compteurs sont calculés à la fin, depuis ses carrés. */
interface Draft {
  readonly key: string
  readonly kind: 'round' | 'square'
  readonly source: WorkflowTreeNode['source']
  readonly title: string
  readonly maturity: number | null
  readonly state: WorkflowTreeNode['state']
  readonly sketch: boolean
  readonly status: SpecStatus | null
  readonly path: string | null
  readonly files: readonly string[]
  readonly names: readonly string[]
  /** Un carré qu'on peut implémenter maintenant (ni ébauche, ni dans une spec livrée, abandonnée ou en pause). */
  readonly workable: boolean
  readonly children: Draft[]
}

const docKey = (name: string): string => `doc:${name.replace(/\.md$/i, '')}`
const complete = (maturity: number | null): boolean => maturity === 100

const square = (
  key: string,
  task: TaskView,
  maturity: number | null,
  status: SpecStatus | null,
  path: string | null
): Draft => {
  const sketch = !complete(maturity)
  return {
    key,
    kind: 'square',
    source: 'task',
    title: task.text,
    maturity,
    state: task.state,
    sketch,
    status: null,
    path,
    files: task.files,
    names: task.names ?? [],
    workable: !sketch && task.state !== 'done' && (status === null || !RESTING.has(status)),
    children: []
  }
}

const round = (
  key: string,
  source: WorkflowTreeNode['source'],
  title: string,
  maturity: number | null,
  status: SpecStatus | null,
  path: string | null,
  children: Draft[]
): Draft => ({
  key,
  kind: 'round',
  source,
  title,
  maturity,
  state: null,
  sketch: false,
  status,
  path,
  files: [],
  names: [],
  workable: false,
  children
})

/** Une spec (D9) : rond complet (D10), ses tâches du socle en carrés, puis une user story par rond. */
function specRound(spec: SpecView): Draft {
  const tasksPath = `${spec.dir}/tasks.md`
  const task = (entry: TaskView, index: number): Draft =>
    square(`task:${spec.number}:${entry.id === '' ? index : entry.id}`, entry, 100, spec.status, tasksPath)
  return round(`spec:${spec.number}`, 'spec', spec.title, 100, spec.status, `${spec.dir}/spec.md`, [
    ...spec.socle.map(task),
    ...spec.stories.map((story) =>
      round(
        `story:${spec.number}:${story.number}`,
        'story',
        `US${story.number} — ${story.title}`,
        100,
        spec.status,
        null,
        story.tasks.map(task)
      )
    )
  ])
}

/** Un fichier de tâches (spec 023 D20) : ses cases d'avant le premier lot, puis ses lots et groupes en ronds. */
function fileRound(file: TaskFileView, maturity: number | null): Draft {
  const task = (entry: TaskView, index: number): Draft =>
    square(`ftask:${entry.key ?? `${file.key}-${index}`}`, entry, maturity, file.status, file.path)
  const group = (lot: TaskGroupView): Draft =>
    round(`lot:${lot.key}`, 'lot', lot.title, maturity, lot.status, null, [
      ...lot.tasks.map(task),
      ...lot.groups.map(group)
    ])
  return round(`file:${file.key}`, 'taskFile', file.title, maturity, file.status, file.path, [
    ...file.tasks.map(task),
    ...file.lots.map(group)
  ])
}

/**
 * Parent d'un document (D9) : celui de son en-tête s'il existe et ne forme pas de boucle ; `null` : niveau 1 (absent,
 * introuvable, ou le document du projet).
 */
function docParents(docs: readonly BrainstormDocView[]): Map<string, string | null> {
  const names = new Set(docs.map((doc) => doc.name))
  const declared = new Map(docs.map((doc) => [doc.name, doc.parent] as const))
  const parents = new Map<string, string | null>()
  for (const doc of docs) {
    const parent = doc.parent
    if (parent === null || parent === FOUNDATION_DOC || !names.has(parent)) {
      parents.set(doc.name, null)
      continue
    }
    // Une boucle (A → B → A) : le document remonte au niveau 1.
    const seen = new Set([doc.name])
    let cursor: string | null = parent
    while (cursor !== null && !seen.has(cursor)) {
      seen.add(cursor)
      cursor = declared.get(cursor) ?? null
    }
    parents.set(doc.name, cursor === null ? parent : null)
  }
  return parents
}

/**
 * Parent d'une spec : son `**Parent**` s'il existe, sinon le document de plus bas niveau qu'elle cite, hors projet ;
 * `null` : niveau 1.
 */
function specParent(spec: SpecView, docs: ReadonlyMap<string, BrainstormDocView>): string | null {
  if (spec.parentDoc !== null && docs.has(spec.parentDoc)) {
    return spec.parentDoc === FOUNDATION_DOC ? null : spec.parentDoc
  }
  const cited = spec.citedDocs
    .map((name) => docs.get(name))
    .filter((doc): doc is BrainstormDocView => doc !== undefined && doc.name !== FOUNDATION_DOC)
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  return cited[0]?.name ?? null
}

/** Au dernier niveau, un rond garde tous ses carrés, à plat ; ses ronds intérieurs disparaissent. */
function squaresOf(draft: Draft): Draft[] {
  return draft.children.flatMap((child) => (child.kind === 'square' ? [child] : squaresOf(child)))
}

function finish(draft: Draft, depth: number): WorkflowTreeNode {
  const children = draft.kind === 'round' && depth >= TREE_DEPTH ? squaresOf(draft) : draft.children
  const done = children.map((child) => finish(child, depth + 1))
  const counts =
    draft.kind === 'square'
      ? { done: draft.state === 'done' ? 1 : 0, total: 1 }
      : done.reduce((sum, child) => ({ done: sum.done + child.done, total: sum.total + child.total }), {
          done: 0,
          total: 0
        })
  return {
    key: draft.key,
    kind: draft.kind,
    source: draft.source,
    title: draft.title,
    maturity: draft.maturity,
    state: draft.state,
    sketch: draft.sketch,
    status: draft.status,
    path: draft.path,
    files: draft.files,
    ...(draft.names.length > 0 ? { names: draft.names } : {}),
    ...counts,
    children: done
  }
}

/** Premier carré à implémenter dans l'ordre de l'arbre : un carré en cours avant un carré seulement prévu (D6). */
function nextSquare(drafts: readonly Draft[]): string | null {
  const order: Draft[] = []
  const walk = (draft: Draft): void => {
    if (draft.workable) order.push(draft)
    draft.children.forEach(walk)
  }
  drafts.forEach(walk)
  return (order.find((draft) => draft.state === 'doing') ?? order[0])?.key ?? null
}

/**
 * Arbre du Workflow (spec 032 FR-001) depuis ce qui a été lu dans les fichiers du projet : documents de brainstorm
 * (ronds, rangés par leur `**Parent**`), specs (rondes complètes, sous le document qu'elles citent), fichiers de tâches
 * (sous le rond qui les nomme, sinon au niveau 1). Mêmes fichiers, même arbre. Pur.
 */
export function workflowArbre(
  docs: readonly BrainstormDocView[],
  specs: readonly SpecView[],
  taskFiles: readonly TaskFileView[]
): WorkflowTreeView {
  const byName = new Map(docs.map((doc) => [doc.name, doc] as const))
  const parents = docParents(docs)
  const maturityOf = (doc: BrainstormDocView): number | null =>
    doc.maturity === null ? null : MATURITY_PERCENT[doc.maturity]
  // Fichier de tâches → le premier document qui le nomme (par ordre de nom).
  const fileOwner = new Map<string, string>()
  for (const doc of [...docs].sort((a, b) => a.name.localeCompare(b.name))) {
    for (const path of doc.taskPaths) if (!fileOwner.has(path)) fileOwner.set(path, doc.name)
  }

  const childrenOf = new Map<string | null, Draft[]>()
  const attach = (parent: string | null, draft: Draft): void => {
    childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), draft])
  }
  for (const spec of specs) attach(specParent(spec, byName), specRound(spec))
  for (const file of taskFiles) {
    const owner = fileOwner.get(file.path)
    const ownerDoc = owner === undefined ? undefined : byName.get(owner)
    attach(
      owner === FOUNDATION_DOC ? null : (owner ?? null),
      fileRound(file, ownerDoc === undefined ? 100 : maturityOf(ownerDoc))
    )
  }

  const docDraft = (doc: BrainstormDocView): Draft => {
    const subDocs = docs.filter((other) => parents.get(other.name) === doc.name).map(docDraft)
    return round(docKey(doc.name), 'doc', doc.title, maturityOf(doc), null, `docs/brainstorm/${doc.name}`, [
      ...subDocs,
      ...(childrenOf.get(doc.name) ?? [])
    ])
  }
  const top = [
    ...docs.filter((doc) => doc.name !== FOUNDATION_DOC && parents.get(doc.name) === null).map(docDraft),
    ...(childrenOf.get(null) ?? [])
  ]
  const nodes = top.map((draft) => finish(draft, 1))
  const foundation = byName.get(FOUNDATION_DOC)
  return {
    project: {
      maturity: foundation === undefined ? null : maturityOf(foundation),
      done: nodes.reduce((sum, node) => sum + node.done, 0),
      total: nodes.reduce((sum, node) => sum + node.total, 0)
    },
    nodes,
    next: nextSquare(top)
  }
}
