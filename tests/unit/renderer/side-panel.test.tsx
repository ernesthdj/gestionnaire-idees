import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { useCards } from '../../../src/renderer/src/canvas/cards/cardsStore'
import { SidePanel } from '../../../src/renderer/src/canvas/side/SidePanel'
import { useSidePanel } from '../../../src/renderer/src/canvas/side/sidePanelStore'
import type { DocumentView } from '../../../src/shared/ipc/documents'
import type { GitStatusView } from '../../../src/shared/git/model'
import { expectNoAxeViolations } from '../../support/axe'
import { installFakeApi } from './support/fakeApi'

const N = '00000000-0000-4000-8000-000000002701'
const M = '00000000-0000-4000-8000-000000002702'
const G = '00000000-0000-4000-8000-000000002703'
const DOC: DocumentView = {
  id: '00000000-0000-4000-8000-000000002704',
  neuronId: N,
  genesisId: N,
  title: 'Cahier des charges',
  fileLabel: 'docs/cahier.md',
  width: 360,
  height: 280,
  origin: 'user',
  offset: { x: 0, y: 0 }
}
const chatView = (neuronId: string, title: string) => ({
  neuronId,
  title,
  messages: [],
  sheet: { resume: '', points_cles: [], decisions: [], questions_ouvertes: [], manques: [] },
  maturity: null,
  busy: false,
  partial: '',
  usage: null,
  folder: null
})
const STATUS: GitStatusView = {
  state: 'ok',
  branch: 'main',
  detached: false,
  upstream: null,
  ahead: 0,
  behind: 0,
  lastFetchAt: null,
  files: [],
  filesTotal: 0,
  operation: 'none',
  onPrBranch: false,
  trusted: false,
  riskyConfig: [],
  github: null,
  newSinceVisit: 0
}

function renderPanel() {
  const api = installFakeApi({
    'chat:open': (payload) => {
      const id = (payload as { neuronId: string }).neuronId
      return chatView(id, id === N ? 'Mission mariage' : 'Valider le budget')
    },
    'chat:close': () => ({ ok: true }),
    'document:get': () => ({ id: DOC.id, content: '# Cahier\n\nTexte.', hash: 'h', missing: false }),
    'git:status': () => STATUS,
    'git:log': () => ({ commits: [], nextCursor: null }),
    'git:branches': () => ({ branches: [] })
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(
    <QueryClientProvider client={client}>
      {/* Un nœud de la carte, pour vérifier que le focus y revient (Échap). */}
      <div className="react-flow__node" data-id={N} tabIndex={0}>
        nœud
      </div>
      <SidePanel />
    </QueryClientProvider>
  )
  return { api, ...result }
}

const panel = (): HTMLElement => screen.getByRole('complementary', { name: 'Panneau de droite' })
const openIdea = (): void =>
  act(() => useSidePanel.getState().openChat({ nodeId: N, neuronId: N, title: 'Mission mariage', kindLabel: 'Idée' }))

describe('panneau de droite (spec 027 US1, US4)', () => {
  beforeEach(() => {
    useSidePanel.getState().reset()
    useCards.setState({ cards: [], activeId: null })
    useUiStore.setState({ chatDrafts: {} })
  })

  it('should_render_nothing_when_no_tab_is_open', () => {
    const { container } = renderPanel()
    expect(screen.queryByRole('complementary', { name: 'Panneau de droite' })).toBeNull()
    expect(container.querySelector('.side-panel')).toBeNull()
  })

  it('should_show_the_conversation_with_its_node_title_and_kind_when_a_chat_tab_is_open', async () => {
    const { container } = renderPanel()
    openIdea()
    const side = panel()
    expect(
      within(side)
        .getByRole('tab', { name: /Mission mariage/ })
        .getAttribute('aria-selected')
    ).toBe('true')
    // La conversation porte le titre du nœud dans son en-tête : pas de second en-tête d'onglet.
    expect(await within(side).findByRole('region', { name: 'Conversation : Mission mariage' })).toBeDefined()
    expect(within(side).getAllByRole('heading', { name: 'Mission mariage', level: 2 })).toHaveLength(1)
    expect(useUiStore.getState().chatNeuronId).toBe(N)
    await expectNoAxeViolations(container)
  })

  it('should_switch_tabs_on_click_and_close_one_with_delete_or_its_header_button', async () => {
    renderPanel()
    openIdea()
    act(() =>
      useSidePanel.getState().openChat({ nodeId: M, neuronId: M, title: 'Valider le budget', kindLabel: 'Étape' })
    )
    expect(await within(panel()).findByRole('region', { name: 'Conversation : Valider le budget' })).toBeDefined()
    fireEvent.click(within(panel()).getByRole('tab', { name: /Mission mariage/ }))
    expect(await within(panel()).findByRole('region', { name: 'Conversation : Mission mariage' })).toBeDefined()
    fireEvent.keyDown(within(panel()).getByRole('tab', { name: /Mission mariage/ }), { key: 'Delete' })
    expect(useSidePanel.getState().tabs.map((tab) => tab.key)).toEqual([M])
    fireEvent.click(await within(panel()).findByRole('button', { name: 'Fermer la conversation' }))
    expect(screen.queryByRole('complementary', { name: 'Panneau de droite' })).toBeNull()
  })

  it('should_show_the_repo_as_a_tab_and_keep_the_chats_when_it_closes', async () => {
    renderPanel()
    openIdea()
    act(() => useUiStore.getState().openRepo(G))
    expect(useUiStore.getState().repoGenesisId).toBe(G)
    expect(
      within(panel())
        .getByRole('tab', { name: /⎇ Dépôt/ })
        .getAttribute('aria-selected')
    ).toBe('true')
    expect(await within(panel()).findByRole('heading', { name: 'Dépôt' })).toBeDefined()
    act(() => useUiStore.getState().closeRepo())
    expect(useUiStore.getState().repoGenesisId).toBeNull()
    expect(within(panel()).queryByRole('tab', { name: /⎇ Dépôt/ })).toBeNull()
    expect(within(panel()).getByRole('tab', { name: /Mission mariage/ })).toBeDefined()
  })

  it('should_go_back_from_the_reader_then_focus_the_map_without_closing_the_tab_when_escape_is_pressed', async () => {
    renderPanel()
    openIdea()
    act(() =>
      useSidePanel
        .getState()
        .openReader(
          { nodeId: N, neuronId: N, title: 'Mission mariage', kindLabel: 'Idée' },
          { source: 'document', path: DOC.id, tab: 'file', document: DOC }
        )
    )
    const reader = await within(panel()).findByRole('region', { name: 'Document : Cahier des charges' })
    expect(useUiStore.getState().chatNeuronId).toBeNull()
    // Avec un lecteur, l'en-tête de l'onglet rappelle le nœud et ferme l'onglet.
    expect(within(panel()).getByText('Idée')).toBeDefined()
    expect(within(panel()).getByRole('button', { name: 'Fermer l’onglet « Mission mariage »' })).toBeDefined()
    fireEvent.keyDown(reader, { key: 'Escape' })
    const chat = await within(panel()).findByRole('region', { name: 'Conversation : Mission mariage' })
    fireEvent.keyDown(chat, { key: 'Escape' })
    await waitFor(() => expect(document.activeElement?.getAttribute('data-id')).toBe(N))
    expect(useSidePanel.getState().tabs).toHaveLength(1)
  })
})

describe('façades de uiStore (spec 027 contrat)', () => {
  beforeEach(() => {
    useSidePanel.getState().reset()
    useCards.setState({ cards: [], activeId: null })
    useUiStore.setState({ view: 'home' })
  })

  it('should_open_the_card_and_the_chat_tab_when_open_chat_is_called', () => {
    useUiStore.getState().openChat(N)
    expect(useUiStore.getState().view).toBe('ideas')
    expect(useCards.getState().cards.map((card) => card.id)).toEqual([N])
    expect(useSidePanel.getState().tabs).toMatchObject([{ kind: 'chat', key: N, neuronId: N }])
    expect(useUiStore.getState().chatNeuronId).toBe(N)
    useUiStore.getState().closeChat()
    expect(useSidePanel.getState().tabs).toEqual([])
    expect(useUiStore.getState().chatNeuronId).toBeNull()
  })

  it('should_open_the_chat_tab_when_navigating_to_a_captured_idea', () => {
    useUiStore.getState().navigate({ section: 'ideas', diveRootId: M })
    expect(useSidePanel.getState().shownKey).toBe(M)
  })

  it('should_open_the_deliverable_reader_in_its_own_tab_when_open_viewer_is_called', () => {
    useUiStore.getState().openViewer(M, 'src/a.ts')
    expect(useSidePanel.getState().tabs).toMatchObject([
      {
        kind: 'chat',
        key: `deliverable-${M}`,
        neuronId: null,
        reader: { source: 'deliverable', path: 'src/a.ts', deliverableNeuronId: M }
      }
    ])
    expect(useCards.getState().cards.map((card) => card.id)).toEqual([`deliverable-${M}`])
  })
})
