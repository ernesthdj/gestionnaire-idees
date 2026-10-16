import { describe, expect, it, vi } from 'vitest'
import { AppError } from '../../../src/main/domain/errors'
import { createAssemblyRoutes } from '../../../src/main/ipc/assemblyHandlers'
import { createDispatcher } from '../../../src/main/ipc/registry'

const NODE = '11111111-1111-4111-8111-111111111111'
const GENESIS = '22222222-2222-4222-8222-222222222222'
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
    list: vi.fn(() => [view])
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
})
