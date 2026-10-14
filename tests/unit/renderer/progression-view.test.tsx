import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { ProgressionView } from '../../../src/renderer/src/canvas/progression/ProgressionView'
import type { ExplorerMapView, MapFileView, RepriseProjectView } from '../../../src/shared/ipc/reprise'
import type { SpecView, TaskView, WorkflowView } from '../../../src/shared/ipc/workflow'
import { workflowArbre } from '../../../src/shared/workflow/arbre'
import { expectNoAxeViolations } from '../../support/axe'
import { FakeIpcError, installFakeApi } from './support/fakeApi'

const G = '00000000-0000-4000-8000-0000000000c1'

const task = (id: string, done: boolean, story: number, files: string[]): TaskView => ({
  id,
  done,
  state: done ? 'done' : 'todo',
  story,
  text: id,
  files
})
const story = (number: number, title: string, tasks: TaskView[]) => ({
  number,
  title,
  priority: null,
  described: true,
  tasks,
  done: tasks.filter((t) => t.done).length,
  total: tasks.length,
  delivered: false,
  files: []
})
const SPEC: SpecView = {
  number: '003',
  dir: 'specs/003-donnees',
  title: 'Données',
  statusLine: null,
  marker: null,
  status: 'active',
  createdAt: null,
  decisions: 0,
  socle: [],
  stories: [
    story(1, 'Base locale', [task('T001', true, 1, ['src/db/base.ts'])]),
    story(2, 'Chiffrement', [task('T002', false, 2, ['src/db/crypto.ts'])])
  ],
  done: 1,
  total: 2,
  leftovers: [],
  citedDocs: [],
  parentDoc: null,
  partial: false
}
const WORKFLOW: WorkflowView = {
  genesisId: G,
  foundation: null,
  specs: [SPEC],
  brainstorm: [],
  taskFiles: [],
  tree: workflowArbre([], [SPEC], []),
  folded: {},
  empty: false,
  missingFiles: [],
  readAt: '2026-10-14T10:00:00.000Z'
}
const file = (path: string): MapFileView => ({
  key: `f:${path}`,
  path,
  moduleKey: 'm:dir:src/db',
  title: path,
  folder: '',
  lang: 'ts',
  lines: 10,
  role: null,
  functions: [],
  depth: 0,
  external: false,
  plumbing: false
})
const MAP: ExplorerMapView = {
  modules: [
    { key: 'm:dir:src/db', title: 'db', layer: 'data', plumbing: false, role: null, column: 1, files: 2, lines: 20 }
  ],
  files: [file('src/db/base.ts'), file('src/db/theme.ts'), { ...file('src/db/README.md'), lang: 'other' }],
  calls: [],
  truncated: false,
  confidentiality: 'local',
  folderMissing: false
}
const PROJECT = { genesisId: G, name: 'demo', architecture: null } as unknown as RepriseProjectView

const wrap = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ProgressionView genesisId={G} />
    </QueryClientProvider>
  )

describe('Progression en trois lectures (spec 032 D12, D13)', () => {
  beforeEach(() => useUiStore.setState({ structureViews: {}, progressionReadings: {} }))

  it('should_show_the_module_tree_with_real_planned_and_off_plan_parts', async () => {
    installFakeApi({
      'workflow:read': () => WORKFLOW,
      'reprise:get': () => PROJECT,
      'explorer:map': () => MAP
    })
    const { container } = wrap()
    const db = await screen.findByRole('listitem', { name: 'db' })
    expect(within(db).getByRole('listitem', { name: 'US1 — Base locale : bâtie, 1 / 1 tâche' })).toBeTruthy()
    expect(within(db).getByRole('listitem', { name: /src\/db\/theme\.ts : hors plan/ })).toBeTruthy()
    // Le fichier cité n'existe pas encore : la partie est prévue, rangée sous sa spec.
    const planned = screen.getByRole('listitem', { name: 'Données' })
    expect(within(planned).getByRole('listitem', { name: 'US2 — Chiffrement : prévue, 0 / 1 tâche' })).toBeTruthy()
    expect(screen.getByText('1 partie bâtie · 1 prévue · 1 fichier hors plan')).toBeTruthy()
    await expectNoAxeViolations(container)
  })

  it('should_switch_readings_remember_them_per_project_and_filter_real_or_planned', async () => {
    const user = userEvent.setup()
    installFakeApi({
      'workflow:read': () => WORKFLOW,
      'reprise:get': () => PROJECT,
      'explorer:map': () => MAP
    })
    const { container } = wrap()
    await screen.findByRole('listitem', { name: 'db' })
    await user.click(screen.getByRole('button', { name: 'C · Les lots du Workflow' }))
    expect(useUiStore.getState().progressionReadings[G]).toBe('lots')
    expect(screen.getByText('▶ En cours')).toBeTruthy()
    expect(screen.getByRole('listitem', { name: 'Hors plan' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Réel' }))
    expect(screen.queryByRole('listitem', { name: /Chiffrement/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Prévu' }))
    expect(screen.queryByRole('listitem', { name: 'Hors plan' })).toBeNull()
    expect(screen.getByRole('listitem', { name: /Chiffrement/ })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'B · Le chantier par étages' }))
    expect(screen.getByRole('listitem', { name: 'Fondations : db' })).toBeTruthy()
    expect(screen.getByRole('listitem', { name: 'Étage 1 : Données' })).toBeTruthy()
    await expectNoAxeViolations(container)
  })

  it('should_offer_to_analyse_the_code_and_trust_only_checked_boxes_meanwhile', async () => {
    installFakeApi({
      'workflow:read': () => WORKFLOW,
      'reprise:get': () => {
        throw new FakeIpcError('NOT_FOUND')
      }
    })
    wrap()
    expect(await screen.findByText(/Le code n’est pas analysé/)).toBeTruthy()
    expect(await screen.findByText('1 partie bâtie · 1 prévue')).toBeTruthy()
  })
})
