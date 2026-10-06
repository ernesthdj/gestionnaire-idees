import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { EditorSettings } from '../../../src/renderer/src/pages/settings/EditorSettings'
import type { EditorSettingsView } from '../../../src/shared/ipc/finals'
import { expectNoAxeViolations } from '../../support/axe'
import { FakeIpcError, installFakeApi } from './support/fakeApi'

const NONE: EditorSettingsView = { current: null, detected: [{ kind: 'vscode', name: 'VS Code' }] }

function renderSettings(handlers: Parameters<typeof installFakeApi>[0]) {
  const api = installFakeApi(handlers)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(
    <QueryClientProvider client={client}>
      <EditorSettings />
    </QueryClientProvider>
  )
  return { api, ...result }
}

describe('Réglages › Éditeur (spec 013 D4)', () => {
  it('should_choose_a_detected_editor_and_show_its_program', async () => {
    const user = userEvent.setup()
    const { api, container } = renderSettings({
      'editor:get': () => NONE,
      'editor:choose': () => ({ ...NONE, current: { kind: 'vscode', program: 'C:/VS Code/Code.exe' } })
    })
    expect(await screen.findByText('Aucun éditeur réglé.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'VS Code' }))
    expect(api.invoke).toHaveBeenCalledWith('editor:choose', { choice: 'vscode' })
    expect(await screen.findByText('C:/VS Code/Code.exe')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('Éditeur enregistré.')
    await expectNoAxeViolations(container)
  })

  it('should_offer_the_native_dialog_and_report_a_refused_program', async () => {
    const user = userEvent.setup()
    const { api } = renderSettings({
      'editor:get': () => ({ current: null, detected: [] }),
      'editor:choose': () => {
        throw new FakeIpcError('VALIDATION')
      }
    })
    expect(await screen.findByText(/Ni VS Code ni Notepad\+\+/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Autre éditeur…' }))
    expect(api.invoke).toHaveBeenCalledWith('editor:choose', { choice: 'browse' })
    expect((await screen.findByRole('status')).textContent).not.toBe('')
  })
})
