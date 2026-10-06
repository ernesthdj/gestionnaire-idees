import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ClaudeCodeSettings } from '../../../src/renderer/src/pages/settings/claude/ClaudeCodeSettings'
import { DEFAULT_APP_SETTINGS, type AppSettingsView } from '../../../src/shared/ipc/app'
import { expectNoAxeViolations } from '../../support/axe'
import { installFakeApi } from './support/fakeApi'

function renderSettings() {
  let stored: AppSettingsView = { ...DEFAULT_APP_SETTINGS }
  const api = installFakeApi({
    'mcp:status': () => ({ listening: true, clients: 0, command: 'claude mcp add brainstormer …' }),
    'app:getSettings': () => stored,
    'app:setSettings': (patch) => (stored = { ...stored, ...(patch as Partial<AppSettingsView>) })
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(
    <QueryClientProvider client={client}>
      <ClaudeCodeSettings />
    </QueryClientProvider>
  )
  return { api, ...result }
}

describe('Réglages › Claude Code : mode des nouvelles conversations (spec 014 US2, D8)', () => {
  it('should_save_the_default_mode_of_new_conversations_when_chosen', async () => {
    const user = userEvent.setup()
    const { api, container } = renderSettings()
    const ask = (await screen.findByRole('radio', { name: /^Demander/ })) as HTMLInputElement
    expect(ask.checked).toBe(true)
    await user.click(screen.getByRole('radio', { name: /^Accepter les modifications/ }))
    expect(api.invoke).toHaveBeenCalledWith('app:setSettings', { chatPermissionMode: 'acceptEdits' })
    expect((await screen.findByRole('status')).textContent).toBe(
      'Les nouvelles conversations démarreront en « Accepter les modifications ».'
    )
    expect(ask.checked).toBe(false)
    await expectNoAxeViolations(container)
  })

  it('should_not_offer_libre_as_a_default_mode', async () => {
    renderSettings()
    await screen.findByRole('radio', { name: /^Demander/ })
    expect(screen.getAllByRole('radio')).toHaveLength(2)
    expect(screen.queryByRole('radio', { name: /Libre/ })).toBeNull()
  })
})
