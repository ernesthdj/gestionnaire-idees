import { describe, expect, it } from 'vitest'
import { isMainWindowChannel } from '@shared/ipc/channels'

describe('squelette', () => {
  it('should_resolve_shared_alias_when_running_tests', () => {
    expect(isMainWindowChannel('app:ping')).toBe(true)
  })

  it('should_reject_channel_when_not_whitelisted', () => {
    expect(isMainWindowChannel('fs:readFile')).toBe(false)
  })
})
