import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { SidePanel } from '../../../src/renderer/src/canvas/side/SidePanel'
import { useSidePanel } from '../../../src/renderer/src/canvas/side/sidePanelStore'
import { clampWidth, widthAfterKey, widthAt } from '../../../src/renderer/src/canvas/side/panelWidth'
import { DEFAULT_APP_SETTINGS, type AppSettingsView } from '../../../src/shared/ipc/app'
import { expectNoAxeViolations } from '../../support/axe'
import { installFakeApi } from './support/fakeApi'

/** Fenêtre étroite ou non : `matchMedia` de jsdom est simulé par le setup (rien ne correspond par défaut). */
function windowNarrow(narrow: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: narrow && query.includes('max-width'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined
    })
  })
}

function renderPanel(width = 38) {
  let settings: AppSettingsView = { ...DEFAULT_APP_SETTINGS, chatPanelWidth: width }
  const api = installFakeApi({
    'app:getSettings': () => settings,
    'app:setSettings': (patch) => {
      settings = { ...settings, ...(patch as Partial<AppSettingsView>) }
      return settings
    },
    'chat:open': () => ({
      neuronId: 'a',
      title: 'Genesis',
      messages: [],
      sheet: { resume: '', points_cles: [], decisions: [], questions_ouvertes: [], manques: [] },
      maturity: null,
      busy: false,
      partial: '',
      usage: null,
      folder: null
    })
  })
  const result = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SidePanel />
    </QueryClientProvider>
  )
  act(() => useSidePanel.getState().openChat({ nodeId: 'a', neuronId: 'a', title: 'Genesis', kindLabel: '' }))
  return { api, ...result }
}

const handle = (): HTMLElement => screen.getByRole('separator', { name: 'Largeur du panneau' })
const panel = (): HTMLElement => screen.getByRole('complementary', { name: 'Panneau de droite' })

describe('largeur du panneau (spec 027 US5)', () => {
  beforeEach(() => {
    useSidePanel.getState().reset()
    windowNarrow(false)
  })

  it('should_open_at_the_saved_width_with_an_accessible_handle', async () => {
    const { container } = renderPanel(50)
    await waitFor(() => expect(panel().style.width).toBe('50%'))
    expect(handle().getAttribute('aria-valuenow')).toBe('50')
    expect(handle().getAttribute('aria-valuemin')).toBe('25')
    expect(handle().getAttribute('aria-valuemax')).toBe('55')
    await screen.findByRole('region', { name: 'Conversation : Genesis' })
    await expectNoAxeViolations(container)
  })

  it('should_step_by_two_percent_with_arrows_and_save_once_after_a_pause', async () => {
    const { api } = renderPanel()
    await waitFor(() => expect(api.invoke).toHaveBeenCalledWith('app:getSettings', undefined))
    for (let index = 0; index < 3; index += 1) fireEvent.keyDown(handle(), { key: 'ArrowRight' })
    // La largeur suit tout de suite ; l'écriture attend la fin de la suite de touches.
    expect(panel().style.width).toBe('32%')
    expect(api.invoke).not.toHaveBeenCalledWith('app:setSettings', expect.anything())
    await waitFor(() => expect(api.invoke).toHaveBeenCalledWith('app:setSettings', { chatPanelWidth: 32 }))
    expect(api.invoke.mock.calls.filter(([channel]) => channel === 'app:setSettings')).toHaveLength(1)
    fireEvent.keyDown(handle(), { key: 'End' })
    expect(panel().style.width).toBe('55%')
  })

  it('should_lay_the_panel_over_the_map_and_mask_it_without_closing_tabs_when_the_window_is_narrow', async () => {
    windowNarrow(true)
    const { container } = renderPanel()
    expect(panel().className).toContain('side-panel-overlay')
    fireEvent.click(screen.getByRole('button', { name: 'Masquer le panneau' }))
    expect(screen.queryByRole('complementary', { name: 'Panneau de droite' })).toBeNull()
    expect(useSidePanel.getState().tabs).toHaveLength(1)
    await expectNoAxeViolations(container)
    fireEvent.click(screen.getByRole('button', { name: /Panneau \(1\)/ }))
    expect(panel()).toBeDefined()
    // Masqué, il revient de lui-même quand une conversation s'ouvre.
    fireEvent.click(screen.getByRole('button', { name: 'Masquer le panneau' }))
    act(() => useSidePanel.getState().openChat({ nodeId: 'b', neuronId: 'b', title: 'Étape', kindLabel: '' }))
    expect(panel()).toBeDefined()
  })
})

describe('règles de la largeur', () => {
  it('should_clamp_and_round_the_width', () => {
    expect(clampWidth(10)).toBe(25)
    expect(clampWidth(70)).toBe(55)
    expect(clampWidth(40.6)).toBe(41)
  })

  it('should_measure_the_width_from_the_right_edge_of_the_area', () => {
    const area = { left: 200, width: 1000 }
    expect(widthAt(700, area)).toBe(50)
    expect(widthAt(1150, area)).toBe(25)
    expect(widthAt(100, area)).toBe(55)
    expect(widthAt(500, { left: 0, width: 0 })).toBe(38)
  })

  it('should_widen_with_left_narrow_with_right_and_jump_with_home_end', () => {
    expect(widthAfterKey('ArrowLeft', 38)).toBe(40)
    expect(widthAfterKey('ArrowRight', 26)).toBe(25)
    expect(widthAfterKey('Home', 40)).toBe(25)
    expect(widthAfterKey('End', 40)).toBe(55)
    expect(widthAfterKey('a', 40)).toBeNull()
  })
})
