import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAPPING_DONE_MS, useMapping, useMappingWatch } from '../../../src/renderer/src/canvas/mapping/mappingStore'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { installFakeApi } from './support/fakeApi'

function Watcher(): null {
  useMappingWatch()
  return null
}

describe('cartographie d’un projet (spec 022)', () => {
  afterEach(() => {
    vi.useRealTimers()
    useMapping.setState({ phases: {} })
  })

  it('should_end_a_running_mapping_as_done_then_clear_it_when_the_turn_ends', () => {
    vi.useFakeTimers()
    const api = installFakeApi({})
    render(<Watcher />)
    act(() => useMapping.getState().start('g1'))
    act(() => api.emit('chat:turnEnd', { neuronId: 'g1', message: null, interrupted: false }))
    expect(useMapping.getState().phases['g1']).toBe('done')
    expect(useUiStore.getState().toast?.text).toMatch(/Cartographie terminée/)
    act(() => vi.advanceTimersByTime(MAPPING_DONE_MS))
    expect(useMapping.getState().phases['g1']).toBeUndefined()
  })

  it('should_mark_the_mapping_interrupted_when_the_turn_is_stopped_or_fails', () => {
    const api = installFakeApi({})
    render(<Watcher />)
    act(() => useMapping.getState().start('g1'))
    act(() => api.emit('chat:turnEnd', { neuronId: 'g1', message: null, interrupted: true }))
    expect(useMapping.getState().phases['g1']).toBe('failed')
    act(() => useMapping.getState().start('g2'))
    act(() => api.emit('chat:error', { neuronId: 'g2', code: 'CLI_FAILED', message: {}, resetsAt: null }))
    expect(useMapping.getState().phases['g2']).toBe('failed')
  })

  it('should_ignore_turns_of_other_conversations_when_no_mapping_runs', () => {
    const api = installFakeApi({})
    render(<Watcher />)
    act(() => api.emit('chat:turnEnd', { neuronId: 'other', message: null, interrupted: false }))
    expect(useMapping.getState().phases).toEqual({})
    expect(screen.queryByRole('status')).toBeNull()
  })
})
