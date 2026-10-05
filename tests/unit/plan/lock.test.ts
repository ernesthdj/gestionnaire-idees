import { describe, expect, it } from 'vitest'
import { assertUnlocked, LOCKED_MESSAGE } from '../../../src/main/domain/plan/lock'

describe('garde de verrou (spec 011)', () => {
  it('should_let_an_unlocked_node_be_written', () => {
    expect(() => assertUnlocked({ lockedAt: null })).not.toThrow()
  })

  it('should_refuse_with_the_reason_when_the_node_is_locked', () => {
    expect(() => assertUnlocked({ lockedAt: '2026-10-05T10:00:00.000Z' })).toThrow(
      expect.objectContaining({ code: 'LOCKED', message: LOCKED_MESSAGE })
    )
  })
})
