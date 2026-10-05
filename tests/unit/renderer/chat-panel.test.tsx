import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChatPanel, MAP_MESSAGE, OPENING_MESSAGE } from '../../../src/renderer/src/chat/ChatPanel'
import type { ChatView } from '../../../src/shared/ipc/chat'
import { installFakeApi } from './support/fakeApi'

const ID = '00000000-0000-4000-8000-0000000000d1'

const view = (extra: Partial<ChatView> = {}): ChatView => ({
  neuronId: ID,
  title: 'Ouvrir un studio photo',
  messages: [],
  sheet: { resume: '', points_cles: [], decisions: [], questions_ouvertes: [], manques: [] },
  maturity: null,
  busy: false,
  partial: '',
  usage: {
    account: null,
    app: { weekTokens: 0, weekTurns: 0, totalTokens: 0, totalTurns: 0, neuronTokens: 0, neuronTurns: 0 }
  },
  folder: null,
  role: 'genesis',
  elementType: null,
  model: 'claude-opus-5-5',
  modelChoice: null,
  ...extra
})

function renderChatWithContainer(initial: ChatView) {
  installFakeApi({ 'chat:open': () => initial, 'chat:close': () => ({ ok: true }) })
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ChatPanel neuronId={ID} onClose={() => undefined} />
    </QueryClientProvider>
  )
}

function renderChat(initial: ChatView = view()) {
  let current = initial
  const api = installFakeApi({
    'chat:open': () => current,
    'chat:send': () => ({ ok: true }),
    'chat:stop': () => ({ ok: true }),
    'chat:close': () => ({ ok: true }),
    'chat:linkFolder': () => ({ folder: 'gestionnaire-idees' }),
    'chat:setModel': (payload) => ({
      ...current,
      model: 'claude-haiku-4-5',
      modelChoice: (payload as { model: string | null }).model
    })
  })
  const onClose = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ChatPanel neuronId={ID} onClose={onClose} />
    </QueryClientProvider>
  )
  return { api, onClose, setView: (next: ChatView) => (current = next) }
}

describe('chat d’un neurone (spec 008 lot A)', () => {
  it('should_offer_to_start_the_brainstorm_on_an_empty_conversation', async () => {
    const { api } = renderChat()
    await userEvent.click(await screen.findByRole('button', { name: 'Commencer le brainstorm' }))
    expect(api.invoke).toHaveBeenCalledWith('chat:send', { neuronId: ID, text: OPENING_MESSAGE })
  })

  it('should_stream_the_answer_show_actions_and_unlock_sending_at_the_end_of_the_turn', async () => {
    const { api } = renderChat()
    const field = await screen.findByLabelText('Message à Claude')
    await userEvent.type(field, 'Un studio à Liège{Enter}')
    expect(api.invoke).toHaveBeenCalledWith('chat:send', { neuronId: ID, text: 'Un studio à Liège' })
    expect(screen.getByRole('button', { name: 'Arrêter' })).toBeTruthy()
    act(() => api.emit('chat:delta', { neuronId: ID, text: 'Bonne ' }))
    act(() => api.emit('chat:delta', { neuronId: ID, text: 'idée.' }))
    act(() => api.emit('chat:delta', { neuronId: 'autre', text: 'IGNORÉ' }))
    expect(screen.getByText('Bonne idée.')).toBeTruthy()
    expect(screen.queryByText(/IGNORÉ/)).toBeNull()
    act(() =>
      api.emit('chat:tool', {
        neuronId: ID,
        message: { id: 't1', role: 'tool', text: 'fiche mise à jour', createdAt: '' }
      })
    )
    expect(screen.getByLabelText('Action de Claude : fiche mise à jour')).toBeTruthy()
    act(() =>
      api.emit('chat:turnEnd', {
        neuronId: ID,
        message: { id: 'a1', role: 'assistant', text: 'Bonne idée. Pour qui ?', createdAt: '' },
        interrupted: false
      })
    )
    expect(screen.getByText('Bonne idée. Pour qui ?')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeTruthy()
  })

  it('should_stop_a_turn_on_request', async () => {
    const { api } = renderChat(
      view({ busy: true, partial: 'Je réfl', messages: [{ id: 'u', role: 'user', text: 'x', createdAt: '' }] })
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Arrêter' }))
    expect(api.invoke).toHaveBeenCalledWith('chat:stop', { neuronId: ID })
  })

  it('should_show_the_history_the_sheet_and_errors_as_text', async () => {
    renderChat(
      view({
        messages: [
          { id: '1', role: 'user', text: '<b>gras</b>', createdAt: '' },
          { id: '2', role: 'assistant', text: 'Réponse', createdAt: '' }
        ],
        sheet: {
          resume: 'Studio à Liège',
          points_cles: [],
          decisions: ['Lieu : Liège'],
          questions_ouvertes: [],
          manques: []
        },
        maturity: 'sufficient'
      })
    )
    expect(await screen.findByText('<b>gras</b>')).toBeTruthy()
    expect(screen.getByText('Lieu : Liège')).toBeTruthy()
    expect(screen.getByText(/maturité : suffisant/)).toBeTruthy()
  })

  it('should_refresh_the_sheet_when_claude_writes_it_and_show_the_subscription_usage', async () => {
    const { api, setView } = renderChat()
    await screen.findByText('Fiche du neurone')
    setView(
      view({ sheet: { resume: 'Nouveau résumé', points_cles: [], decisions: [], questions_ouvertes: [], manques: [] } })
    )
    act(() => api.emit('chat:sheet', { neuronId: ID }))
    expect(await screen.findByText('Nouveau résumé')).toBeTruthy()
    act(() =>
      api.emit('chat:usage', {
        neuronId: ID,
        usage: {
          account: {
            status: 'allowed_warning',
            fiveHour: { utilization: 0.37, resetsAt: 1 },
            sevenDay: { utilization: 0.89, resetsAt: 2 },
            updatedAt: ''
          },
          app: {
            weekTokens: 12_400,
            weekTurns: 3,
            totalTokens: 50_000,
            totalTurns: 9,
            neuronTokens: 4_000,
            neuronTurns: 1
          }
        }
      })
    )
    expect(screen.getByRole('meter', { name: 'Session 5 h de l’abonnement' }).getAttribute('aria-valuenow')).toBe('37')
    expect(screen.getByRole('meter', { name: 'Semaine de l’abonnement' }).getAttribute('aria-valuenow')).toBe('89')
    expect(screen.getByText(/cette semaine : 12,4 k jetons \(3 échanges\)/)).toBeTruthy()
  })

  it('should_close_the_conversation_when_the_panel_closes', async () => {
    const { api, onClose } = renderChat()
    await userEvent.click(await screen.findByRole('button', { name: 'Fermer la conversation' }))
    expect(onClose).toHaveBeenCalled()
    expect(api.invoke).toHaveBeenCalledWith('chat:open', { neuronId: ID })
  })

  it('should_link_a_project_folder_through_the_native_picker_and_show_it', async () => {
    const { api } = renderChat()
    await userEvent.click(await screen.findByRole('button', { name: 'Lier un dossier de projet…' }))
    expect(api.invoke).toHaveBeenCalledWith('chat:linkFolder', { neuronId: ID, unlink: false })
    expect(await screen.findByText('Dossier : gestionnaire-idees')).toBeTruthy()
  })

  it('should_offer_to_map_a_linked_project', async () => {
    const { api } = renderChat(view({ folder: 'gestionnaire-idees' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Cartographier ce projet' }))
    expect(api.invoke).toHaveBeenCalledWith('chat:send', { neuronId: ID, text: MAP_MESSAGE })
  })

  it('should_present_an_element_conversation_without_folder_controls', async () => {
    renderChat(view({ role: 'element', elementType: 'composant', folder: 'gestionnaire-idees' }))
    expect(await screen.findByText(/composant du projet/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Lier un dossier de projet…' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cartographier ce projet' })).toBeNull()
  })

  it('should_render_claude_answers_as_safe_markdown', async () => {
    const answer = [
      '**Checklist du test :**',
      '',
      '- [ ] Lisibilité',
      '- [x] Annulation',
      '',
      '| Lot | Statut |',
      '|-----|--------|',
      '| P1 | livré |',
      '',
      '<script>alert(1)</script><b>brut</b>',
      '',
      '[piège](javascript:alert(1)) et [doc](https://example.com)'
    ].join('\n')
    const { container } = renderChatWithContainer(
      view({ messages: [{ id: 'a', role: 'assistant', text: answer, createdAt: '' }] })
    )
    expect(await screen.findByText('Checklist du test :')).toBeTruthy()
    expect(screen.getByText('Checklist du test :').tagName).toBe('STRONG')
    const boxes = container.querySelectorAll('input[type="checkbox"]')
    expect([...boxes].map((box) => (box as HTMLInputElement).checked)).toEqual([false, true])
    expect(screen.getByRole('table')).toBeTruthy()
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect(screen.getByText('piège').getAttribute('href') ?? '').not.toContain('javascript')
    expect(screen.getByText('doc').getAttribute('href')).toBe('https://example.com')
  })

  it('should_choose_the_model_of_this_conversation', async () => {
    const { api } = renderChat()
    const select = await screen.findByLabelText('Modèle de cette conversation')
    expect(screen.getByRole('option', { name: 'Défaut (Opus 5.5)' })).toBeTruthy()
    await userEvent.selectOptions(select, 'claude-haiku-4-5')
    expect(api.invoke).toHaveBeenCalledWith('chat:setModel', { neuronId: ID, model: 'claude-haiku-4-5' })
  })
})
