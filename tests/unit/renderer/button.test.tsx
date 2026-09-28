import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from '../../../src/renderer/src/components/atoms/Button'
import { expectNoAxeViolations } from '../../support/axe'

describe('Button', () => {
  it('should_render_a_non_submitting_button_when_no_type_is_given', () => {
    render(<Button>Enregistrer</Button>)
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toHaveProperty('type', 'button')
  })

  it('should_have_no_accessibility_violation_when_labelled', async () => {
    const { container } = render(<Button variant="primary">Enregistrer</Button>)
    await expectNoAxeViolations(container)
  })

  it('should_report_a_violation_when_the_button_has_no_accessible_name', async () => {
    const { container } = render(<Button />)
    await expect(expectNoAxeViolations(container)).rejects.toThrow(/button-name/)
  })
})
