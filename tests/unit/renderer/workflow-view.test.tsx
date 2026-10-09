import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { useCards } from '../../../src/renderer/src/canvas/cards/cardsStore'
import {
  buildGraph,
  computeLayout,
  type StructureBarNodeType,
  type WorkflowNodeType
} from '../../../src/renderer/src/canvas/buildGraph'
import { IdeasCanvas } from '../../../src/renderer/src/canvas/IdeasCanvas'
import { StructureBarNode } from '../../../src/renderer/src/canvas/nodes/StructureBarNode'
import { WorkflowNode } from '../../../src/renderer/src/canvas/workflow/WorkflowNode'
import { workflowKey } from '../../../src/renderer/src/canvas/workflow/workflowTree'
import { DEFAULT_APP_SETTINGS } from '../../../src/shared/ipc/app'
import type { ElementView, IdeasCanvasView } from '../../../src/shared/ipc/canvas'
import type { SpecView, TaskView, WorkflowView } from '../../../src/shared/ipc/workflow'
import { expectNoAxeViolations } from '../../support/axe'
import { canvasView, HATCHED_A_ID } from '../../fixtures/ui/canvas'
import { installFakeApi } from './support/fakeApi'
import { installReactFlowMocks } from './support/reactFlowMocks'

const G = HATCHED_A_ID

const task = (id: string, done: boolean, story: number | null): TaskView => ({ id, done, story, text: id, files: [] })
const spec = (number: string, status: SpecView['status'], tasks: TaskView[]): SpecView => {
  const done = tasks.filter((entry) => entry.done).length
  const own = (n: number) => tasks.filter((entry) => entry.story === n)
  return {
    number,
    dir: `specs/${number}-demo`,
    title: `Démo ${number}`,
    statusLine: null,
    marker: null,
    status,
    createdAt: null,
    decisions: 0,
    stories: [1, 2].map((n) => ({
      number: n,
      title: `Histoire ${n}`,
      priority: n,
      described: true,
      tasks: own(n),
      done: own(n).filter((entry) => entry.done).length,
      total: own(n).length,
      delivered: own(n).length > 0 && own(n).every((entry) => entry.done),
      files: []
    })),
    socle: [],
    done,
    total: tasks.length,
    leftovers: [],
    citedDocs: [],
    partial: false
  }
}
const WORKFLOW: WorkflowView = {
  genesisId: G,
  foundation: null,
  specs: [
    spec('001', 'active', [task('T001', true, 1), task('T002', true, 2), task('T003', false, 2)]),
    spec('002', 'planned', [task('T001', false, 1)])
  ],
  brainstorm: [],
  folded: {},
  empty: false,
  readAt: '2026-10-09T10:00:00.000Z',
  missingFiles: []
}
const element: ElementView = {
  id: 'module-core',
  genesisId: G,
  parentId: G,
  key: 'module-core',
  type: 'module',
  title: 'Cœur',
  status: null,
  summary: null,
  paths: [],
  collapsed: true,
  childCount: 0,
  order: null
}
const linkedView = (withMap = true): IdeasCanvasView => {
  const view = canvasView()
  return {
    ...view,
    ideas: view.ideas.map((idea) => (idea.id === G ? { ...idea, linkedProject: true } : idea)),
    elements: withMap ? [element] : []
  }
}

describe('vue Workflow sur la carte (spec 023 US1)', () => {
  beforeEach(() => useUiStore.setState({ structureViews: {} }))

  it('should_replace_the_structure_by_status_branches_when_the_genesis_is_switched_to_workflow', () => {
    const view = linkedView()
    const before = buildGraph(view, computeLayout(view))
    expect(before.nodes.some((node) => node.id === 'module-core')).toBe(true)
    expect(before.nodes.find((node) => node.type === 'structureBar')?.data).toMatchObject({
      view: 'progression',
      hasMap: true
    })
    const after = buildGraph(view, computeLayout(view), null, new Set(), { [G]: 'workflow' }, false, true, {
      [G]: { view: WORKFLOW }
    })
    expect(after.nodes.some((node) => node.id === 'module-core')).toBe(false)
    const labels = after.nodes.filter((node) => node.type === 'workflow').map((node) => node.ariaLabel)
    expect(labels).toEqual([
      'En cours : 1 spec',
      'Spec 001 Démo 001, en cours, 2 sur 3 tâches',
      'User story 1 (P1) Histoire 1, livrée',
      'User story 2 (P2) Histoire 2, 1 sur 2 tâches',
      'Tâche T003 à faire : T003',
      'À venir : 1 spec',
      'Spec 002 Démo 002, planifiée, 0 sur 1 tâches'
    ])
    expect(after.edges.find((edge) => edge.target === workflowKey(G, 'branch', 'active'))?.source).toBe(G)
    expect(after.nodes.find((node) => node.type === 'structureBar')?.data).toMatchObject({ view: 'workflow' })
  })

  it('should_offer_the_bar_without_a_drawn_map_and_only_for_linked_projects', () => {
    const view = linkedView(false)
    const bars = buildGraph(view, computeLayout(view)).nodes.filter((node) => node.type === 'structureBar')
    expect(bars.map((node) => node.data)).toEqual([
      expect.objectContaining({ genesisId: G, view: null, hasMap: false })
    ])
  })

  it('should_switch_to_workflow_and_reload_from_the_bar_with_structure_views_disabled_without_a_map', async () => {
    const user = userEvent.setup()
    installFakeApi({})
    const props = { data: { genesisId: G, view: null, hasMap: false, architecture: null } }
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <ReactFlowProvider>
          <StructureBarNode {...(props as unknown as NodeProps<StructureBarNodeType>)} />
        </ReactFlowProvider>
      </QueryClientProvider>
    )
    expect((screen.getByRole('button', { name: 'Progression' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('combobox', { name: 'Architecture' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Workflow' }))
    expect(useUiStore.getState().structureViews[G]).toBe('workflow')
    await expectNoAxeViolations(container)
  })

  it('should_show_progress_and_remember_a_fold_when_the_node_fold_is_clicked', async () => {
    const user = userEvent.setup()
    const api = installFakeApi({ 'workflow:setFolded': () => ({ ok: true }) })
    const view = linkedView()
    const graph = buildGraph(view, computeLayout(view), null, new Set(), { [G]: 'workflow' }, false, true, {
      [G]: { view: WORKFLOW }
    })
    const node = graph.nodes.find((entry) => entry.id === workflowKey(G, 'spec', '001')) as WorkflowNodeType
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <ReactFlowProvider>
          <WorkflowNode {...({ id: node.id, data: node.data } as unknown as NodeProps<WorkflowNodeType>)} />
        </ReactFlowProvider>
      </QueryClientProvider>
    )
    expect(screen.getByText('2/3')).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'Replier « 001 · Démo 001 » (3 sous-nœuds)' }))
    expect(api.invoke).toHaveBeenCalledWith('workflow:setFolded', {
      genesisId: G,
      key: workflowKey(G, 'spec', '001'),
      folded: true
    })
    await expectNoAxeViolations(container)
  })

  it('should_explain_how_the_map_fills_when_the_project_has_no_method_files', () => {
    const view = linkedView()
    const graph = buildGraph(view, computeLayout(view), null, new Set(), { [G]: 'workflow' }, false, true, {
      [G]: { view: { ...WORKFLOW, specs: [], empty: true } }
    })
    const message = graph.nodes.find((node) => node.type === 'workflow') as WorkflowNodeType
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ReactFlowProvider>
          <WorkflowNode {...({ id: message.id, data: message.data } as unknown as NodeProps<WorkflowNodeType>)} />
        </ReactFlowProvider>
      </QueryClientProvider>
    )
    expect(screen.getByRole('note').textContent).toContain('Brainstorme une idée, puis spécifie-la')
  })
})

describe('dossier introuvable (spec 023 US1)', () => {
  it('should_offer_to_relink_the_folder_when_the_project_folder_is_missing', async () => {
    const user = userEvent.setup()
    const api = installFakeApi({ 'chat:linkFolder': () => ({ ok: true }) })
    const view = linkedView()
    const graph = buildGraph(view, computeLayout(view), null, new Set(), { [G]: 'workflow' }, false, true, {
      [G]: { error: 'Le dossier de ce projet est introuvable.' }
    })
    const message = graph.nodes.find((node) => node.type === 'workflow') as WorkflowNodeType
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <ReactFlowProvider>
          <WorkflowNode {...({ id: message.id, data: message.data } as unknown as NodeProps<WorkflowNodeType>)} />
        </ReactFlowProvider>
      </QueryClientProvider>
    )
    expect(screen.getByRole('note').textContent).toContain('Le dossier de ce projet est introuvable.')
    await user.click(screen.getByRole('button', { name: 'Relier le dossier…' }))
    expect(api.invoke).toHaveBeenCalledWith('chat:linkFolder', { neuronId: G, unlink: false })
    await expectNoAxeViolations(container)
  })
})

describe('vue Workflow dans la carte des idées (spec 023 US1)', () => {
  beforeAll(() => installReactFlowMocks())
  beforeEach(() => {
    useUiStore.setState({ view: 'ideas', toast: null, bornId: null, structureViews: { [G]: 'workflow' } })
    useCards.setState({ cards: [], activeId: null })
  })

  it('should_read_the_project_files_and_draw_the_workflow_when_the_view_is_chosen', async () => {
    const api = installFakeApi({
      'canvas:get': () => linkedView(),
      'canvas:savePositions': () => ({ ok: true }),
      // Animations réduites : jsdom ne fait pas tourner le glissement image par image.
      'app:getSettings': () => ({ ...DEFAULT_APP_SETTINGS, motion: 'reduced' }),
      'workflow:read': () => WORKFLOW
    })
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <IdeasCanvas />
      </QueryClientProvider>
    )
    expect(await screen.findByRole('group', { name: 'Spec 001 Démo 001, en cours, 2 sur 3 tâches' })).toBeDefined()
    expect(api.invoke).toHaveBeenCalledWith('workflow:read', { genesisId: G })
    expect(screen.queryByRole('group', { name: /Cœur/ })).toBeNull()
    // Fin d'un tour de Claude : la vue est relue (il a pu cocher une case).
    const reads = api.invoke.mock.calls.filter(([channel]) => channel === 'workflow:read').length
    api.emit('chat:turnEnd', { neuronId: G, message: null, interrupted: false })
    await waitFor(() =>
      expect(api.invoke.mock.calls.filter(([channel]) => channel === 'workflow:read').length).toBeGreaterThan(reads)
    )
  })
})

describe('cartes de la vue Workflow dans la carte des idées (spec 023 US2, US3)', () => {
  beforeAll(() => installReactFlowMocks())
  beforeEach(() => {
    useUiStore.setState({
      view: 'ideas',
      toast: null,
      bornId: null,
      structureViews: { [G]: 'workflow' },
      chatDrafts: {}
    })
    useCards.setState({ cards: [], activeId: null })
  })

  const renderLinked = () => {
    const api = installFakeApi({
      'canvas:get': () => linkedView(),
      'canvas:savePositions': () => ({ ok: true }),
      'app:getSettings': () => ({ ...DEFAULT_APP_SETTINGS, motion: 'reduced' }),
      'workflow:read': () => ({
        ...WORKFLOW,
        foundation: { path: 'docs/FOUNDATION.md', summary: 'Une app pour noter ses idées.' }
      }),
      'chat:open': () => {
        throw new Error('pas de conversation dans ce test')
      }
    })
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <IdeasCanvas />
      </QueryClientProvider>
    )
    return api
  }

  it('should_open_the_card_of_a_workflow_node_on_click_and_prefill_the_project_chat_on_double_click', async () => {
    // La conversation reprend aussitôt la consigne (puis l'efface) : on observe son dépôt.
    const seed = vi.fn()
    useUiStore.setState({ seedChatDraft: seed })
    renderLinked()
    const spec = await screen.findByRole('group', { name: 'Spec 001 Démo 001, en cours, 2 sur 3 tâches' })
    fireEvent.click(spec)
    expect(await screen.findByRole('dialog', { name: 'Détails : Démo 001' })).toBeDefined()
    fireEvent.doubleClick(screen.getByRole('group', { name: 'Tâche T003 à faire : T003' }))
    await waitFor(() => expect(seed).toHaveBeenCalledWith(G, expect.stringContaining('Implémente la tâche T003')))
    expect(useCards.getState().cards.find((card) => card.id === G)).toMatchObject({ side: 'chat' })
  })

  it('should_show_the_foundation_in_the_genesis_card_when_the_workflow_view_is_on', async () => {
    renderLinked()
    await screen.findByRole('group', { name: 'Spec 001 Démo 001, en cours, 2 sur 3 tâches' })
    useCards.getState().open(G)
    expect(await screen.findByText('Une app pour noter ses idées.')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Lire la fondation' })).toBeDefined()
  })
})
