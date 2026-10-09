import { describe, expect, it, vi } from 'vitest'
import { createDispatcher } from '../../../src/main/ipc/registry'
import { createGitRoutes } from '../../../src/main/ipc/gitHandlers'

const ID = '00000000-0000-4000-8000-000000000b21'

function setup() {
  const git = {
    status: vi.fn(async () => ({ state: 'ok' })),
    diff: vi.fn(async () => ({ hunks: [] })),
    stage: vi.fn(async () => ({ state: 'ok' })),
    unstage: vi.fn(async () => ({ state: 'ok' })),
    proposeMessage: vi.fn(async () => ({ message: '', groups: [], offFormat: false })),
    commit: vi.fn(async () => ({ hash: 'a'.repeat(40), branch: 'main' })),
    branches: vi.fn(async () => ({ current: 'main', detached: false, local: [], remote: [] })),
    createBranch: vi.fn(async () => ({ state: 'ok' })),
    switchBranch: vi.fn(async () => ({ state: 'ok' })),
    log: vi.fn(async () => ({ commits: [], authors: [] })),
    revert: vi.fn(async () => ({ hash: 'b'.repeat(40) }))
  }
  return { git, dispatch: createDispatcher(createGitRoutes(git as never)) }
}

describe('canaux git:* (spec 021 T015)', () => {
  it('should_accept_only_a_genesis_relative_paths_and_confirmed_writes', async () => {
    const { git, dispatch } = setup()
    expect(await dispatch('git:status', { genesisId: ID })).toMatchObject({ success: true })
    expect(await dispatch('git:status', { genesisId: ID, dir: 'C:/' })).toMatchObject({ success: false })
    expect(await dispatch('git:stage', { genesisId: ID, paths: ['src/a.ts'] })).toMatchObject({ success: true })
    for (const path of ['C:/Windows/win.ini', '../dehors', '--force', '/etc/passwd']) {
      expect(await dispatch('git:stage', { genesisId: ID, paths: [path] }), path).toMatchObject({ success: false })
    }
    expect(await dispatch('git:commit', { genesisId: ID, message: 'feat: x', expectedStaged: ['a.ts'] })).toMatchObject(
      {
        success: false
      }
    )
    expect(
      await dispatch('git:commit', { genesisId: ID, message: 'feat: x', expectedStaged: ['a.ts'], confirm: true })
    ).toMatchObject({ success: true })
    expect(await dispatch('git:switchBranch', { genesisId: ID, name: '--force' })).toMatchObject({ success: false })
    expect(
      await dispatch('git:revert', { genesisId: ID, hash: 'HEAD', expectedHead: 'a1b2c3d', confirm: true })
    ).toMatchObject({
      success: false
    })
    expect(await dispatch('git:log', { genesisId: ID, limit: 51 })).toMatchObject({ success: false })
    expect(git.stage).toHaveBeenCalledTimes(1)
    expect(git.commit).toHaveBeenCalledWith(ID, 'feat: x', ['a.ts'])
  })
})
