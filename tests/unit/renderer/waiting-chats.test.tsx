import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LivingNode } from '../../../src/renderer/src/canvas/living/LivingNode'
import type { NodeVisual } from '../../../src/renderer/src/canvas/living/nodeVisual'
import { useWaitingChats, watchWaitingChats } from '../../../src/renderer/src/chat/waitingChats'
import { expectNoAxeViolations } from '../../support/axe'

/** Demande de permission en attente signalée sur le nœud de sa conversation (audit 2026-10-11, §5.5). */
describe('conversations qui attendent ton accord', () => {
  const listeners = new Map<string, (payload: unknown) => void>()
  const emit = (event: string, payload: unknown): void => listeners.get(event)?.(payload)
  const sat: NodeVisual = { depth: 2, branch: 3, size: 44, icon: 'step', status: 'todo', orb: false }

  const stubApi = (): void => {
    vi.stubGlobal('api', {
      on: (event: string, listener: (payload: unknown) => void) => {
        listeners.set(event, listener)
        return () => listeners.delete(event)
      }
    })
  }

  afterEach(() => {
    listeners.clear()
    useWaitingChats.setState({ waiting: new Map() })
    vi.unstubAllGlobals()
  })

  it('should_wait_until_every_request_is_decided_or_the_turn_ends', () => {
    stubApi()
    const stop = watchWaitingChats()
    emit('chat:permission', { id: 'r1', neuronId: 'n1', tool: 'Bash' })
    emit('chat:permission', { id: 'r2', neuronId: 'n1', tool: 'Write' })
    emit('chat:permission', { id: 'r3', neuronId: 'n2', tool: 'Bash' })
    emit('chat:permission', { neuronId: 'n3' })
    expect([...useWaitingChats.getState().waiting.keys()]).toEqual(['n1', 'n2'])
    emit('chat:permissionResolved', { neuronId: 'n1', requestId: 'r1', decision: 'allow' })
    expect(useWaitingChats.getState().waiting.has('n1')).toBe(true)
    emit('chat:permissionResolved', { neuronId: 'n1', requestId: 'r2', decision: 'expired' })
    emit('chat:turnEnd', { neuronId: 'n2' })
    expect(useWaitingChats.getState().waiting.size).toBe(0)
    stop()
    expect(listeners.size).toBe(0)
  })

  it('should_show_the_waiting_badge_on_the_node_of_the_conversation_only', async () => {
    const { container } = render(
      <>
        <LivingNode id="n1" title="Socle technique" visual={sat} />
        <LivingNode id="tache" chatId="n2" title="Tâche du workflow" visual={sat} />
        <LivingNode id="n3" title="Autre" visual={sat} />
      </>
    )
    expect(screen.queryByRole('status')).toBeNull()
    act(() => {
      useWaitingChats.getState().add('n1', 'r1')
      useWaitingChats.getState().add('n2', 'r2')
    })
    expect(screen.getAllByRole('status').map((badge) => badge.textContent)).toEqual([
      '⏸ attend ton accord',
      '⏸ attend ton accord'
    ])
    await expectNoAxeViolations(container)
    act(() => useWaitingChats.getState().clear('n1'))
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })
})
