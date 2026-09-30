import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ThemeSwitch } from '../../../src/renderer/src/app/ThemeSwitch'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { DEFAULT_APP_SETTINGS } from '../../../src/shared/ipc/app'
import { expectNoAxeViolations } from '../../support/axe'
import { installFakeApi } from './support/fakeApi'

function renderSwitch(handlers: Parameters<typeof installFakeApi>[0]) {
  const api = installFakeApi({ 'app:getSettings': () => DEFAULT_APP_SETTINGS, ...handlers })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(
    <QueryClientProvider client={client}>
      <ThemeSwitch />
    </QueryClientProvider>
  )
  return { api, ...result }
}

describe('choix du thème dans l’en-tête', () => {
  it('should_show_the_system_theme_as_selected_when_nothing_was_chosen', async () => {
    renderSwitch({})
    expect((await screen.findByRole('button', { name: 'Thème du système' })).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Thème sombre' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('should_save_and_select_the_dark_theme_when_it_is_chosen', async () => {
    const { api } = renderSwitch({ 'app:setSettings': () => ({ ...DEFAULT_APP_SETTINGS, theme: 'dark' }) })
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Thème sombre' }))
    expect(api.invoke).toHaveBeenCalledWith('app:setSettings', { theme: 'dark' })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Thème sombre' }).getAttribute('aria-pressed')).toBe('true')
    )
  })

  it('should_not_call_the_main_process_when_the_current_theme_is_chosen_again', async () => {
    const { api } = renderSwitch({})
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Thème du système' }))
    expect(api.invoke).not.toHaveBeenCalledWith('app:setSettings', expect.anything())
  })

  it('should_keep_the_theme_and_explain_when_saving_fails', async () => {
    renderSwitch({
      'app:setSettings': () => {
        throw new Error('panne')
      }
    })
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Thème clair' }))
    await waitFor(() => expect(useUiStore.getState().toast).not.toBeNull())
    expect(screen.getByRole('button', { name: 'Thème du système' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('should_have_no_accessibility_violation', async () => {
    const { container } = renderSwitch({})
    await screen.findByRole('button', { name: 'Thème clair' })
    await expectNoAxeViolations(container)
  })
})
