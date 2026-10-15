import { describe, expect, it } from 'vitest'
import type {
  BrainstormDocView,
  SpecStatus,
  SpecView,
  StoryView,
  TaskFileView,
  TaskGroupView,
  TaskView,
  WorkflowView
} from '@shared/ipc/workflow'
import { workflowArbre } from '../../../src/shared/workflow/arbre'
import { workflowGraph } from '../../../src/renderer/src/canvas/workflow/workflowGraph'
import { promptFor } from '../../../src/renderer/src/canvas/workflow/prompts'
import { workflowKey, workflowTree } from '../../../src/renderer/src/canvas/workflow/workflowTree'

const G = '00000000-0000-4000-8000-0000000000a1'

const task = (id: string, state: TaskView['state'], story: number | null): TaskView => ({
  id,
  done: state === 'done',
  state,
  story,
  text: `Faire ${id} dans \`src/${id}.ts\``,
  files: []
})
const story = (number: number, tasks: TaskView[]): StoryView => {
  const done = tasks.filter((entry) => entry.done).length
  return {
    number,
    title: `Histoire ${number}`,
    priority: number,
    described: true,
    tasks,
    done,
    total: tasks.length,
    delivered: tasks.length > 0 && done === tasks.length,
    files: []
  }
}
const spec = (
  number: string,
  status: SpecStatus,
  stories: StoryView[],
  socle: TaskView[] = [],
  citedDocs: string[] = []
): SpecView => {
  const all = [...socle, ...stories.flatMap((entry) => entry.tasks)]
  return {
    number,
    dir: `specs/${number}-x`,
    title: `Spec ${number}`,
    statusLine: null,
    marker: null,
    status,
    createdAt: null,
    decisions: 0,
    stories,
    socle,
    done: all.filter((entry) => entry.done).length,
    total: all.length,
    leftovers: [],
    citedDocs,
    parentDoc: null,
    partial: false
  }
}
const doc = (name: string, title: string, extra: Partial<BrainstormDocView> = {}): BrainstormDocView => ({
  name,
  level: Number(name[1]),
  title,
  family: null,
  coveredBy: [],
  parent: null,
  maturity: 'complet',
  taskPaths: [],
  ...extra
})
/** Une vue lue comme le main la lit : l'arbre est assemblé par la vraie fonction du main (spec 032 FR-001). */
const view = (
  specs: SpecView[],
  docs: BrainstormDocView[],
  taskFiles: TaskFileView[] = [],
  folded: Record<string, boolean> = {}
): WorkflowView => ({
  genesisId: G,
  foundation: null,
  specs,
  brainstorm: docs,
  folded,
  empty: false,
  readAt: '2026-10-14T10:00:00.000Z',
  taskFiles,
  missingFiles: [],
  tree: workflowArbre(docs, specs, taskFiles)
})

const SPECS = [
  spec(
    '017',
    'active',
    [story(1, [task('T001', 'done', 1)]), story(2, [task('T002', 'done', 2), task('T003', 'doing', 2)])],
    [task('T000', 'done', null)],
    ['L1f-reprise.md']
  ),
  spec('020', 'delivered', [story(1, [task('T001', 'done', 1)])])
]
const DOCS = [
  doc('L1f-reprise.md', 'Reprise'),
  doc('L1j-carte.md', 'Carte', { maturity: 'suffisant' }),
  doc('L2-carte-ecran.md', 'Écran', { family: 'L1j-carte.md', parent: 'L1j-carte.md', maturity: null })
]

describe('workflowTree (spec 032)', () => {
  it('should_turn_the_tree_into_rounds_and_squares_and_keep_the_keys_of_spec_023', () => {
    const tree = workflowTree({ view: view(SPECS, DOCS) }, G)
    const top = tree.items.filter((item) => item.parentKey === G)
    expect(top.map((item) => [item.title, item.shape])).toEqual([
      ['Reprise', 'round'],
      ['Carte', 'round'],
      ['020 · Spec 020', 'round']
    ])
    const reprise = workflowKey(G, 'doc', 'L1f-reprise')
    expect(tree.items.find((item) => item.parentKey === reprise)?.key).toBe(workflowKey(G, 'spec', '017'))
    // Les clés de la spec 023 restent : les conversations déjà ouvertes sur une tâche se retrouvent.
    expect(tree.items.find((item) => item.key === workflowKey(G, 'task', '017', 'T003'))).toMatchObject({
      shape: 'square',
      status: 'doing',
      next: true,
      title: 'T003 · Faire T003 dans src/T003.ts',
      label: 'Carré T003 · Faire T003 dans src/T003.ts, en cours, bosser ici',
      subject: { kind: 'task', story: { number: 2 } }
    })
    expect(tree.items.find((item) => item.key === workflowKey(G, 'spec', '017'))).toMatchObject({
      maturity: 100,
      progress: { done: 3, total: 4 },
      label: 'Rond 017 · Spec 017, brainstorm 100 %, 3 sur 4 tâches'
    })
    expect(tree.items.find((item) => item.key === workflowKey(G, 'doc', 'L2-carte-ecran'))?.label).toBe(
      'Rond Écran, brainstorm non évalué'
    )
  })

  it('should_fold_the_rounds_where_everything_is_done_unless_mentalyas_opened_them', () => {
    const tree = workflowTree({ view: view(SPECS, DOCS) }, G)
    const visible = new Set(tree.visible.map((item) => item.key))
    expect(tree.items.find((item) => item.key === workflowKey(G, 'spec', '020'))?.collapsed).toBe(true)
    expect(visible.has(workflowKey(G, 'task', '020', 'T001'))).toBe(false)
    expect(visible.has(workflowKey(G, 'story', '017', '1'))).toBe(true)
    expect(visible.has(workflowKey(G, 'task', '017', 'T001'))).toBe(false)
    const opened = workflowTree({ view: view(SPECS, DOCS, [], { [workflowKey(G, 'spec', '020')]: false }) }, G)
    // Ouvert par mentalyas : ses ronds apparaissent (eux-mêmes repliés tant qu'il ne les ouvre pas).
    expect(opened.visible.some((item) => item.key === workflowKey(G, 'story', '020', '1'))).toBe(true)
  })

  it('should_draw_a_task_file_under_its_round_as_sketches_while_the_brainstorm_is_not_complete', () => {
    const fileTask = (key: string, text: string, state: TaskView['state']): TaskView => ({
      id: '',
      key,
      done: state === 'done',
      state,
      story: null,
      text,
      files: []
    })
    const group = (key: string, title: string, tasks: TaskView[], groups: TaskGroupView[] = []): TaskGroupView => {
      const all = [...tasks, ...groups.flatMap((entry) => entry.tasks)]
      const done = all.filter((t) => t.done).length
      return { key, title, tasks, groups, status: 'active', done, total: all.length }
    }
    const lot = group(
      'fa-l1',
      'Auth',
      [],
      [group('fa-l1-g1', 'Inscription', [fileTask('fa-l1-g1-t2', 'Hachage', 'doing')])]
    )
    const file: TaskFileView = {
      key: 'fa',
      path: 'docs/TACHES-CARTE.md',
      title: 'Tâches — Carte',
      tasks: [],
      lots: [lot],
      done: 0,
      total: 1,
      status: 'active',
      partial: false
    }
    const docs = DOCS.map((entry) =>
      entry.name === 'L1j-carte.md' ? { ...entry, taskPaths: ['docs/TACHES-CARTE.md'] } : entry
    )
    const tree = workflowTree({ view: view([], docs, [file]) }, G)
    const carte = workflowKey(G, 'doc', 'L1j-carte')
    expect(tree.items.filter((item) => item.parentKey === carte).map((item) => item.key)).toEqual([
      workflowKey(G, 'doc', 'L2-carte-ecran'),
      workflowKey(G, 'tfile', 'fa')
    ])
    const hachage = tree.items.find((item) => item.key === workflowKey(G, 'ttask', 'fa-l1-g1-t2'))
    expect(hachage).toMatchObject({
      shape: 'square',
      sketch: true,
      next: false,
      parentKey: workflowKey(G, 'tgroup', 'fa-l1-g1'),
      subject: { kind: 'fileTask', group: { key: 'fa-l1-g1' } }
    })
    expect(hachage?.label).toContain('Ébauche')
    // Une ébauche ne s'implémente pas : sa consigne fait préciser la piste dans le brainstorm d'où elle vient (D7).
    const prompt = hachage === undefined ? null : promptFor(hachage)
    expect(prompt).toContain('La tâche « Hachage » est une ébauche : le brainstorm de docs/brainstorm/L1j-carte.md')
    expect(prompt).not.toContain('« - [~] »')
  })

  it('should_show_a_single_message_when_the_project_is_empty_or_unreadable', () => {
    const empty = workflowTree({ view: { ...view([], []), empty: true } }, G)
    expect(empty.visible.map((item) => item.subject.kind)).toEqual(['message'])
    expect(empty.visible[0]?.title).toContain('Nouveau brainstorm')
    const missing = workflowTree({ error: 'Le dossier de ce projet est introuvable.' }, G)
    expect(missing.visible[0]?.subject).toEqual({
      kind: 'message',
      text: 'Le dossier de ce projet est introuvable.',
      missing: true
    })
  })
})

describe('workflowGraph', () => {
  const overlaps = (placed: readonly { x: number; y: number; depth: number }[]): boolean =>
    placed.some((a, i) => placed.some((b, j) => j > i && Math.abs(a.x - b.x) < 100 && Math.abs(a.y - b.y) < 80))

  it('should_place_visible_nodes_below_the_genesis_without_overlap_and_link_each_to_its_parent', () => {
    const tree = workflowTree({ view: view(SPECS, DOCS) }, G)
    const graph = workflowGraph(tree, G, { x: 0, y: 0 }, 60)
    expect(graph.placed).toHaveLength(tree.visible.length)
    expect(overlaps(graph.placed)).toBe(false)
    expect(Math.min(...graph.placed.map((entry) => entry.y))).toBeGreaterThan(60)
    const reprise = workflowKey(G, 'doc', 'L1f-reprise')
    expect(graph.edges.find((edge) => edge.target === reprise)?.source).toBe(G)
    const color = graph.placed.find((entry) => entry.item.key === reprise)?.visual.branch
    expect(graph.placed.find((entry) => entry.item.key === workflowKey(G, 'task', '017', 'T003'))?.visual.branch).toBe(
      color
    )
  })

  it('should_shrink_the_map_when_a_node_is_folded_and_go_right_when_transposed', () => {
    const open = workflowGraph(workflowTree({ view: view(SPECS, DOCS) }, G), G, { x: 0, y: 0 }, 60)
    const folded = workflowGraph(
      workflowTree({ view: view(SPECS, DOCS, [], { [workflowKey(G, 'doc', 'L1f-reprise')]: true }) }, G),
      G,
      { x: 0, y: 0 },
      60
    )
    expect(folded.placed.length).toBeLessThan(open.placed.length)
    const transposed = workflowGraph(workflowTree({ view: view(SPECS, DOCS) }, G), G, { x: 0, y: 0 }, 60, true)
    expect(Math.min(...transposed.placed.map((entry) => entry.x))).toBeGreaterThan(60)
  })

  it('should_mark_an_abandoned_spec_round_so_the_map_shows_it_in_red', () => {
    const abandoned = spec('019', 'abandoned', [story(1, [task('T001', 'todo', 1)])])
    const tree = workflowTree({ view: view([...SPECS, abandoned], DOCS) }, G)
    expect(tree.items.find((item) => item.key === workflowKey(G, 'spec', '019'))?.abandoned).toBe(true)
    expect(tree.items.find((item) => item.key === workflowKey(G, 'spec', '017'))?.abandoned).toBeUndefined()
  })
})
