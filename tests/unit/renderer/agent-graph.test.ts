import { describe, expect, it } from 'vitest'
import {
  agentGraph,
  assemblyProgress,
  levelsOf,
  runOf,
  visualOf,
  wouldCycle
} from '../../../src/renderer/src/canvas/agents/agentGraph'
import { agentNodeId, parseAgentNodeId } from '../../../src/renderer/src/canvas/agents/agentTypes'
import type { AgentProfileView } from '../../../src/shared/agents/profile'
import type { AgentLiveView, AssemblyRunView, AssemblySketchView } from '../../../src/shared/ipc/assemblies'

const HOST = '11111111-1111-4111-8111-111111111111'

const profile = (id: string, role: AgentProfileView['role']): AgentProfileView => ({
  id,
  name: `Agent ${id}`,
  role,
  instructions: '',
  permissionMode: 'acceptEdits',
  model: 'claude-sonnet-5-5',
  effort: 'medium',
  skills: [],
  updatedAt: 0,
  delivered: 0
})
const PROFILES = [profile('po', 'po'), profile('back', 'backend'), profile('qa', 'qa')]

const sketch: AssemblySketchView = {
  nodeId: HOST,
  genesisId: 'g1',
  taskId: 'T006',
  agents: [
    { id: 'po', profileId: 'po' },
    { id: 'back', profileId: 'back' },
    { id: 'front', profileId: 'back' },
    { id: 'qa', profileId: 'qa' }
  ],
  links: [
    { from: 'po', to: 'back' },
    { from: 'po', to: 'front' },
    { from: 'back', to: 'qa' },
    { from: 'front', to: 'qa' }
  ]
}

const run = (agents: AgentLiveView[], patch: Partial<AssemblyRunView> = {}): AssemblyRunView => ({
  genesisId: 'g1',
  nodeId: HOST,
  taskId: 'T006',
  state: 'running',
  startedAt: 1,
  warnings: [],
  agents,
  ...patch
})
const live = (agentId: string, state: AgentLiveView['state'], patch: Partial<AgentLiveView> = {}): AgentLiveView => ({
  agentId,
  state,
  ...patch
})

const hosts = new Map([[HOST, { x: 400, y: 100, title: 'Tri de la liste' }]])
const build = (runs: AssemblyRunView[] = [], shown: { hostId: string; agentId: string | null } | null = null) =>
  agentGraph({ sketches: [sketch], runs, profiles: PROFILES, hosts, shown })

describe('agents en nœuds de la carte (T006, L1o D10)', () => {
  it('should_place_agents_below_their_node_one_row_per_waiting_level_centered_under_it', () => {
    const { nodes } = build()
    const at = (id: string) => nodes.find((node) => node.id === agentNodeId(HOST, id))?.position
    expect(at('po')).toEqual({ x: 400, y: 260 })
    // Deux agents en parallèle sur le même rang, de part et d'autre de l'axe du nœud.
    expect(at('back')).toEqual({ x: 256, y: 580 })
    expect(at('front')).toEqual({ x: 544, y: 580 })
    expect(at('qa')).toEqual({ x: 400, y: 900 })
    expect(nodes.every((node) => node.draggable === true && node.type === 'agent')).toBe(true)
  })

  it('should_keep_an_agent_where_it_was_dropped_relative_to_its_node_when_it_has_a_place', () => {
    const placed = {
      ...sketch,
      agents: sketch.agents.map((agent) => (agent.id === 'qa' ? { ...agent, place: { x: -600, y: 40 } } : agent))
    }
    const { nodes } = agentGraph({ sketches: [placed], runs: [], profiles: PROFILES, hosts, shown: null })
    expect(nodes.find((node) => node.id === agentNodeId(HOST, 'qa'))?.position).toEqual({ x: -200, y: 140 })
  })

  it('should_draw_a_sketch_with_dashed_state_and_context_link_to_the_agent_that_waits_for_nobody', () => {
    const { nodes, edges } = build()
    expect(nodes.map((node) => node.data.visual)).toEqual(['sketch', 'sketch', 'sketch', 'sketch'])
    expect(nodes[0]?.data).toMatchObject({ name: 'Agent po', role: 'po', hostTitle: 'Tri de la liste', taskId: 'T006' })
    expect(edges.filter((edge) => edge.data?.phase === 'context')).toEqual([
      expect.objectContaining({ source: HOST, target: agentNodeId(HOST, 'po') })
    ])
    expect(edges.filter((edge) => edge.id.startsWith('agent-link:')).map((edge) => edge.data?.phase)).toEqual([
      'idle',
      'idle',
      'idle',
      'idle'
    ])
  })

  it('should_animate_the_link_into_the_agent_that_works_once_the_agent_it_waits_for_has_finished', () => {
    const { edges, nodes } = build([
      run([
        live('po', 'done', { pass: 1, nature: 'initiale' }),
        live('back', 'running', { pass: 1 }),
        live('front', 'waiting'),
        live('qa', 'waiting')
      ])
    ])
    const phase = (from: string, to: string) =>
      edges.find((edge) => edge.id === `agent-link:${HOST}:${from}>${to}`)?.data?.phase
    expect(phase('po', 'back')).toBe('flowing')
    expect(phase('po', 'front')).toBe('waiting')
    expect(phase('back', 'qa')).toBe('waiting')
    const back = nodes.find((node) => node.id === agentNodeId(HOST, 'back'))
    expect(back?.data).toMatchObject({ visual: 'running', pass: 1, progress: null })
    expect(nodes.find((node) => node.id === agentNodeId(HOST, 'po'))?.data).toMatchObject({
      visual: 'done',
      progress: 1
    })
    expect(back?.ariaLabel).toBe('Agent back, Backend — au travail')
  })

  it('should_turn_every_agent_green_when_the_qa_validates_and_keep_green_once_merged', () => {
    const agents = ['po', 'back', 'front', 'qa'].map((id) => live(id, 'done', { pass: 1 }))
    const validated = run(agents, {
      state: 'finished',
      result: { taskId: 'T006', completed: true, rounds: 1, agents: [] }
    })
    expect(build([validated]).nodes.map((node) => node.data.visual)).toEqual(Array(4).fill('validated'))
    const merged = { ...validated, approval: { merged: true, baseBranch: 'main', commit: 'abc' } }
    expect(build([merged]).nodes.map((node) => node.data.visual)).toEqual(Array(4).fill('merged'))
    expect(
      build([validated])
        .edges.filter((edge) => edge.id.startsWith('agent-link:'))
        .map((e) => e.data?.phase)
    ).toEqual(Array(4).fill('done'))
  })

  it('should_show_red_for_a_failed_agent_and_amber_for_the_agents_blocked_behind_it', () => {
    const { nodes, edges } = build([
      run(
        [
          live('po', 'failed', { message: 'Session coupée.' }),
          live('back', 'blocked'),
          live('front', 'blocked'),
          live('qa', 'blocked')
        ],
        {
          state: 'finished'
        }
      )
    ])
    expect(nodes.map((node) => node.data.visual)).toEqual(['failed', 'blocked', 'blocked', 'blocked'])
    expect(edges.filter((edge) => edge.data?.phase === 'error').length).toBe(4)
  })

  it('should_show_the_qa_send_back_and_fail_the_agents_still_waiting_when_the_planner_itself_failed', () => {
    const sentBack = run([
      live('po', 'done'),
      live('back', 'done'),
      live('front', 'done'),
      live('qa', 'done', { verdict: 'renvoi' })
    ])
    expect(visualOf(sentBack, sentBack.agents[3])).toBe('sent-back')
    const broken = run([live('po', 'running')], { state: 'failed', error: 'x' })
    expect(visualOf(broken, broken.agents[0])).toBe('failed')
    expect(visualOf(run([live('po', 'cancelled')], { state: 'finished' }), live('po', 'cancelled'))).toBe('cancelled')
    expect(visualOf(undefined, undefined)).toBe('sketch')
  })

  it('should_light_the_agent_whose_panel_is_shown_and_pick_the_latest_run_of_the_task', () => {
    const { nodes } = build([], { hostId: HOST, agentId: 'back' })
    expect(nodes.filter((node) => node.data.open).map((node) => node.data.agentId)).toEqual(['back'])
    const older = run([live('po', 'done')], { startedAt: 1 })
    const newer = run([live('po', 'running')], { startedAt: 2 })
    expect(runOf(sketch, [older, newer])).toBe(newer)
    expect(runOf(sketch, [{ ...newer, taskId: 'T007' }])).toBeUndefined()
  })

  it('should_draw_nothing_for_a_node_that_is_not_on_the_map', () => {
    expect(agentGraph({ sketches: [sketch], runs: [], profiles: PROFILES, hosts: new Map(), shown: null })).toEqual({
      nodes: [],
      edges: []
    })
  })

  it('should_name_an_agent_by_its_id_when_its_profile_was_deleted', () => {
    const { nodes } = agentGraph({ sketches: [sketch], runs: [], profiles: [], hosts, shown: null })
    expect(nodes[0]?.data).toMatchObject({ name: 'po', role: null })
  })

  it('should_count_levels_forbid_cycles_and_count_the_agents_that_finished', () => {
    expect([...levelsOf(sketch)]).toEqual([
      ['po', 0],
      ['back', 1],
      ['front', 1],
      ['qa', 2]
    ])
    expect(wouldCycle(sketch.links, 'qa', 'po')).toBe(true)
    expect(wouldCycle(sketch.links, 'back', 'front')).toBe(false)
    expect(wouldCycle(sketch.links, 'po', 'po')).toBe(true)
    expect(assemblyProgress(run([live('po', 'done'), live('back', 'running')]))).toEqual({ done: 1, total: 2 })
    expect(assemblyProgress(undefined)).toEqual({ done: 0, total: 0 })
  })

  it('should_read_back_the_host_and_the_agent_from_a_node_id_and_refuse_anything_else', () => {
    expect(parseAgentNodeId(agentNodeId(HOST, 'back'))).toEqual({ hostId: HOST, agentId: 'back' })
    // Un nœud du Workflow (L1o D14) a des « : » dans sa clé : il prend tout ce qui suit l'agent.
    const wf = 'wf:22222222-2222-4222-8222-222222222222:ttask:visuel-t001'
    expect(parseAgentNodeId(agentNodeId(wf, 'back'))).toEqual({ hostId: wf, agentId: 'back' })
    for (const id of ['wf:g:task:1', 'agent:', 'agent:x', 'agent::y', HOST]) expect(parseAgentNodeId(id)).toBeNull()
  })
})
