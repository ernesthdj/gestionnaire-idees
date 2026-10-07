import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { App } from '../../../src/renderer/src/App'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { DEFAULT_APP_SETTINGS, type AppSettingsView } from '../../../src/shared/ipc/app'
import { expectNoAxeViolations } from '../../support/axe'
import { emptyCanvasView } from '../../fixtures/ui/canvas'
import { installFakeApi } from './support/fakeApi'
import { installReactFlowMocks } from './support/reactFlowMocks'

function renderApp(settings: Partial<AppSettingsView> = {}) {
  // Canaux non simulés (réglages IA) : ils échouent, comme un canal indisponible.
  const api = installFakeApi({
    'app:getSettings': () => ({ ...DEFAULT_APP_SETTINGS, ...settings }),
    'canvas:get': () => emptyCanvasView()
  })
  return { api, ...render(<App />) }
}

describe('AppShell', () => {
  beforeAll(() => installReactFlowMocks())
  beforeEach(() => {
    useUiStore.setState({ view: 'ideas' })
  })

  it('should_show_the_three_sections_and_settings_with_ideas_selected_when_opened', () => {
    renderApp()
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' })
    expect(nav).toBeDefined()
    for (const label of ['Idées', 'À valider', 'Historique'])
      expect(screen.getByRole('button', { name: label })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Idées' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: 'Réglages' })).toBeDefined()
  })

  it('should_reach_every_navigation_item_and_open_it_when_using_the_keyboard_only', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Idées' }))
    await user.tab()
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Historique' }))
    await user.keyboard('{Enter}')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Historique')
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Skills' }))
    // Le choix du thème (3 boutons) précède les réglages dans l'en-tête.
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Thème du système' }))
    await user.tab()
    await user.tab()
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Réglages' }))
    await user.keyboard(' ')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Réglages')
  })

  it('should_open_the_requested_section_when_the_main_process_asks_to_navigate', () => {
    const { api } = renderApp()
    act(() => api.emit('app:navigate', { section: 'pending' }))
    expect(screen.getByRole('button', { name: 'À valider' }).getAttribute('aria-current')).toBe('page')
  })

  it('should_ignore_a_malformed_navigation_event', () => {
    const { api } = renderApp()
    act(() => api.emit('app:navigate', { section: 'admin' }))
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Idées')
  })

  it('should_apply_the_stored_theme_and_motion_preference_when_settings_load', async () => {
    const { container } = renderApp({ theme: 'dark', motion: 'reduced' })
    await waitFor(() => expect(document.documentElement.dataset['theme']).toBe('dark'))
    expect(container.querySelector('[data-reduced-motion="true"]')).not.toBeNull()
  })

  it.each(['light', 'dark'] as const)('should_have_no_accessibility_violation_in_%s_theme', async (theme) => {
    const { container } = renderApp({ theme })
    await waitFor(() => expect(document.documentElement.dataset['theme']).toBe(theme))
    await expectNoAxeViolations(container)
  })

  it('should_show_the_analyst_entry_only_when_the_probe_is_active', async () => {
    const status = { available: true, repoPath: null, observations: 0, dropped: 0 }
    installFakeApi({
      'app:getSettings': () => DEFAULT_APP_SETTINGS,
      'canvas:get': () => emptyCanvasView(),
      'analyste:repo:status': () => ({ ...status, active: false, reason: 'NOT_DESIGNATED' })
    })
    const { unmount } = render(<App />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Historique' })).toBeDefined())
    expect(screen.queryByRole('button', { name: 'Analyste' })).toBeNull()
    unmount()
    installFakeApi({
      'app:getSettings': () => DEFAULT_APP_SETTINGS,
      'canvas:get': () => emptyCanvasView(),
      'analyste:repo:status': () => ({ ...status, active: true, reason: null })
    })
    render(<App />)
    expect(await screen.findByRole('button', { name: 'Analyste' })).toBeDefined()
  })
})
