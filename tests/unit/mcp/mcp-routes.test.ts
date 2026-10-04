import { describe, expect, it, vi } from 'vitest'
import { SelectionStore } from '../../../src/main/application/mcp/SelectionStore'
import { createMcpRoutes, registrationCommand } from '../../../src/main/ipc/mcpHandlers'
import { createDispatcher } from '../../../src/main/ipc/registry'

const ID = '0f8b2a52-6d1c-4f3e-9a7b-2c4d5e6f7a8b'

describe('canaux du pont MCP', () => {
  it('should_build_a_registration_command_with_the_profile_and_no_secret', () => {
    const command = registrationCommand({
      electronPath: 'C:\\app\\electron.exe',
      relayPath: 'C:\\app\\out\\main\\mcp-relay.js',
      profileDir: 'C:\\Users\\x\\AppData\\Roaming\\gestionnaire-idees'
    })
    expect(command).toBe(
      'claude mcp add brainstormer --scope user -e ELECTRON_RUN_AS_NODE=1 ' +
        '-e "GI_PROFILE_DIR=C:\\Users\\x\\AppData\\Roaming\\gestionnaire-idees" ' +
        '-- "C:\\app\\electron.exe" "C:\\app\\out\\main\\mcp-relay.js"'
    )
    expect(command).not.toMatch(/[0-9a-f]{64}/)
  })

  it('should_store_the_selection_and_refuse_anything_but_ids', async () => {
    const selection = new SelectionStore()
    const rotate = vi.fn()
    const dispatch = createDispatcher(
      createMcpRoutes({ selection, status: () => ({ listening: true, clients: 0, command: 'x' }), rotateToken: rotate })
    )
    expect((await dispatch('map:selection', { ids: [ID, ID] })).success).toBe(true)
    expect(selection.get()).toEqual([ID])
    expect((await dispatch('map:selection', { ids: ['step-x'] })).success).toBe(false)
    expect((await dispatch('map:selection', { ids: Array.from({ length: 501 }, () => ID) })).success).toBe(false)
    await dispatch('mcp:rotateToken', undefined)
    expect(rotate).toHaveBeenCalledOnce()
  })
})
