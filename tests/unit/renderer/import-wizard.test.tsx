import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ImportWizard } from '../../../src/renderer/src/reprise/ImportWizard'
import type { ImportPreviewView } from '../../../src/shared/ipc/reprise'
import { expectNoAxeViolations } from '../../support/axe'
import { FakeIpcError, installFakeApi } from './support/fakeApi'

const PREVIEW_ID = '00000000-0000-4000-8000-0000000000f1'
const GENESIS = '00000000-0000-4000-8000-0000000000f2'

const preview = (extra: Partial<ImportPreviewView> = {}): ImportPreviewView => ({
  previewId: PREVIEW_ID,
  name: 'laravel-app',
  languages: [{ lang: 'php', files: 5 }],
  files: 7,
  ignored: 3,
  sensitive: 1,
  git: false,
  tooLarge: false,
  alreadyLinked: null,
  ...extra
})

function renderWizard(handlers: Parameters<typeof installFakeApi>[0]) {
  const api = installFakeApi(handlers)
  const onImported = vi.fn()
  const onClose = vi.fn()
  const result = render(<ImportWizard onClose={onClose} onImported={onImported} />)
  return { api, onImported, onClose, ...result }
}

describe('assistant « Reprendre un projet existant » (spec 017 US1)', () => {
  it('should_show_the_preview_and_import_only_after_choosing_a_confidentiality', async () => {
    const user = userEvent.setup()
    const { api, onImported, container } = renderWizard({
      'reprise:previewFolder': () => preview(),
      'reprise:create': () => ({ genesisId: GENESIS })
    })
    await user.click(screen.getByRole('button', { name: 'Choisir le dossier du projet…' }))
    const summary = await screen.findByRole('region', { name: 'Aperçu du projet' })
    expect(summary.textContent).toContain('« laravel-app »')
    expect(summary.textContent).toContain('PHP (5)')
    expect(summary.textContent).toContain('1 fichier sensible (secrets, clés) ignoré : jamais lu')
    const importer = screen.getByRole('button', { name: 'Importer' })
    expect(importer).toHaveProperty('disabled', true)
    // Aucun niveau présélectionné (spec 017 FR-003).
    expect(screen.getAllByRole('radio').map((radio) => (radio as HTMLInputElement).checked)).toEqual([false, false])
    await expectNoAxeViolations(container)
    await user.click(screen.getByRole('radio', { name: /Local uniquement/ }))
    expect(importer).toHaveProperty('disabled', false)
    await user.click(importer)
    expect(api.invoke).toHaveBeenCalledWith('reprise:create', { previewId: PREVIEW_ID, confidentiality: 'local' })
    expect(onImported).toHaveBeenCalledWith(GENESIS)
  })

  it('should_block_the_import_of_a_folder_already_linked_or_too_large', async () => {
    const user = userEvent.setup()
    renderWizard({ 'reprise:previewFolder': () => preview({ alreadyLinked: GENESIS }) })
    await user.click(screen.getByRole('button', { name: 'Choisir le dossier du projet…' }))
    expect((await screen.findByRole('alert')).textContent).toContain('déjà lié à un neurone')
    expect(screen.queryByRole('radio')).toBeNull()
    expect(screen.getByRole('button', { name: 'Importer' })).toHaveProperty('disabled', true)
  })

  it('should_explain_a_refused_folder_and_close_on_escape', async () => {
    const user = userEvent.setup()
    const { onClose } = renderWizard({
      'reprise:previewFolder': () => {
        throw new FakeIpcError('FOLDER_REFUSED')
      }
    })
    await user.click(screen.getByRole('button', { name: 'Choisir le dossier du projet…' }))
    expect((await screen.findByRole('alert')).textContent).toBe('FOLDER_REFUSED')
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('should_stay_on_the_source_step_when_the_picker_is_cancelled', async () => {
    const user = userEvent.setup()
    renderWizard({ 'reprise:previewFolder': () => null })
    await user.click(screen.getByRole('button', { name: 'Choisir le dossier du projet…' }))
    expect(screen.queryByRole('region', { name: 'Aperçu du projet' })).toBeNull()
  })
})
