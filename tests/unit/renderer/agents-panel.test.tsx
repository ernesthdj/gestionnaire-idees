import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { AgentNode } from '../../../src/renderer/src/canvas/agents/AgentNode'
import type { AgentNodeData, AgentNodeType } from '../../../src/renderer/src/canvas/agents/agentTypes'
import { SidePanel } from '../../../src/renderer/src/canvas/side/SidePanel'
import { useSidePanel } from '../../../src/renderer/src/canvas/side/sidePanelStore'
import { useVisio } from '../../../src/renderer/src/canvas/agents/visioStore'
import type { AgentProfileView } from '../../../src/shared/agents/profile'
import type { AgentLiveView, AssemblyRunView, AssemblySketchView } from '../../../src/shared/ipc/assemblies'
import { expectNoAxeViolations } from '../../support/axe'
import { installFakeApi } from './support/fakeApi'

const HOST = '11111111-1111-4111-8111-111111111111'
const GENESIS = '22222222-2222-4222-8222-222222222222'

const profile = (id: string, name: string, role: AgentProfileView['role']): AgentProfileView => ({
  id,
  name,
  role,
  instructions: '',
  permissionMode: 'acceptEdits',
  model: 'claude-sonnet-5-5',
  effort: 'medium',
  skills: [],
  updatedAt: 0,
  delivered: 0
})
const PO = '33333333-3333-4333-8333-333333333333'
const BACK = '44444444-4444-4444-8444-444444444444'
const PROFILES = [profile(PO, 'Chef de produit', 'po'), profile(BACK, 'Développeur', 'backend')]

const SKETCH: AssemblySketchView = {
  nodeId: HOST,
  genesisId: GENESIS,
  taskId: 'T006',
  agents: [
    { id: 'chef', profileId: PO },
    { id: 'dev', profileId: BACK, task: 'Trier la liste' }
  ],
  links: [{ from: 'chef', to: 'dev' }]
}

const live = (agentId: string, state: AgentLiveView['state'], patch: Partial<AgentLiveView> = {}): AgentLiveView => ({
  agentId,
  state,
  ...patch
})
const run = (agents: AgentLiveView[], patch: Partial<AssemblyRunView> = {}): AssemblyRunView => ({
  genesisId: GENESIS,
  nodeId: HOST,
  taskId: 'T006',
  state: 'running',
  startedAt: 1,
  warnings: [],
  agents,
  ...patch
})

const nodeData = (patch: Partial<AgentNodeData> = {}): AgentNodeData => ({
  hostId: HOST,
  genesisId: GENESIS,
  hostTitle: 'Tri de la liste',
  taskId: 'T006',
  agentId: 'dev',
  profileId: '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f',
  delivered: 0,
  name: 'Développeur',
  role: 'backend',
  visual: 'sketch',
  pass: null,
  nature: null,
  progress: 0,
  open: false,
  ...patch
})
const renderNode = (patch: Partial<AgentNodeData> = {}) => {
  installFakeApi({ 'assembly:sketches': () => [], 'assembly:list': () => [], 'agents:list': () => [] })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ReactFlowProvider>
        <AgentNode {...({ id: 'agent:h:dev', data: nodeData(patch) } as unknown as NodeProps<AgentNodeType>)} />
      </ReactFlowProvider>
    </QueryClientProvider>
  )
}

describe('nœud d’un agent sur la carte (T006, T008 ; L1o D10, D13)', () => {
  beforeEach(() => {
    useSidePanel.getState().reset()
    useVisio.getState().close()
  })

  it('should_say_the_state_the_pass_and_a_progress_that_runs_while_the_agent_works', async () => {
    const { container } = renderNode({ visual: 'running', pass: 2, nature: 'correction', progress: null })
    const button = screen.getByRole('button', { name: 'Développeur, au travail · passe 2. Ouvrir la visio.' })
    expect(button.getAttribute('title')).toContain('correction d’une erreur relevée par le QA')
    expect(container.querySelector('.agent-running')).not.toBeNull()
    expect(container.querySelector('.agent-bar-running')).not.toBeNull()
    expect(
      screen.getByRole('progressbar', { name: 'Avancement de Développeur' }).getAttribute('aria-valuenow')
    ).toBeNull()
    await expectNoAxeViolations(container)
  })

  it('should_turn_green_when_validated_and_red_when_failed_with_a_text_for_each', async () => {
    const validated = renderNode({ visual: 'validated', progress: 1 })
    expect(validated.container.querySelector('.agent-validated')).not.toBeNull()
    expect(screen.getByText(/validé/)).toBeDefined()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100')
    await expectNoAxeViolations(validated.container)
    validated.unmount()
    const failed = renderNode({ visual: 'failed', progress: 1 })
    expect(failed.container.querySelector('.agent-failed')).not.toBeNull()
    expect(screen.getByText(/en erreur/)).toBeDefined()
    await expectNoAxeViolations(failed.container)
  })

  it('should_go_into_visio_when_clicked_and_hang_up_when_clicked_again', () => {
    renderNode({ visual: 'done', progress: 1 })
    fireEvent.click(screen.getByRole('button', { name: /Développeur, terminé.*Ouvrir la visio/ }))
    expect(useVisio.getState().key).toBe('agent:h:dev')
    expect(screen.getByText(/En visio avec Développeur/)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /En visio : raccrocher/ }))
    expect(useVisio.getState().key).toBeNull()
  })

  it('should_not_go_into_visio_when_the_pointer_moved_like_a_drag', () => {
    renderNode()
    const room = screen.getByRole('button', { name: /Ouvrir la visio/ })
    fireEvent.pointerDown(room, { clientX: 10, clientY: 10 })
    fireEvent.click(room, { clientX: 60, clientY: 40 })
    expect(useVisio.getState().key).toBeNull()
  })
})

describe('volet des agents d’un nœud (T006)', () => {
  let state: { sketches: AssemblySketchView[]; runs: AssemblyRunView[]; warnings: string[] }
  const setup = () => {
    const api = installFakeApi({
      'assembly:sketches': () => state.sketches,
      'assembly:list': () => state.runs,
      'agents:list': () => PROFILES,
      'assembly:sketchSave': (payload) => {
        const input = payload as { nodeId: string; taskId: string; agents: never[]; links: never[] }
        state.sketches = [{ ...input, genesisId: GENESIS }]
        return state.sketches[0]
      },
      'assembly:sketchClear': () => {
        state.sketches = []
        return {}
      },
      'assembly:warnings': () => state.warnings,
      'assembly:start': () => ({ started: true }),
      'assembly:cancel': () => ({}),
      'assembly:approve': () => ({ merged: true, baseBranch: 'main', commit: 'abcdef1234' })
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <SidePanel />
      </QueryClientProvider>
    )
    act(() =>
      useSidePanel.getState().openAgents({
        nodeId: HOST,
        genesisId: GENESIS,
        title: '◇ Tri de la liste',
        kindLabel: 'Agents'
      })
    )
    return api
  }
  const tab = (): HTMLElement => screen.getByTestId('agents-tab')
  const calls = (api: ReturnType<typeof setup>, channel: string) =>
    api.invoke.mock.calls.filter(([name]) => name === channel).map(([, payload]) => payload)

  beforeEach(() => {
    useSidePanel.getState().reset()
    state = { sketches: [], runs: [], warnings: [] }
  })

  it('should_invite_to_add_a_first_agent_and_save_it_as_a_sketch_on_the_node', async () => {
    const api = setup()
    expect(await within(tab()).findByText(/Aucun agent/)).toBeDefined()
    await waitFor(() =>
      expect(within(tab()).getByRole('combobox', { name: 'Ajouter un agent' })).toHaveProperty('disabled', false)
    )
    fireEvent.click(within(tab()).getByRole('button', { name: 'Ajouter' }))
    await waitFor(() => expect(calls(api, 'assembly:sketchSave')).toHaveLength(1))
    expect(calls(api, 'assembly:sketchSave')[0]).toMatchObject({
      nodeId: HOST,
      taskId: 'T-11111111',
      agents: [{ id: 'chef-de-produit', profileId: PO }],
      links: []
    })
    expect(await within(tab()).findByText(/Chef de produit/)).toBeDefined()
  })

  it('should_let_an_agent_wait_for_another_from_the_list_and_remove_the_wait', async () => {
    state.sketches = [{ ...SKETCH, links: [] }]
    const api = setup()
    const select = await within(tab()).findByRole('combobox', { name: 'Faire attendre dev' })
    fireEvent.change(select, { target: { value: 'chef' } })
    await waitFor(() => expect(calls(api, 'assembly:sketchSave')).toHaveLength(1))
    expect(calls(api, 'assembly:sketchSave')[0]).toMatchObject({ links: [{ from: 'chef', to: 'dev' }] })
  })

  it('should_warn_before_launching_then_start_on_confirmation', async () => {
    state.sketches = [SKETCH]
    state.warnings = ['« Développeur » est en mode « Écrire sans demander » : il ne pourra lancer aucune commande.']
    const api = setup()
    fireEvent.click(await within(tab()).findByRole('button', { name: 'Lancer' }))
    expect(await within(tab()).findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining('Écrire sans demander')
    )
    expect(calls(api, 'assembly:start')).toHaveLength(0)
    fireEvent.click(within(tab()).getByRole('button', { name: 'Lancer quand même' }))
    await waitFor(() => expect(calls(api, 'assembly:start')).toHaveLength(1))
    expect(calls(api, 'assembly:start')[0]).toMatchObject({ nodeId: HOST, taskId: 'T006' })
  })

  it('should_follow_the_run_live_with_progress_stop_button_and_the_selected_agent_report', async () => {
    state.sketches = [SKETCH]
    state.runs = [
      run([
        live('chef', 'done', { pass: 1, nature: 'initiale', specVersion: 1, report: '## Spec\n\nTrier par date.' }),
        live('dev', 'running', { pass: 1, nature: 'initiale', specVersion: 1 })
      ])
    ]
    const api = setup()
    act(() => useSidePanel.getState().selectAgent(HOST, 'chef'))
    expect(await within(tab()).findByText(/1 agent sur 2 a fini — au travail/)).toBeDefined()
    expect(within(tab()).getByRole('progressbar', { name: 'Agents qui ont fini' }).getAttribute('aria-valuenow')).toBe(
      '1'
    )
    expect(within(tab()).getByRole('heading', { name: 'Spec' })).toBeDefined()
    expect(within(tab()).getByText(/passe 1 \(implémentation initiale\), spec v1/)).toBeDefined()
    // Au travail : plus de modification, mais on peut arrêter.
    expect(within(tab()).queryByRole('button', { name: 'Ajouter' })).toBeNull()
    fireEvent.click(within(tab()).getByRole('button', { name: 'Arrêter' }))
    await waitFor(() => expect(calls(api, 'assembly:cancel')).toEqual([{ genesisId: GENESIS, taskId: 'T006' }]))
  })

  it('should_show_why_an_agent_failed', async () => {
    state.sketches = [SKETCH]
    state.runs = [
      run([live('chef', 'failed', { pass: 1, message: 'Session coupée.' }), live('dev', 'blocked')], {
        state: 'finished'
      })
    ]
    setup()
    act(() => useSidePanel.getState().selectAgent(HOST, 'chef'))
    expect(await within(tab()).findByText('Session coupée.')).toBeDefined()
    expect(within(tab()).getByText(/0 agent sur 2 a fini — arrêté, sans validation/)).toBeDefined()
    expect(within(tab()).getByRole('button', { name: 'Relancer' })).toBeDefined()
  })

  it('should_offer_the_merge_only_once_the_qa_validated_and_ask_for_the_single_agreement', async () => {
    state.sketches = [SKETCH]
    state.runs = [
      run([live('chef', 'done'), live('dev', 'done')], {
        state: 'finished',
        result: { taskId: 'T006', completed: true, rounds: 1, agents: [] }
      })
    ]
    const api = setup()
    expect(await within(tab()).findByText(/validé par le QA/)).toBeDefined()
    fireEvent.click(within(tab()).getByRole('button', { name: 'Fusionner le travail validé…' }))
    expect(calls(api, 'assembly:approve')).toHaveLength(0)
    fireEvent.click(within(tab()).getByRole('button', { name: 'Accorder la fusion' }))
    await waitFor(() =>
      expect(calls(api, 'assembly:approve')).toEqual([{ genesisId: GENESIS, taskId: 'T006', confirm: true }])
    )
  })

  it('should_report_a_merge_that_was_refused', async () => {
    state.sketches = [SKETCH]
    state.runs = [
      run([live('chef', 'done'), live('dev', 'done')], {
        state: 'finished',
        result: { taskId: 'T006', completed: true, rounds: 1, agents: [] },
        approval: { merged: false, baseBranch: 'main', message: 'la fusion est en conflit' }
      })
    ]
    setup()
    expect(await within(tab()).findByText('Fusion refusée : la fusion est en conflit.')).toBeDefined()
  })

  it('should_have_no_accessibility_violation', async () => {
    state.sketches = [SKETCH]
    state.runs = [run([live('chef', 'done', { report: 'Fait.' }), live('dev', 'running')])]
    const { container } = { container: document.body }
    setup()
    act(() => useSidePanel.getState().selectAgent(HOST, 'dev'))
    await within(tab()).findByText(/1 agent sur 2/)
    await expectNoAxeViolations(container)
  })
})
