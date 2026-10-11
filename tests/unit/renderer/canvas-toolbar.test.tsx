import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CanvasToolbar } from '../../../src/renderer/src/canvas/CanvasToolbar'

const noop = (): void => undefined
const props = {
  view: undefined,
  filter: {},
  onFilter: noop,
  onRecenter: noop,
  onReorder: noop,
  analysisLinks: false,
  onToggleAnalysisLinks: noop,
  openCards: 0,
  onCloseCards: noop,
  onAddBlock: noop
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
})
