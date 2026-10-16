import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AGENT_DRAG_TYPE, AgentTray } from '../../../src/renderer/src/canvas/agents/AgentTray'
import type { AgentProfileView } from '../../../src/shared/agents/profile'
import { expectNoAxeViolations } from '../../support/axe'

const profile = (id: string, name: string): AgentProfileView => ({
  id,
  name,
  role: 'backend',
  instructions: '',
  permissionMode: 'default',
  model: 'claude-sonnet-5-5',
  effort: 'medium',
  skills: [],
  updatedAt: 0,
  delivered: 0
})
const PROFILES = [
  profile('11111111-1111-4111-8111-111111111111', 'Thor'),
  profile('22222222-2222-4222-8222-222222222222', 'Qualité')
]

describe('tiroir « Appeler un agent » (L1o D26, T030)', () => {
  it('should_list_identity_cards_that_can_be_dragged_or_clicked_when_opened_in_the_void', async () => {
    const onPick = vi.fn()
    const { container } = render(
      <AgentTray at={{ x: 10, y: 10 }} mode="place" profiles={PROFILES} onPick={onPick} onClose={() => undefined} />
    )
    expect(screen.getByRole('dialog', { name: 'Appeler un agent' })).toBeDefined()
    const thor = screen.getByRole('button', { name: 'Poser Thor' })
    expect(thor.getAttribute('draggable')).toBe('true')
    const setData = vi.fn()
    fireEvent.dragStart(thor, { dataTransfer: { setData, effectAllowed: '' } })
    expect(setData).toHaveBeenCalledWith(AGENT_DRAG_TYPE, PROFILES[0]?.id)
    fireEvent.click(thor)
    expect(onPick).toHaveBeenCalledWith(PROFILES[0])
    await expectNoAxeViolations(container)
  })

  it('should_connect_on_click_and_close_on_escape_when_opened_on_a_node', () => {
    const onPick = vi.fn()
    const onClose = vi.fn()
    render(
      <AgentTray
        at={{ x: 10, y: 10 }}
        mode="connect"
        title="T002 · Trier"
        profiles={PROFILES}
        onPick={onPick}
        onClose={onClose}
      />
    )
    const qa = screen.getByRole('button', { name: 'Connecter Qualité' })
    expect(qa.getAttribute('draggable')).toBe('false')
    fireEvent.click(qa)
    expect(onPick).toHaveBeenCalledWith(PROFILES[1])
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Connecter un agent à « T002 · Trier »' }), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
