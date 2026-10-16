import { describe, expect, it, vi } from 'vitest'
import { AppError } from '../../../src/main/domain/errors'
import { createAssemblyRoutes } from '../../../src/main/ipc/assemblyHandlers'
import { createDispatcher } from '../../../src/main/ipc/registry'

const GENESIS = '22222222-2222-4222-8222-222222222222'
/** Tâche d'un fichier de tâches de la vue Workflow (L1o D14). */
const NODE = `wf:${GENESIS}:ttask:docs-taches-design-t001`
const PROFILE = '33333333-3333-4333-8333-333333333333'

describe('canaux des agents assemblés (T005)', () => {
  const view = { genesisId: GENESIS, nodeId: NODE, taskId: 'T020', state: 'running', startedAt: 1, warnings: [] }
  const deps = {
    warnings: vi.fn(async () => ['avertissement']),
    start: vi.fn(async () => view),
    cancel: vi.fn(),
    approve: vi.fn(async () => {
      throw new AppError('CONFLICT', 'pas validé')
    }),
    list: vi.fn(() => [view]),
    sketches: vi.fn(() => []),
    saveSketch: vi.fn((request: { nodeId: string }) => ({ ...request, genesisId: GENESIS })),
    clearSketch: vi.fn()
  }
  const dispatch = createDispatcher(createAssemblyRoutes(deps as never))
  const request = {
    nodeId: NODE,
    taskId: 'T020',
    agents: [{ id: 'back', profileId: PROFILE }],
    links: []
  }

  it('should_pass_a_valid_assembly_to_the_service_without_undefined_optionals', async () => {
    expect(await dispatch('assembly:start', request)).toEqual({ success: true, data: view })
    expect(deps.start).toHaveBeenCalledWith({
      nodeId: NODE,
      taskId: 'T020',
      agents: [{ id: 'back', profileId: PROFILE }],
      links: []
    })
    expect(await dispatch('assembly:warnings', { ...request, baseBranch: 'develop', task: 'Faire' })).toEqual({
      success: true,
      data: ['avertissement']
    })
    expect(deps.warnings).toHaveBeenCalledWith(expect.objectContaining({ baseBranch: 'develop', task: 'Faire' }))
  })

  it('should_refuse_paths_options_and_unknown_fields_from_the_renderer', async () => {
    for (const bad of [
      { ...request, taskId: '../T1' },
      { ...request, baseBranch: '--upload-pack=x' },
      { ...request, baseBranch: 'a..b' },
      { ...request, projectDir: 'C:/x' },
      { ...request, agents: [] },
      { ...request, agents: [{ id: 'Back', profileId: PROFILE }] },
      { ...request, agents: [{ id: 'back', profileId: 'pas-un-uuid' }] },
      { ...request, nodeId: 'pas-un-uuid' }
    ]) {
      expect((await dispatch('assembly:start', bad)).success).toBe(false)
    }
    expect(deps.start).not.toHaveBeenCalled()
  })

  it('should_demand_the_confirmation_of_mentalyas_to_merge', async () => {
    const target = { genesisId: GENESIS, taskId: 'T020' }
    expect((await dispatch('assembly:approve', target)).success).toBe(false)
    expect(deps.approve).not.toHaveBeenCalled()
    expect(await dispatch('assembly:approve', { ...target, confirm: true })).toMatchObject({
      success: false,
      error: { code: 'CONFLICT' }
    })
  })

  it('should_cancel_and_list_by_identifiers_only', async () => {
    expect(await dispatch('assembly:cancel', { genesisId: GENESIS, taskId: 'T020' })).toEqual({
      success: true,
      data: {}
    })
    expect(deps.cancel).toHaveBeenCalledWith(GENESIS, 'T020')
    expect(await dispatch('assembly:list', {})).toEqual({ success: true, data: [view] })
    expect(deps.list).toHaveBeenCalledWith(undefined)
    expect((await dispatch('assembly:list', { genesisId: 'x' })).success).toBe(false)
  })

  it('should_save_read_and_clear_a_sketch_without_a_base_branch', async () => {
    expect(await dispatch('assembly:sketchSave', { ...request, task: 'Trier' })).toMatchObject({ success: true })
    expect(deps.saveSketch).toHaveBeenCalledWith({
      nodeId: NODE,
      taskId: 'T020',
      task: 'Trier',
      agents: [{ id: 'back', profileId: PROFILE }],
      links: []
    })
    expect(
      await dispatch('assembly:sketchSave', {
        ...request,
        agents: [{ id: 'back', profileId: PROFILE, place: { x: -320, y: 48 } }]
      })
    ).toMatchObject({ success: true })
    expect(deps.saveSketch).toHaveBeenLastCalledWith(
      expect.objectContaining({ agents: [{ id: 'back', profileId: PROFILE, place: { x: -320, y: 48 } }] })
    )
    expect(await dispatch('assembly:sketches', {})).toEqual({ success: true, data: [] })
    expect(deps.sketches).toHaveBeenCalledWith(undefined)
    expect(await dispatch('assembly:sketchClear', { nodeId: NODE })).toEqual({ success: true, data: {} })
    expect(deps.clearSketch).toHaveBeenCalledWith(NODE)
  })

  it('should_refuse_a_sketch_with_a_base_branch_a_bad_node_or_a_bad_link', async () => {
    for (const bad of [
      { ...request, baseBranch: 'main' },
      { ...request, nodeId: 'pas-un-uuid' },
      // Un neurone n'accueille plus d'agents : seulement les nœuds du Workflow.
      { ...request, nodeId: '11111111-1111-4111-8111-111111111111' },
      { ...request, agents: [{ id: 'back', profileId: PROFILE, place: { x: 1e9, y: 0 } }] },
      { ...request, links: [{ from: 'Back', to: 'qa' }] },
      { ...request, agents: [] }
    ]) {
      expect((await dispatch('assembly:sketchSave', bad)).success).toBe(false)
    }
    expect((await dispatch('assembly:sketchClear', { nodeId: 'x' })).success).toBe(false)
    expect(deps.saveSketch).not.toHaveBeenCalled()
  })

  it('should_open_the_visio_chat_of_an_agent_on_a_workflow_node_only', async () => {
    const chats = { open: vi.fn(() => ({ neuronId: 'n1' })) }
    const withChat = createDispatcher(createAssemblyRoutes(deps as never, chats))
    expect(await withChat('assembly:chat', { nodeId: NODE, agentId: 'back' })).toEqual({
      success: true,
      data: { neuronId: 'n1' }
    })
    expect(chats.open).toHaveBeenCalledWith(NODE, 'back')
    expect((await withChat('assembly:chat', { nodeId: GENESIS, agentId: 'back' })).success).toBe(false)
    expect((await withChat('assembly:chat', { nodeId: NODE, agentId: 'Back!' })).success).toBe(false)
  })
})
