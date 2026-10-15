import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CanvasToolbar } from '../../../src/renderer/src/canvas/CanvasToolbar'
import { expectNoAxeViolations } from '../../support/axe'

const noop = (): void => undefined
const props = {
  view: undefined,
  filter: {},
  onFilter: noop,
  onRecenter: noop,
  onReorder: noop,
  openCards: 0,
  onCloseCards: noop
}

/** Barre du canevas : « Reprendre un projet existant » seulement hors du canevas d'un projet (audit 2026-10-11). */
describe('barre du canevas', () => {
  it('should_offer_to_resume_a_project_when_the_canvas_has_no_project', () => {
    render(<CanvasToolbar {...props} onImport={noop} />)
    expect(screen.getByRole('button', { name: 'Reprendre un projet existant' })).toBeDefined()
  })

  it('should_hide_resume_a_project_when_the_canvas_belongs_to_a_project', () => {
    render(<CanvasToolbar {...props} />)
    expect(screen.queryByRole('button', { name: 'Reprendre un projet existant' })).toBeNull()
  })

  it('should_unfold_the_search_and_the_filters_from_the_dock_with_short_labels', async () => {
    const user = userEvent.setup()
    const { container } = render(<CanvasToolbar {...props} openCards={2} />)
    expect(screen.getByRole('toolbar', { name: 'Outils de la carte' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Recentrer' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Fermer les cartes (2)' })).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'Rechercher une idée' }))
    expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Rechercher une idée' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('searchbox')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Filtrer (nature, catégorie)' }))
    expect(screen.getByLabelText('Filtrer par catégorie')).toBeDefined()
    await expectNoAxeViolations(container)
  })
})
