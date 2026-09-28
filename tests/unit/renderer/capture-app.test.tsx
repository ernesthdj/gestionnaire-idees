import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CaptureApp, CONFIRMATION_MS, DRAFT_DEBOUNCE_MS } from '../../../src/renderer/src/capture/CaptureApp'
import type { CaptureApi } from '../../../src/shared/app-api'
import type { CaptureWindowChannel } from '../../../src/shared/ipc/channels'
import type { IpcResult } from '../../../src/shared/ipc/result'
import { expectNoAxeViolations } from '../../support/axe'

function installCaptureApi(options: { draft?: string; submitFails?: boolean } = {}) {
  let draft = options.draft ?? ''
  const listeners = new Set<(payload: unknown) => void>()
  const invoke = vi.fn(async (channel: CaptureWindowChannel, payload?: unknown): Promise<IpcResult<unknown>> => {
    switch (channel) {
      case 'capture:getDraft':
        return { success: true, data: { text: draft } }
      case 'capture:saveDraft':
        draft = (payload as { text: string }).text
        return { success: true, data: { ok: true } }
      case 'capture:submit':
        return options.submitFails === true
          ? { success: false, error: { code: 'INTERNAL', message: 'Erreur interne' } }
          : { success: true, data: { rootId: 'r1' } }
      case 'capture:close':
        return { success: true, data: { ok: true } }
    }
  })
  const api: CaptureApi = {
    invoke: invoke as CaptureApi['invoke'],
    on: (_event, listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
  Object.defineProperty(window, 'captureApi', { value: api, configurable: true })
  return {
    invoke,
    draft: () => draft,
    show: (payload: unknown) => listeners.forEach((listener) => listener(payload)),
    calls: (channel: CaptureWindowChannel) => invoke.mock.calls.filter(([name]) => name === channel)
  }
}

async function renderCapture(options?: Parameters<typeof installCaptureApi>[0]) {
  const api = installCaptureApi(options)
  const user = userEvent.setup(vi.isFakeTimers() ? { advanceTimers: vi.advanceTimersByTime.bind(vi) } : {})
  render(<CaptureApp />)
  const input = screen.getByRole('textbox', { name: 'Ton idée' })
  await waitFor(() => expect(document.activeElement).toBe(input))
  return { api, user, input: input as HTMLTextAreaElement }
}

describe('CaptureApp', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('should_create_the_idea_confirm_and_close_when_enter_is_pressed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { api, user, input } = await renderCapture()
    await user.type(input, 'Acheter un flash{Enter}')
    expect(api.calls('capture:submit')[0]?.[1]).toEqual({ text: 'Acheter un flash', diveNow: false })
    expect(screen.getByRole('status').textContent).toBe('✓ Idée notée')
    expect(input.value).toBe('')
    act(() => vi.advanceTimersByTime(CONFIRMATION_MS))
    expect(api.calls('capture:close')).toHaveLength(1)
  })

  it('should_insert_a_new_line_when_shift_enter_is_pressed', async () => {
    const { api, user, input } = await renderCapture()
    await user.type(input, 'Titre{Shift>}{Enter}{/Shift}détail')
    expect(input.value).toBe('Titre\ndétail')
    expect(api.calls('capture:submit')).toHaveLength(0)
  })

  it('should_create_and_ask_for_the_dive_when_ctrl_enter_is_pressed', async () => {
    const { api, user, input } = await renderCapture()
    await user.type(input, 'Portfolio{Control>}{Enter}{/Control}')
    expect(api.calls('capture:submit')[0]?.[1]).toEqual({ text: 'Portfolio', diveNow: true })
    // Le main ferme la capture lui-même en ouvrant la plongée.
    expect(api.calls('capture:close')).toHaveLength(0)
  })

  it('should_close_and_keep_the_text_as_draft_when_escape_is_pressed', async () => {
    const { api, user, input } = await renderCapture()
    await user.type(input, 'À finir{Escape}')
    expect(api.calls('capture:close')).toHaveLength(1)
    expect(api.draft()).toBe('À finir')
    expect(api.calls('capture:submit')).toHaveLength(0)
  })

  it('should_save_the_draft_immediately_when_the_window_loses_focus', async () => {
    const { api, user, input } = await renderCapture()
    await user.type(input, 'Vite')
    act(() => input.blur())
    expect(api.draft()).toBe('Vite')
  })

  it('should_not_restore_a_submitted_idea_as_draft_when_focus_is_lost_during_submission', async () => {
    const { api, user, input } = await renderCapture()
    await user.type(input, 'Envoyée')
    // Le main cache la fenêtre (perte de focus) avant de répondre à l'envoi.
    api.invoke.mockImplementationOnce(async () => {
      act(() => input.blur())
      return { success: true, data: { rootId: 'r1' } }
    })
    await user.keyboard('{Control>}{Enter}{/Control}')
    expect(api.calls('capture:saveDraft').map(([, payload]) => payload)).not.toContainEqual({ text: 'Envoyée' })
  })

  it('should_ignore_enter_when_the_text_is_blank', async () => {
    const { api, user, input } = await renderCapture()
    await user.type(input, '   {Enter}')
    expect(api.calls('capture:submit')).toHaveLength(0)
  })

  it('should_restore_the_draft_and_save_it_while_typing', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { api, user, input } = await renderCapture({ draft: 'Brouillon' })
    await waitFor(() => expect(input.value).toBe('Brouillon'))
    await user.type(input, ' suite')
    act(() => vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS))
    expect(api.draft()).toBe('Brouillon suite')
  })

  it('should_show_the_counter_and_limit_the_text_to_2000_characters', async () => {
    const { input } = await renderCapture({ draft: 'abc' })
    await waitFor(() => expect(screen.getByLabelText('3 caractères sur 2000')).toBeDefined())
    expect(input.maxLength).toBe(2000)
  })

  it('should_keep_the_text_and_explain_when_the_idea_cannot_be_saved', async () => {
    const { user, input } = await renderCapture({ submitFails: true })
    await user.type(input, 'Idée{Enter}')
    expect(input.value).toBe('Idée')
    expect(screen.getByRole('status').textContent).toMatch(/n'a pas pu être notée/)
  })

  it('should_reload_the_draft_and_apply_the_theme_when_shown_again', async () => {
    const { api } = await renderCapture()
    await act(async () => {
      await api.invoke('capture:saveDraft', { text: 'Repris' })
      api.show({ theme: 'dark' })
    })
    await waitFor(() => expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Repris'))
    expect(document.documentElement.dataset['theme']).toBe('dark')
  })

  it('should_have_no_accessibility_violation', async () => {
    await renderCapture()
    await expectNoAxeViolations(document.body)
  })
})
