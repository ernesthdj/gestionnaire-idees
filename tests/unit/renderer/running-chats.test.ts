import { afterEach, describe, expect, it, vi } from 'vitest'
import { useRunningChats, watchRunningChats } from '../../../src/renderer/src/canvas/workflow/runningChats'

describe('conversations en train de répondre (spec 023 D21)', () => {
  const listeners = new Map<string, (payload: unknown) => void>()

  afterEach(() => {
    listeners.clear()
    useRunningChats.setState({ running: new Set() })
  })

  it('should_mark_a_chat_running_from_its_first_text_until_the_end_of_its_turn_or_an_error', () => {
    vi.stubGlobal('api', {
      on: (event: string, listener: (payload: unknown) => void) => {
        listeners.set(event, listener)
        return () => listeners.delete(event)
      }
    })
    const stop = watchRunningChats()
    const emit = (event: string, payload: unknown): void => listeners.get(event)?.(payload)
    emit('chat:delta', { neuronId: 'n1', text: 'Je commence' })
    emit('chat:tool', { neuronId: 'n2' })
    expect([...useRunningChats.getState().running]).toEqual(['n1', 'n2'])
    emit('chat:turnEnd', { neuronId: 'n1' })
    emit('chat:error', { neuronId: 'n2' })
    emit('chat:delta', { text: 'sans neurone' })
    expect(useRunningChats.getState().running.size).toBe(0)
    stop()
    expect(listeners.size).toBe(0)
    vi.unstubAllGlobals()
  })
})
