import { describe, expect, it, vi } from 'vitest'
import type { WorkflowView } from '@shared/ipc/workflow'
import { createDispatcher } from '../../../src/main/ipc/registry'
import { createWorkflowRoutes } from '../../../src/main/ipc/workflowHandlers'

const ID = '00000000-0000-4000-8000-0000000000e3'
const OTHER = '00000000-0000-4000-8000-0000000000e4'
const VIEW: WorkflowView = {
  genesisId: ID,
  foundation: null,
  specs: [],
  brainstorm: [],
  folded: {},
  empty: true,
  readAt: '2026-10-09T10:00:00.000Z',
  taskFiles: [],
  missingFiles: []
}

function setup(exists = true) {
  const workflow = {
    read: vi.fn(() => VIEW),
    file: vi.fn(() => ({ path: 'src/a.ts', lang: 'ts' as const, lines: [] }))
  }
  const folds = { set: vi.fn() }
  return { workflow, folds, dispatch: createDispatcher(createWorkflowRoutes(workflow, folds, () => exists)) }
}

describe('canaux workflow:* (spec 023)', () => {
  it('should_read_a_view_and_only_relative_files_when_called_with_valid_inputs', async () => {
    const { dispatch, workflow } = setup()
    expect(await dispatch('workflow:read', { genesisId: ID })).toMatchObject({ success: true })
    expect(await dispatch('workflow:read', { genesisId: 'pas-un-uuid' })).toMatchObject({ success: false })
    expect(await dispatch('workflow:file', { genesisId: ID, path: 'src/a.ts' })).toMatchObject({ success: true })
    for (const path of ['../secret.txt', 'C:/Windows/win.ini', '/etc/passwd', 'a/../../b', '']) {
      expect(await dispatch('workflow:file', { genesisId: ID, path }), path).toMatchObject({ success: false })
    }
    expect(workflow.file).toHaveBeenCalledTimes(1)
  })

  it('should_return_the_anatomy_only_for_relative_paths_and_none_without_the_analysis', async () => {
    const anatomy = {
      anatomy: vi.fn(async () => ({ blocks: [], imports: [], calls: [], truncated: false }))
    }
    const { workflow, folds } = setup()
    const dispatch = createDispatcher(createWorkflowRoutes(workflow, folds, () => true, anatomy))
    expect(await dispatch('workflow:anatomy', { genesisId: ID, path: 'src/a.ts' })).toMatchObject({
      success: true,
      data: { blocks: [] }
    })
    expect(await dispatch('workflow:anatomy', { genesisId: ID, path: '../x.ts' })).toMatchObject({ success: false })
    expect(anatomy.anatomy).toHaveBeenCalledTimes(1)
    expect(await setup().dispatch('workflow:anatomy', { genesisId: ID, path: 'src/a.ts' })).toMatchObject({
      success: true,
      data: null
    })
  })

  it('should_explain_only_relative_files_and_refuse_without_the_service', async () => {
    const summaries = {
      saved: vi.fn(() => ({ summary: null, outdated: true })),
      summary: vi.fn(async () => ({
        role: 'r',
        receives: 'e',
        produces: 's',
        parts: [],
        flow: [],
        engine: 'claude' as const,
        model: 'm'
      }))
    }
    const { workflow, folds } = setup()
    const dispatch = createDispatcher(
      createWorkflowRoutes(workflow, folds, () => true, undefined, undefined, summaries)
    )
    expect(await dispatch('workflow:summary', { genesisId: ID, path: 'src/a.ts' })).toMatchObject({
      success: true,
      data: { role: 'r' }
    })
    expect(await dispatch('workflow:summary', { genesisId: ID, path: '../x.ts' })).toMatchObject({ success: false })
    expect(summaries.summary).toHaveBeenCalledTimes(1)
    expect(await dispatch('workflow:savedSummary', { genesisId: ID, path: 'src/a.ts' })).toMatchObject({
      success: true,
      data: { summary: null, outdated: true }
    })
    expect(await setup().dispatch('workflow:summary', { genesisId: ID, path: 'src/a.ts' })).toMatchObject({
      success: false
    })
  })

  it('should_open_a_node_conversation_only_for_a_key_of_the_same_project', async () => {
    const chats = { open: vi.fn(() => ({ neuronId: 'n1' })) }
    const { workflow, folds } = setup()
    const dispatch = createDispatcher(createWorkflowRoutes(workflow, folds, () => true, undefined, chats))
    expect(
      await dispatch('workflow:chat', { genesisId: ID, key: `wf:${ID}:task:022:T032`, title: 'Tâche T032' })
    ).toMatchObject({ success: true, data: { neuronId: 'n1' } })
    expect(
      await dispatch('workflow:chat', { genesisId: ID, key: `wf:${OTHER}:task:022:T032`, title: 'Tâche T032' })
    ).toMatchObject({ success: false })
    expect(await dispatch('workflow:chat', { genesisId: ID, key: `wf:${ID}:task:022:T032`, title: '' })).toMatchObject({
      success: false
    })
    expect(chats.open).toHaveBeenCalledTimes(1)
  })

  it('should_store_a_fold_only_for_a_key_of_the_same_project_when_the_project_exists', async () => {
    const { dispatch, folds } = setup()
    expect(
      await dispatch('workflow:setFolded', { genesisId: ID, key: `wf:${ID}:spec:022`, folded: true })
    ).toMatchObject({ success: true })
    expect(
      await dispatch('workflow:setFolded', { genesisId: ID, key: `wf:${OTHER}:spec:022`, folded: true })
    ).toMatchObject({ success: false })
    expect(
      await dispatch('workflow:setFolded', { genesisId: ID, key: `wf:${ID}:spec:<script>`, folded: true })
    ).toMatchObject({ success: false })
    expect(folds.set).toHaveBeenCalledTimes(1)
    const missing = setup(false)
    expect(
      await missing.dispatch('workflow:setFolded', { genesisId: ID, key: `wf:${ID}:spec:022`, folded: true })
    ).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } })
  })
})
