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
  )
]
const CODE: ProgressionCode = {
  modules: [
    { key: 'm:ui', title: 'ui', column: 0 },
    { key: 'm:db', title: 'db', column: 1 }
  ],
  files: [
    { path: 'src/db/base.ts', moduleKey: 'm:db', plumbing: false },
    { path: 'src/db/backup.ts', moduleKey: 'm:db', plumbing: false },
    { path: 'src/ui/theme.ts', moduleKey: 'm:ui', plumbing: false },
    { path: 'src/ui/log.ts', moduleKey: 'm:ui', plumbing: true }
  ]
}
const tree = workflowArbre([doc('L1-synchro.md', 'Synchronisation')], SPECS, [lotFile])

describe('progressionOf (spec 032 D12, D13, Q3)', () => {
  it('should_cut_the_workflow_into_lots_and_parts_in_tree_order', () => {
    const view = progressionOf(tree, CODE)
    expect(view.lots.map((lot) => [lot.title, lot.source, lot.parts.map((p) => p.title)])).toEqual([
      ['Synchronisation', 'doc', []],
      ['Spec 003', 'spec', ['Socle', 'US1 — Sauvegarde', 'US2 — Chiffrement']],
      ['Recherche', 'taskFile', ['Index']]
    ])
  })

  it('should_call_a_part_real_when_a_cited_file_or_folder_exists_in_the_code', () => {
    const parts = progressionOf(tree, CODE).lots.flatMap((lot) => lot.parts)
    const byTitle = (title: string) => parts.find((entry) => entry.title === title)
    // Un dossier cité couvre ses fichiers.
    expect(byTitle('Socle')).toMatchObject({
      kind: 'reel',
      moduleKey: 'm:db',
      files: ['src/db/base.ts', 'src/db/backup.ts']
    })
    expect(byTitle('US1 — Sauvegarde')).toMatchObject({ kind: 'reel', done: 1, total: 2 })
    // Fichier cité absent du code, rien de coché : prévu, sans module.
    expect(byTitle('US2 — Chiffrement')).toMatchObject({ kind: 'prevu', moduleKey: null, files: [] })
  })

  it('should_group_parts_by_module_then_planned_lots_and_flag_uncited_files_as_off_plan', () => {
    const view = progressionOf(tree, CODE)
    expect(view.groups.map((group) => [group.title, group.kind, group.done, group.total])).toEqual([
      ['ui', 'reel', 0, 0],
      ['db', 'reel', 2, 3],
      ['Synchronisation', 'prevu', 0, 0],
      ['Spec 003', 'prevu', 0, 1],
      ['Recherche', 'prevu', 0, 1]
    ])
    // La plomberie n'est jamais hors plan.
    expect(view.groups[0]?.strays).toEqual(['src/ui/theme.ts'])
    expect(view.strays).toBe(1)
  })

  it('should_only_trust_checked_boxes_when_the_code_is_not_analysed', () => {
    const view = progressionOf(tree, null)
    expect(view.analysed).toBe(false)
    expect(view.strays).toBe(0)
    expect(view.lots[1]?.parts.map((entry) => entry.kind)).toEqual(['reel', 'prevu', 'prevu'])
    expect(view.groups.every((group) => group.column === null)).toBe(true)
  })
})
