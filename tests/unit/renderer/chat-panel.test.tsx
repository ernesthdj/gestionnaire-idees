import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  ChatPanel,
  DOC_MESSAGE,
  FINAL_MESSAGE,
  MAP_MESSAGE,
  OPENING_MESSAGE,
  PLAN_MESSAGE
} from '../../../src/renderer/src/chat/ChatPanel'
import type { ChatPermissionRequest, ChatView } from '../../../src/shared/ipc/chat'
import { expectNoAxeViolations } from '../../support/axe'
import { installFakeApi } from './support/fakeApi'

const ID = '00000000-0000-4000-8000-0000000000d1'

const view = (extra: Partial<ChatView> = {}): ChatView => ({
  neuronId: ID,
  title: 'Ouvrir un studio photo',
  messages: [],
  pending: [],
  git: false,
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
  stepLabel: null,
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
    'project:settings': () => ({ root: 'C:/Projets', hub: true }),
    'project:create': () => ({ folder: 'studio-photo', registered: true }),
    'project:initGit': () => ({ ok: true }),
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

  it('should_link_an_existing_folder_through_the_native_picker_and_show_it', async () => {
    const { api, setView } = renderChat()
    const button = await screen.findByRole('button', { name: 'Lier un dossier existant…' })
    setView(view({ folder: 'gestionnaire-idees', git: true }))
    await userEvent.click(button)
    expect(api.invoke).toHaveBeenCalledWith('chat:linkFolder', { neuronId: ID, unlink: false })
    expect(await screen.findByText('Dossier : gestionnaire-idees · git')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Délier' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Initialiser git' })).toBeNull()
  })

  it('should_offer_to_map_a_linked_project', async () => {
    const { api } = renderChat(view({ folder: 'gestionnaire-idees' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Cartographier ce projet' }))
    expect(api.invoke).toHaveBeenCalledWith('chat:send', { neuronId: ID, text: MAP_MESSAGE })
  })

  it('should_ask_claude_for_the_plan_of_a_step_with_the_plan_tool_named', async () => {
    const { api } = renderChat(view({ role: 'step', stepLabel: '①.1', title: 'Initialiser le projet' }))
    expect(await screen.findByText(/Étape ①\.1 du plan d’attaque/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Faire de ce genesis un projet' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Proposer un plan d’attaque' }))
    expect(api.invoke).toHaveBeenCalledWith('chat:send', { neuronId: ID, text: PLAN_MESSAGE })
    expect(PLAN_MESSAGE).toContain('plan_proposer')
  })

  it('should_ask_claude_for_a_document_of_the_neuron_with_the_document_tool_named', async () => {
    const { api } = renderChat(view({ role: 'step', stepLabel: '①.1', title: 'Initialiser le projet' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Rédiger un document' }))
    expect(api.invoke).toHaveBeenCalledWith('chat:send', { neuronId: ID, text: DOC_MESSAGE })
    expect(DOC_MESSAGE).toContain('document_ecrire')
  })

  it('should_ask_claude_to_assess_a_step_as_a_final_action_with_the_tool_named_only_on_a_step', async () => {
    const { api } = renderChat(view({ role: 'step', stepLabel: '①.1', title: 'Initialiser le projet' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Proposer l’action finale' }))
    expect(api.invoke).toHaveBeenCalledWith('chat:send', { neuronId: ID, text: FINAL_MESSAGE })
    expect(FINAL_MESSAGE).toContain('action_proposer')
    cleanup()
    renderChat(view({ role: 'genesis' }))
    await screen.findByRole('button', { name: 'Proposer un plan d’attaque' })
    expect(screen.queryByRole('button', { name: 'Proposer l’action finale' })).toBeNull()
  })

  it('should_present_an_element_conversation_without_folder_controls', async () => {
    renderChat(view({ role: 'element', elementType: 'composant', folder: 'gestionnaire-idees' }))
    expect(await screen.findByText(/composant du projet/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Faire de ce genesis un projet' })).toBeNull()
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

describe('permissions et fil fidèle (spec 014 US1, US3)', () => {
  const REQ1 = '00000000-0000-4000-8000-0000000000e1'
  const REQ2 = '00000000-0000-4000-8000-0000000000e2'
  const write: ChatPermissionRequest = {
    id: REQ1,
    neuronId: ID,
    tool: 'Write',
    detail: { kind: 'write', path: 'C:/projet/hello.md', preview: '# Bonjour <b>x</b>' },
    at: ''
  }
  const command: ChatPermissionRequest = {
    id: REQ2,
    neuronId: ID,
    tool: 'Bash',
    detail: { kind: 'command', command: 'npm test', cwd: 'C:/projet' },
    at: ''
  }

  it('should_show_one_request_at_a_time_with_its_path_and_preview_when_claude_asks_to_write', async () => {
    const { container } = renderChatWithContainer(view({ pending: [write, command] }))
    const card = await screen.findByRole('region', { name: 'Claude demande à écrire un fichier' })
    expect(card.textContent).toContain('C:/projet/hello.md')
    expect(screen.getByLabelText('Aperçu du changement').textContent).toBe('# Bonjour <b>x</b>')
    expect(container.querySelector('pre b')).toBeNull()
    expect(screen.getByText('1 autre demande en attente')).toBeTruthy()
    expect(screen.queryByText('npm test')).toBeNull()
    await expectNoAxeViolations(container)
  })

  it('should_send_the_decision_and_show_the_next_request_when_mentalyas_decides', async () => {
    const { api } = renderChat(view({ pending: [write, command] }))
    await userEvent.click(await screen.findByRole('button', { name: 'Autoriser' }))
    expect(api.invoke).toHaveBeenCalledWith('chat:permissionDecide', { requestId: REQ1, decision: 'allow' })
    expect(await screen.findByRole('region', { name: 'Claude demande à lancer une commande' })).toBeTruthy()
    expect(screen.getByLabelText('Commande exacte').textContent).toBe('npm test')
    await userEvent.click(screen.getByRole('button', { name: 'Toujours pour ce projet' }))
    expect(api.invoke).toHaveBeenCalledWith('chat:permissionDecide', { requestId: REQ2, decision: 'always' })
    expect(screen.queryByRole('button', { name: 'Refuser' })).toBeNull()
  })

  it('should_add_a_request_when_it_arrives_and_remove_it_when_resolved_elsewhere', async () => {
    const { api } = renderChat()
    await screen.findByText('Fiche du neurone')
    act(() => api.emit('chat:permission', command))
    act(() => api.emit('chat:permission', { ...write, neuronId: 'autre' }))
    expect(screen.getByLabelText('Commande exacte').textContent).toBe('npm test')
    expect(screen.queryByText(/autre demande/)).toBeNull()
    act(() => api.emit('chat:permissionResolved', { neuronId: ID, requestId: REQ2, decision: 'expired' }))
    expect(screen.queryByRole('button', { name: 'Autoriser' })).toBeNull()
  })

  it('should_never_show_a_refused_or_failed_tool_as_done', async () => {
    const { container } = renderChatWithContainer(
      view({
        messages: [
          { id: 't1', role: 'tool', text: 'fichier écrit : hello.md', createdAt: '', toolStatus: 'ok' },
          {
            id: 't2',
            role: 'tool',
            text: 'fichier modifié : app.ts',
            createdAt: '',
            toolStatus: 'denied',
            toolReason: 'Refusé par mentalyas'
          },
          {
            id: 't3',
            role: 'tool',
            text: 'commande : npm test',
            createdAt: '',
            toolStatus: 'error',
            toolReason: 'code 1'
          },
          { id: 't4', role: 'tool', text: 'commande : npm run build', createdAt: '', toolStatus: 'running' }
        ]
      })
    )
    expect(await screen.findByLabelText('Action de Claude : fichier écrit : hello.md — fait')).toBeTruthy()
    expect(
      screen.getByLabelText('Action de Claude : fichier modifié : app.ts — refusé : Refusé par mentalyas')
    ).toBeTruthy()
    expect(screen.getByLabelText('Action de Claude : commande : npm test — échoué : code 1')).toBeTruthy()
    expect(screen.getByLabelText('Action de Claude : commande : npm run build — en cours')).toBeTruthy()
    await expectNoAxeViolations(container)
  })

  it('should_replace_the_running_tool_with_its_result', async () => {
    const { api } = renderChat()
    await screen.findByText('Fiche du neurone')
    const tool = { id: 't9', role: 'tool', text: 'commande : npm test', createdAt: '' }
    act(() => api.emit('chat:tool', { neuronId: ID, message: { ...tool, toolStatus: 'running' } }))
    act(() => api.emit('chat:tool', { neuronId: ID, message: { ...tool, toolStatus: 'denied', toolReason: 'Refusé' } }))
    expect(screen.getAllByText(/commande : npm test/)).toHaveLength(1)
    expect(screen.getByLabelText('Action de Claude : commande : npm test — refusé : Refusé')).toBeTruthy()
  })
})

describe('genesis → projet (spec 016)', () => {
  it('should_create_the_project_from_the_genesis_with_a_proposed_folder_name', async () => {
    const { api, setView } = renderChat(
      view({
        maturity: 'sufficient',
        sheet: { resume: 'Un studio à Liège', points_cles: [], decisions: [], questions_ouvertes: [], manques: [] }
      })
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Faire de ce genesis un projet' }))
    const form = await screen.findByRole('form', { name: 'Faire de ce genesis un projet' })
    expect(await screen.findByText(/inscrit au registre ProjectMaster/)).toBeTruthy()
    expect((screen.getByLabelText('Nom du dossier') as HTMLInputElement).value).toBe('ouvrir-un-studio-photo')
    expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe('Un studio à Liège')
    const create = screen.getByRole('button', { name: 'Créer le projet' })
    expect((create as HTMLButtonElement).disabled).toBe(true)
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'Knowledge Base')
    await expectNoAxeViolations(form)
    setView(view({ folder: 'ouvrir-un-studio-photo' }))
    await userEvent.click(create)
    expect(api.invoke).toHaveBeenCalledWith('project:create', {
      neuronId: ID,
      name: 'Ouvrir un studio photo',
      slug: 'ouvrir-un-studio-photo',
      type: 'Knowledge Base',
      description: 'Un studio à Liège'
    })
    expect(await screen.findByText('Dossier : ouvrir-un-studio-photo')).toBeTruthy()
    expect(screen.queryByRole('form', { name: 'Faire de ce genesis un projet' })).toBeNull()
  })

  it('should_block_an_invalid_folder_name_with_its_reason', async () => {
    renderChat()
    await userEvent.click(await screen.findByRole('button', { name: 'Faire de ce genesis un projet' }))
    const slug = await screen.findByLabelText('Nom du dossier')
    await userEvent.clear(slug)
    await userEvent.type(slug, 'status')
    expect(screen.getByText(/réservé/)).toBeTruthy()
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'Web App')
    expect((screen.getByRole('button', { name: 'Créer le projet' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('should_init_git_on_demand_on_a_project_without_git', async () => {
    const { api, setView } = renderChat(view({ folder: 'studio-photo', git: false }))
    const button = await screen.findByRole('button', { name: 'Initialiser git' })
    setView(view({ folder: 'studio-photo', git: true }))
    await userEvent.click(button)
    expect(api.invoke).toHaveBeenCalledWith('project:initGit', { neuronId: ID })
    expect(await screen.findByText('Dossier : studio-photo · git')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Initialiser git' })).toBeNull()
  })
})
