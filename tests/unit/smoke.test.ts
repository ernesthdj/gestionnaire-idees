import { describe, expect, it } from 'vitest'
import type { AppApi } from '@shared/app-api'

describe('squelette', () => {
  it('should_resolve_shared_alias_when_running_tests', () => {
    const api: AppApi = { platform: 'win32' }
    expect(api.platform).toBe('win32')
  })
})
