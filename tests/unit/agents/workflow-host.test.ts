import { describe, expect, it } from 'vitest'
import { isWorkflowHost, workflowHost, workflowHostGenesis } from '../../../src/main/application/agents/workflowHost'
import type { TaskView, WorkflowView } from '../../../src/shared/ipc/workflow'

const G = '22222222-2222-4222-8222-222222222222'

const task = (id: string, text: string, files: string[] = [], key?: string): TaskView => ({
  id,
  done: false,
  state: 'todo',
  ...(key === undefined ? {} : { key }),
  story: null,
  text,
  files
})

/** Vue minimale : un document de brainstorm, son fichier de tâches (un lot, deux tâches) et une spec. */
const view = {
  genesisId: G,
  brainstorm: [
    {
      name: 'L1p-taches-visuelles.md',
      path: 'docs/brainstorm/L1p-taches-visuelles.md',
      level: 1,
      title: 'Tâches visuelles',
      family: null,
      coveredBy: [],
      parent: null,
      maturity: 'suffisant',
      taskPaths: ['docs/TACHES-VISUEL.md']
    }
  ],
  taskFiles: [
    {
      key: 'visuel',
      path: 'docs/TACHES-VISUEL.md',
      title: 'Tâches — visuel',
      tasks: [],
      lots: [
        {
          key: 'visuel-lot1',
          title: 'Lot 1',
          tasks: [
            task('T001', 'Étiquette [visuel]', ['src/a.ts'], 'visuel-t001'),
            task('T002', 'Forme', [], 'visuel-t002')
          ],
          groups: [],
          done: 0,
          total: 2,
          status: 'active'
        }
      ],
      done: 0,
      total: 2,
      status: 'active',
      partial: false
    }
  ],
  specs: [
    {
      number: '014',
      dir: 'specs/014-modes',
      title: 'Modes',
      stories: [],
      socle: [task('T010', 'Profils', ['src/p.ts'])]
    }
  ]
} as unknown as WorkflowView

describe('nœud du Workflow qui accueille des agents (L1o D14)', () => {
  it('should_recognize_only_workflow_node_keys_when_checking_a_host', () => {
    expect(isWorkflowHost(`wf:${G}:ttask:visuel-t001`)).toBe(true)
    expect(isWorkflowHost(`wf:${G}:message:empty`)).toBe(false)
    expect(isWorkflowHost(G)).toBe(false)
    expect(workflowHostGenesis(`wf:${G}:doc:L1p-taches-visuelles`)).toBe(G)
    expect(workflowHostGenesis('agent:x')).toBeNull()
  })

  it('should_give_the_task_its_cited_files_and_source_documents_when_the_host_is_a_task', () => {
    const host = workflowHost(view, `wf:${G}:ttask:visuel-t001`)
    expect(host).toMatchObject({ genesisId: G, kind: 'tâche', title: 'T001 · Étiquette [visuel]' })
    expect(host?.content).toContain('- T001 Étiquette [visuel] (à faire)')
    expect(host?.content).toContain('- src/a.ts')
    expect(host?.content).toContain('- docs/TACHES-VISUEL.md')
    expect(host?.content).toContain('- docs/brainstorm/L1p-taches-visuelles.md')
  })

  it('should_list_every_task_of_a_lot_and_point_to_the_document_when_the_host_is_a_lot_or_a_doc', () => {
    expect(workflowHost(view, `wf:${G}:tgroup:visuel-lot1`)?.content).toContain('- T002 Forme (à faire)')
    const doc = workflowHost(view, `wf:${G}:doc:L1p-taches-visuelles`)
    expect(doc).toMatchObject({ kind: 'brainstorm', title: 'Tâches visuelles' })
    expect(doc?.content).toContain('docs/brainstorm/L1p-taches-visuelles.md')
  })

  it('should_read_a_spec_task_from_its_spec_when_the_host_is_a_spec_task', () => {
    const host = workflowHost(view, `wf:${G}:task:014:T010`)
    expect(host).toMatchObject({ kind: 'tâche', title: 'T010 · Profils' })
    expect(host?.content).toContain('- specs/014-modes/tasks.md')
  })

  it('should_give_nothing_when_the_node_left_the_files_or_belongs_to_another_project', () => {
    expect(workflowHost(view, `wf:${G}:ttask:disparue`)).toBeUndefined()
    expect(workflowHost(view, `wf:33333333-3333-4333-8333-333333333333:ttask:visuel-t001`)).toBeUndefined()
  })
})
