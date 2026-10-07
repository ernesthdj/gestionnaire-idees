import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RemoveIdeasDialog } from '../../../src/renderer/src/canvas/RemoveIdeasDialog'
import { expectNoAxeViolations } from '../../support/axe'

const ideas = (count: number): { id: string; title: string }[] =>
  Array.from({ length: count }, (_, index) => ({ id: `n${index}`, title: `Idée ${index + 1}` }))

describe('confirmation de suppression de plusieurs idées', () => {
  it('should_ask_once_for_all_selected_ideas_and_focus_keep_when_opened', async () => {
    const onConfirm = vi.fn(async () => true)
    const onClose = vi.fn()
    const { container } = render(<RemoveIdeasDialog ideas={ideas(7)} onConfirm={onConfirm} onClose={onClose} />)
    expect(screen.getByRole('alertdialog', { name: 'Supprimer 7 idées ?' })).toBeTruthy()
    expect(screen.getByText('et 2 autres')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Garder' }))
    await expectNoAxeViolations(container)
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('should_close_without_removing_when_escape_is_pressed', () => {
    const onConfirm = vi.fn(async () => true)
    const onClose = vi.fn()
    render(<RemoveIdeasDialog ideas={ideas(1)} onConfirm={onConfirm} onClose={onClose} />)
    expect(screen.getByRole('alertdialog', { name: 'Supprimer « Idée 1 » ?' })).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
