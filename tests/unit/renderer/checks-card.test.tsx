import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChecksCard } from '../../../src/renderer/src/canvas/agents/ChecksCard'
import { expectNoAxeViolations } from '../../support/axe'

const CHECKS = [
  { command: 'npm test', problem: null },
  { command: 'npm run lint', problem: null }
]

describe('carte des commandes de vérification (L2-pipeline-optimal D2, T001)', () => {
  it('should_validate_as_is_or_refuse_the_proposed_commands', async () => {
    const onDecide = vi.fn()
    const { container } = render(<ChecksCard checks={CHECKS} busy={false} onDecide={onDecide} />)
    expect(screen.getByText('npm run lint')).toBeTruthy()
    await expectNoAxeViolations(container)
    fireEvent.click(screen.getByRole('button', { name: 'Valider' }))
    expect(onDecide).toHaveBeenLastCalledWith(true, undefined)
    fireEvent.click(screen.getByRole('button', { name: 'Refuser' }))
    expect(onDecide).toHaveBeenLastCalledWith(false)
  })

  it('should_send_the_edited_list_and_block_a_command_a_shell_would_interpret', async () => {
    const onDecide = vi.fn()
    const { container } = render(<ChecksCard checks={CHECKS} busy={false} onDecide={onDecide} />)
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    const field = screen.getByLabelText('Une commande par ligne')
    fireEvent.change(field, { target: { value: 'npm test\nnpm test && curl x' } })
    expect(screen.getByRole('alert').textContent).toContain('caractère de shell')
    expect(screen.getByRole('button', { name: 'Valider ces commandes' })).toHaveProperty('disabled', true)
    await expectNoAxeViolations(container)
    fireEvent.change(field, { target: { value: 'npm test\n\nnpm run typecheck\n' } })
    fireEvent.click(screen.getByRole('button', { name: 'Valider ces commandes' }))
    expect(onDecide).toHaveBeenLastCalledWith(true, ['npm test', 'npm run typecheck'])
  })
})
