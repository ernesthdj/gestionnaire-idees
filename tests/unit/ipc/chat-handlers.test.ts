import { describe, expect, it, vi } from 'vitest'
import type { ConversationService } from '../../../src/main/application/conversation/ConversationService'
import { createChatRoutes } from '../../../src/main/ipc/chatHandlers'
import { createDispatcher } from '../../../src/main/ipc/registry'

const ID = '00000000-0000-4000-8000-0000000000c1'

function setup() {
  const setPermissionMode = vi.fn((_neuronId: string, mode: string) => ({ mode }))
  const dispatch = createDispatcher(createChatRoutes({ setPermissionMode } as unknown as ConversationService))
  return { dispatch, setPermissionMode }
}

describe('canal chat:setPermissionMode', () => {
  it('should_pass_the_mode_and_the_confirmation_when_valid', async () => {
    const { dispatch, setPermissionMode } = setup()
    expect(await dispatch('chat:setPermissionMode', { neuronId: ID, mode: 'acceptEdits' })).toMatchObject({
      success: true,
      data: { mode: 'acceptEdits' }
    })
    await dispatch('chat:setPermissionMode', { neuronId: ID, mode: 'bypassPermissions', confirmBypass: true })
    expect(setPermissionMode.mock.calls).toEqual([
      [ID, 'acceptEdits', false],
      [ID, 'bypassPermissions', true]
    ])
  })

  it.each([
    { neuronId: ID, mode: 'plan' },
    { neuronId: ID, mode: 'bypassPermissions', confirmBypass: 'oui' },
    { neuronId: 'pas-un-uuid', mode: 'default' },
    { neuronId: ID, mode: 'default', extra: 1 }
  ])('should_refuse_an_invalid_request_%o', async (input) => {
    const { dispatch, setPermissionMode } = setup()
    expect(await dispatch('chat:setPermissionMode', input)).toMatchObject({
      success: false,
      error: { code: 'VALIDATION' }
    })
    expect(setPermissionMode).not.toHaveBeenCalled()
  })
})
