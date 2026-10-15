import { describe, expect, it } from 'vitest'
import type { BrainstormDocView, SpecView, TaskFileView, TaskView } from '../../src/shared/ipc/workflow'
import { workflowArbre } from '../../src/shared/workflow/arbre'
import { progressionOf, type ProgressionCode } from '../../src/shared/workflow/progression'

const task = (id: string, done: boolean, story: number | null, files: string[]): TaskView => ({
  id,
  done,
  state: done ? 'done' : 'todo',
  story,
  text: id,
  files
})
const spec = (number: string, socle: TaskView[], stories: { n: number; title: string; tasks: TaskView[] }[]) => {
  const all = [...socle, ...stories.flatMap((entry) => entry.tasks)]
  return {
    number,
    dir: `specs/${number}-x`,
    title: `Spec ${number}`,
    statusLine: null,
    marker: null,
    status: 'active',
    createdAt: null,
    decisions: 0,
    socle,
    stories: stories.map((entry) => ({
      number: entry.n,
      title: entry.title,
      priority: null,
      described: true,
      tasks: entry.tasks,
      done: entry.tasks.filter((t) => t.done).length,
      total: entry.tasks.length,
      delivered: false,
      files: []
    })),
    done: all.filter((t) => t.done).length,
    total: all.length,
    leftovers: [],
    citedDocs: [],
    parentDoc: null,
    partial: false
  } satisfies SpecView
}
const doc = (name: string, title: string): BrainstormDocView => ({
  name,
  level: 1,
  title,
  family: null,
  coveredBy: [],
  parent: null,
  maturity: null,
  taskPaths: []
})
const lotFile: TaskFileView = {
  key: 'fr',
  path: 'docs/TACHES-RECHERCHE.md',
  title: 'Recherche',
  tasks: [],
  lots: [
    {
      key: 'fr-l1',
      title: 'Index',
      tasks: [{ ...task('', false, null, ['src/search/index.ts']), key: 'fr-l1-t1' }],
      groups: [],
      done: 0,
      total: 1,
      status: 'planned'
    }
  ],
  done: 0,
  total: 1,
  status: 'planned',
  partial: false
}

const SPECS = [
  spec(
    '003',
    [task('T001', true, null, ['src/db/'])],
    [
      { n: 1, title: 'Sauvegarde', tasks: [task('T002', true, 1, ['src/db/backup.ts']), task('T003', false, 1, [])] },
      { n: 2, title: 'Chiffrement', tasks: [task('T004', false, 2, ['src/db/crypto.ts'])] }
    ]
  ),
  { ...spec('004', [task('T001', false, null, ['src/app/main.ts'])], []), parentDoc: 'L1a-application.md' },
  { ...spec('005', [task('T001', false, null, ['src/sync/'])], []), status: 'delivered' as const }
]
const CODE: ProgressionCode = {
  files: [
    { path: 'src/db/base.ts', plumbing: false },
    { path: 'src/db/backup.ts', plumbing: false },
    { path: 'src/ui/theme.ts', plumbing: false },
    { path: 'src/ui/dark.ts', plumbing: false },
    { path: 'src/ui/log.ts', plumbing: true },
    { path: 'src/net/http.ts', plumbing: false }
  ]
}
const tree = workflowArbre([doc('L1-synchro.md', 'Synchronisation'), doc('L1a-application.md', 'Application')], SPECS, [
  lotFile
])

describe('progressionOf (spec 032 D12, D13, Q3, Q6)', () => {
  it('should_make_one_family_per_level_one_round_with_its_lots_in_tree_order', () => {
    const view = progressionOf(tree, CODE)
    expect(view.families.map((family) => [family.title, family.label, family.lots.map((lot) => lot.title)])).toEqual([
      ['Synchronisation', 'L1', ['Synchronisation']],
      ['Application', 'L1a', ['004 · Spec 004']],
      ['003 · Spec 003', 'spec 003', ['003 · Spec 003']],
      ['005 · Spec 005', 'spec 005', ['005 · Spec 005']],
      ['Recherche', 'TACHES-RECHERCHE', ['Recherche']]
    ])
    expect([view.done, view.total]).toEqual([2, 7])
  })

  it('should_call_a_lot_built_when_a_cited_file_or_folder_exists_or_when_it_is_delivered', () => {
    const view = progressionOf(tree, CODE)
    const kinds = Object.fromEntries(view.families.map((family) => [family.label, family.kind]))
    // Un dossier cité couvre ses fichiers ; une spec livrée est bâtie ; un document sans tâches est prévu.
    expect(kinds).toEqual({
      L1: 'prevu',
      L1a: 'prevu',
      'spec 003': 'reel',
      'spec 005': 'reel',
      'TACHES-RECHERCHE': 'prevu'
    })
    expect(view.families[2]?.lots[0]).toMatchObject({ source: 'spec', done: 2, total: 4 })
  })

  it('should_group_off_plan_files_by_folder_largest_first_without_plumbing', () => {
    const view = progressionOf(tree, CODE)
    expect(view.strays).toEqual([
      { path: 'src/ui', files: ['src/ui/theme.ts', 'src/ui/dark.ts'] },
      { path: 'src/net', files: ['src/net/http.ts'] }
    ])
    expect(view.strayCount).toBe(3)
  })

  it('should_only_trust_checked_boxes_when_the_code_is_not_analysed', () => {
    const view = progressionOf(tree, null)
    expect(view.analysed).toBe(false)
    expect(view.strays).toEqual([])
    expect(view.families.map((family) => family.kind)).toEqual(['prevu', 'prevu', 'prevu', 'reel', 'prevu'])
  })

  it('should_cover_a_file_by_its_name_and_never_count_tests_when_a_task_cites_it_without_a_path', () => {
    const named: TaskView = { ...task('T1', false, null, []), names: ['WindowManager'] }
    const view = progressionOf(workflowArbre([], [spec('009', [named], [])], []), {
      files: [
        { path: 'src/main/shell/WindowManager.ts', plumbing: false },
        { path: 'src/main/shell/TrayController.ts', plumbing: false },
        { path: 'tests/unit/shell.test.ts', plumbing: false },
        { path: 'src/main/shell/tray.spec.ts', plumbing: false }
      ]
    })
    // Le nom cité couvre le fichier et bâtit le lot ; les tests ne sont jamais hors plan.
    expect(view.families[0]?.kind).toBe('reel')
    expect(view.strays).toEqual([{ path: 'src/main/shell', files: ['src/main/shell/TrayController.ts'] }])
  })

  it('should_mark_a_family_finished_when_each_lot_is_delivered_abandoned_or_checked_and_keep_doc_maturity', () => {
    const mature: BrainstormDocView = { ...doc('L1-synchro.md', 'Synchronisation'), maturity: 'complet' }
    const view = progressionOf(
      workflowArbre([mature, doc('L1a-application.md', 'Application')], SPECS, [lotFile]),
      CODE
    )
    const finished = Object.fromEntries(view.families.map((family) => [family.label, family.finished]))
    // Seule la spec livrée est terminée ; une spec en cours, un fichier de tâches ouvert, un document ne le sont pas.
    expect(finished).toEqual({
      L1: false,
      L1a: false,
      'spec 003': false,
      'spec 005': true,
      'TACHES-RECHERCHE': false
    })
    expect(view.families[0]?.lots[0]?.maturity).toBe(100)
  })
})
