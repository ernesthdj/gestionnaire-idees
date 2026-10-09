import { describe, expect, it } from 'vitest'
import type { SpecView, StoryView, TaskView, WorkflowView } from '@shared/ipc/workflow'
import { workflowGraph } from '../../../src/renderer/src/canvas/workflow/workflowGraph'
import { workflowKey, workflowTree } from '../../../src/renderer/src/canvas/workflow/workflowTree'

const G = '00000000-0000-4000-8000-0000000000a1'

const task = (id: string, done: boolean, story: number | null): TaskView => ({
  id,
  done,
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
    described: number !== 9,
    tasks,
    done,
    total: tasks.length,
    delivered: tasks.length > 0 && done === tasks.length,
    files: []
  }
}
const spec = (number: string, status: SpecView['status'], stories: StoryView[], socle: TaskView[] = []): SpecView => {
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
    citedDocs: [],
    partial: false
  }
}
const view = (specs: SpecView[], folded: Record<string, boolean> = {}): WorkflowView => ({
  genesisId: G,
  foundation: null,
  specs,
  brainstorm: [
    { name: 'L1j-carte.md', level: 1, title: 'Carte', family: null, coveredBy: [] },
    { name: 'L1f-reprise.md', level: 1, title: 'Reprise', family: null, coveredBy: ['017'] },
    { name: 'L2-carte-ecran.md', level: 2, title: 'Écran', family: 'L1j-carte.md', coveredBy: [] }
  ],
  folded,
  empty: false,
  readAt: '2026-10-09T10:00:00.000Z',
  missingFiles: []
})

const SPECS = [
  spec(
    '017',
    'active',
    [story(1, [task('T001', true, 1)]), story(2, [task('T002', true, 2), task('T003', false, 2)])],
    [task('T000', true, null), task('T010', false, null)]
  ),
  spec('021', 'planned', [story(1, [task('T001', false, 1)])]),
  spec('020', 'delivered', [story(1, [task('T001', true, 1)])]),
  spec('022', 'active', [story(9, [task('T040', false, 9)])])
]

describe('workflowTree', () => {
  it('should_group_specs_under_status_branches_with_counts_when_the_view_is_read', () => {
    const tree = workflowTree({ view: view(SPECS) }, G)
    const top = tree.items.filter((item) => item.parentKey === G).map((item) => item.title)
    expect(top).toEqual(['En cours (2)', 'À venir (1)', 'Livrées (1)', 'À brainstormer (1)'])
    const active = tree.items.find((item) => item.key === workflowKey(G, 'spec', '017'))
    expect(active).toMatchObject({ status: 'doing', progress: { done: 3, total: 5 }, collapsed: false })
    expect(active?.label).toBe('Spec 017 Spec 017, en cours, 3 sur 5 tâches')
  })

  it('should_show_only_remaining_tasks_and_fold_delivered_stories_socle_upcoming_and_delivered_by_default', () => {
    const tree = workflowTree({ view: view(SPECS) }, G)
    const visible = new Set(tree.visible.map((item) => item.key))
    expect(visible.has(workflowKey(G, 'task', '017', 'T003'))).toBe(true)
    expect(tree.items.some((item) => item.key === workflowKey(G, 'task', '017', 'T002'))).toBe(false)
    expect(tree.items.find((item) => item.key === workflowKey(G, 'story', '017', '1'))).toMatchObject({
      status: 'done',
      descendants: 0
    })
    expect(tree.items.find((item) => item.key === workflowKey(G, 'socle', '017'))).toMatchObject({
      collapsed: true,
      descendants: 1
    })
    expect(visible.has(workflowKey(G, 'task', '017', 'T010'))).toBe(false)
    expect(visible.has(workflowKey(G, 'spec', '021'))).toBe(true)
    expect(visible.has(workflowKey(G, 'story', '021', '1'))).toBe(false)
    expect(visible.has(workflowKey(G, 'spec', '020'))).toBe(false)
  })

  it('should_apply_remembered_folds_when_mentalyas_changed_the_defaults', () => {
    const tree = workflowTree(
      {
        view: view(SPECS, {
          [workflowKey(G, 'branch', 'delivered')]: false,
          [workflowKey(G, 'spec', '017')]: true
        })
      },
      G
    )
    const visible = new Set(tree.visible.map((item) => item.key))
    expect(visible.has(workflowKey(G, 'spec', '020'))).toBe(true)
    expect(visible.has(workflowKey(G, 'story', '017', '2'))).toBe(false)
  })

  it('should_name_an_undescribed_story_and_list_ideas_to_brainstorm_with_their_family', () => {
    const tree = workflowTree({ view: view(SPECS) }, G)
    expect(tree.items.find((item) => item.key === workflowKey(G, 'story', '022', '9'))?.title).toBe(
      'US9 · (user story non décrite)'
    )
    const idea = tree.items.find((item) => item.key === workflowKey(G, 'doc', 'L1j-carte'))
    expect(idea?.subject).toMatchObject({ kind: 'doc', family: [{ name: 'L2-carte-ecran.md' }] })
    expect(tree.items.some((item) => item.key === workflowKey(G, 'doc', 'L1f-reprise'))).toBe(false)
  })

  it('should_show_a_single_message_when_the_project_is_empty_or_unreadable', () => {
    const empty = workflowTree({ view: { ...view([]), brainstorm: [], empty: true } }, G)
    expect(empty.visible.map((item) => item.subject.kind)).toEqual(['message'])
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
    const tree = workflowTree({ view: view(SPECS, { [workflowKey(G, 'branch', 'delivered')]: false }) }, G)
    const graph = workflowGraph(tree, G, { x: 0, y: 0 }, 60)
    expect(graph.placed).toHaveLength(tree.visible.length)
    expect(overlaps(graph.placed)).toBe(false)
    expect(Math.min(...graph.placed.map((entry) => entry.y))).toBeGreaterThan(60)
    expect(graph.edges.find((edge) => edge.target === workflowKey(G, 'branch', 'active'))?.source).toBe(G)
    const branchColor = graph.placed.find((entry) => entry.item.key === workflowKey(G, 'branch', 'active'))?.visual
      .branch
    expect(graph.placed.find((entry) => entry.item.key === workflowKey(G, 'task', '017', 'T003'))?.visual.branch).toBe(
      branchColor
    )
  })

  it('should_shrink_the_map_when_a_node_is_folded_and_go_right_when_transposed', () => {
    const open = workflowGraph(workflowTree({ view: view(SPECS) }, G), G, { x: 0, y: 0 }, 60)
    const folded = workflowGraph(
      workflowTree({ view: view(SPECS, { [workflowKey(G, 'branch', 'active')]: true }) }, G),
      G,
      { x: 0, y: 0 },
      60
    )
    expect(folded.placed.length).toBeLessThan(open.placed.length)
    const transposed = workflowGraph(workflowTree({ view: view(SPECS) }, G), G, { x: 0, y: 0 }, 60, true)
    expect(Math.min(...transposed.placed.map((entry) => entry.x))).toBeGreaterThan(60)
  })
})
