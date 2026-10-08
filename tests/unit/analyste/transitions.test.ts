import { describe, expect, it } from 'vitest'
import { nextStatus } from '../../../src/main/domain/analyste/transitions'

describe('transitions d’une proposition (spec 019 T025, D10)', () => {
  it('should_allow_triage_decisions_from_the_states_of_the_data_model', () => {
    expect(nextStatus('new', 'accept')).toBe('accepted')
    expect(nextStatus('postponed', 'accept')).toBe('accepted')
    expect(nextStatus('new', 'refuse')).toBe('refused')
    expect(nextStatus('new', 'postpone')).toBe('postponed')
    expect(nextStatus('postponed', 'resume')).toBe('new')
    expect(nextStatus('refused', 'resume')).toBe('new')
  })

  it('should_mark_as_applied_outside_the_app_only_before_any_update', () => {
    expect(nextStatus('new', 'applied')).toBe('applied')
    expect(nextStatus('postponed', 'applied')).toBe('applied')
    expect(nextStatus('accepted', 'applied')).toBe('applied')
    for (const status of [
      'coding',
      'to_fix',
      'ready',
      'kept',
      'refused',
      'discarded',
      'reverted',
      'applied'
    ] as const) {
      expect(nextStatus(status, 'applied')).toBeNull()
    }
  })

  it('should_refuse_any_other_transition', () => {
    expect(nextStatus('accepted', 'refuse')).toBeNull()
    expect(nextStatus('kept', 'resume')).toBeNull()
    expect(nextStatus('postponed', 'postpone')).toBeNull()
    expect(nextStatus('coding', 'accept')).toBeNull()
  })
})
