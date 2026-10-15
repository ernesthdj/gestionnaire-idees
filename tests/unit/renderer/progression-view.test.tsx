import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { useSidePanel } from '../../../src/renderer/src/canvas/side/sidePanelStore'
import { ProgressionView } from '../../../src/renderer/src/canvas/progression/ProgressionView'
import type { ExplorerMapView, MapFileView, RepriseProjectView } from '../../../src/shared/ipc/reprise'
import type { BrainstormDocView, SpecView, TaskView, WorkflowView } from '../../../src/shared/ipc/workflow'
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
  files: [
    file('src/db/base.ts'),
    file('src/db/theme.ts'),
    file('src/ui/dark.ts'),
    { ...file('src/db/README.md'), lang: 'other' }
  ],
  calls: [],
  truncated: false,
  confidentiality: 'local',
  folderMissing: false
}
const PROJECT = { genesisId: G, name: 'demo', architecture: null } as unknown as RepriseProjectView

const wrap = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ProgressionView genesisId={G} name="demo" />
    </QueryClientProvider>
  )

describe('Progression en trois lectures (spec 032 D12, D13, Q6)', () => {
  beforeEach(() => useUiStore.setState({ structureViews: {}, progressionReadings: {} }))

  it('should_draw_the_project_then_one_branch_per_workflow_family_and_off_plan_by_folder', async () => {
    installFakeApi({
      'workflow:read': () => WORKFLOW,
      'reprise:get': () => PROJECT,
      'explorer:map': () => MAP
    })
    const { container } = wrap()
    // Le code analysé arrive après la doc : le lot devient bâti, le hors plan apparaît.
    const strays = await screen.findByRole('region', { name: 'Hors plan' })
    const family = screen.getByRole('listitem', { name: '003 · Données' })
    expect(within(family).getByRole('listitem', { name: '003 · Données : bâti, 1 / 2 tâches' })).toBeTruthy()
    expect(screen.getByText('demo')).toBeTruthy()
    expect(within(strays).getByRole('listitem', { name: 'src/db : 1 fichier hors plan' })).toBeTruthy()
    expect(within(strays).getByRole('listitem', { name: 'src/ui : 1 fichier hors plan' })).toBeTruthy()
    expect(screen.getByText('1 lot bâti · 0 prévu · 2 fichiers hors plan')).toBeTruthy()
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
    await screen.findByRole('listitem', { name: '003 · Données' })
    await user.click(screen.getByRole('button', { name: 'C · Les lots du Workflow' }))
    expect(useUiStore.getState().progressionReadings[G]).toBe('lots')
    expect(screen.getByText('▶ En cours')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Prévu' }))
    expect(screen.queryByRole('region', { name: 'Hors plan' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'B · Le chantier par étages' }))
    expect(screen.getByRole('listitem', { name: 'Fondations : 003 · Données' })).toBeTruthy()
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
    expect(await screen.findByText('0 lot bâti · 1 prévu')).toBeTruthy()
  })

  it('should_fold_finished_families_into_built_as_first_branch_and_foundations', async () => {
    const user = userEvent.setup()
    const done: SpecView = { ...SPEC, number: '001', dir: 'specs/001-socle', title: 'Socle', status: 'delivered' }
    const tree = workflowArbre([], [done, SPEC], [])
    installFakeApi({
      'workflow:read': () => ({ ...WORKFLOW, specs: [done, SPEC], tree }),
      'reprise:get': () => PROJECT,
      'explorer:map': () => MAP
    })
    const { container } = wrap()
    // A : la spec livrée rejoint la branche « Bâti », repliée ; la spec en cours garde sa branche.
    const built = await screen.findByRole('listitem', { name: 'Bâti' })
    expect(within(built).getByText('1 famille terminée · 1 / 2 tâches')).toBeTruthy()
    expect(screen.queryByRole('listitem', { name: '001 · Socle' })).toBeNull()
    expect(screen.getByRole('listitem', { name: '003 · Données' })).toBeTruthy()
    await user.click(within(built).getByText('Voir la famille'))
    expect(within(built).getByRole('listitem', { name: '001 · Socle : ✔ Livrée, 1 / 2 tâches' })).toBeTruthy()
    // B : le bâti en fondations, la famille ouverte au-dessus.
    await user.click(screen.getByRole('button', { name: 'B · Le chantier par étages' }))
    expect(screen.getByRole('listitem', { name: 'Fondations : Bâti' })).toBeTruthy()
    expect(screen.getByRole('listitem', { name: 'Étage 1 : 003 · Données' })).toBeTruthy()
    await expectNoAxeViolations(container)
  })

  it('should_go_to_the_workflow_on_a_click_unfolding_what_hides_the_round_and_highlighting_it', async () => {
    const user = userEvent.setup()
    const folds: unknown[] = []
    installFakeApi({
      'workflow:read': () => ({ ...WORKFLOW, folded: { [`wf:${G}:spec:003`]: true } }),
      'workflow:setFolded': (payload) => {
        folds.push(payload)
        return null
      },
      'reprise:get': () => PROJECT,
      'explorer:map': () => MAP
    })
    wrap()
    await user.click(await screen.findByRole('button', { name: 'Voir « 003 · Données » dans le Workflow' }))
    expect(folds).toEqual([{ genesisId: G, key: `wf:${G}:spec:003`, folded: false }])
    expect(useSidePanel.getState().focus?.nodeId).toBe(`wf:${G}:spec:003`)
    expect(useUiStore.getState().workflowArrival?.key).toBe(`wf:${G}:spec:003`)
  })

  it('should_gather_families_set_aside_into_later', async () => {
    const later: BrainstormDocView = {
      name: 'L1z-capture.md',
      level: 1,
      title: 'Capture rapide',
      family: null,
      coveredBy: [],
      parent: null,
      maturity: 'insuffisant',
      taskPaths: [],
      later: true
    }
    installFakeApi({
      'workflow:read': () => ({ ...WORKFLOW, brainstorm: [later], tree: workflowArbre([later], [SPEC], []) }),
      'reprise:get': () => PROJECT,
      'explorer:map': () => MAP
    })
    const { container } = wrap()
    const group = await screen.findByRole('listitem', { name: 'Plus tard' })
    expect(within(group).getByText('1 famille à brainstormer plus tard')).toBeTruthy()
    expect(screen.queryByRole('listitem', { name: 'Capture rapide' })).toBeNull()
    await expectNoAxeViolations(container)
  })
})
