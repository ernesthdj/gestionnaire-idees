import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { BrainstormListItem, BrainstormOpenView } from '../../../src/shared/ipc/brainstorms'
import { EMPTY_VIEW_STATE } from '../../../src/shared/brainstorms/viewState'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { useCards } from '../../../src/renderer/src/canvas/cards/cardsStore'
import { ProjectManager } from '../../../src/renderer/src/home/ProjectManager'
import { BrainstormBar } from '../../../src/renderer/src/home/BrainstormBar'
import { cardsOf, viewStateOf } from '../../../src/renderer/src/home/viewState'
import { expectNoAxeViolations } from '../../support/axe'
import { installFakeApi } from './support/fakeApi'

const B = '00000000-0000-4000-8000-000000000024'
const G = '00000000-0000-4000-8000-0000000000a1'

const item = (extra: Partial<BrainstormListItem>): BrainstormListItem => ({
  id: null,
  slug: 'alpha',
  name: 'Alpha',
  description: 'Projet fictif',
  type: 'Web App',
  location: 'vault',
  folder: 'C:\\coffre\\projects\\alpha',
  folderMissing: false,
  branch: 'main',
  lastSession: null,
  openSession: false,
  last: false,
  ...extra
})

const opened: BrainstormOpenView = {
  brainstorm: {
    id: B,
    slug: 'alpha',
    name: 'Alpha',
    description: '',
    location: 'vault',
    folder: 'C:\\coffre\\projects\\alpha',
    genesisId: G
  },
  viewState: {
    ...EMPTY_VIEW_STATE,
    viewport: { x: 5, y: 6, zoom: 0.7 },
    structureViews: { [G]: 'workflow' },
    openCards: [{ id: G, offset: { x: 10, y: 0 }, sheet: false, side: 'chat', pinned: true }]
  },
  anomalies: [{ kind: 'uncommitted', count: 3 }],
  journal: ['[2026-10-09] FEAT — dernière entrée']
}

function renderManager(handlers: Parameters<typeof installFakeApi>[0]) {
  const api = installFakeApi({
    'project:settings': () => ({ root: 'C:\\coffre\\projects', hub: true }),
    ...handlers
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(
    <QueryClientProvider client={client}>
      <ProjectManager />
      <BrainstormBar />
    </QueryClientProvider>
  )
  return { api, ...result }
}

describe('Project Manager (spec 024 US1, US3)', () => {
  beforeEach(() => {
    useUiStore.setState({ view: 'home', brainstorm: null, openSummary: null, structureViews: {} })
    useCards.setState({ cards: [], activeId: null })
  })

  it('should_list_brainstorms_and_reopen_one_exactly_as_it_was_left', async () => {
    const user = userEvent.setup()
    const { api, container } = renderManager({
      'brainstorms:list': () => [
        item({ id: B, last: true, lastSession: '2026-10-09T10:00:00Z' }),
        item({ slug: 'beta', name: 'Beta', openSession: true }),
        item({ slug: 'gamma', name: 'Gamma', folderMissing: true })
      ],
      'brainstorms:open': () => opened
    })
    expect(await screen.findByRole('button', { name: /Reprendre « Alpha »/ })).toBeDefined()
    expect(screen.getByText('session ouverte')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Ouvrir Gamma' })).toHaveProperty('disabled', true)
    expect(screen.getByText('dossier introuvable')).toBeDefined()
    await expectNoAxeViolations(container)

    await user.type(screen.getByLabelText('Rechercher un brainstorm'), 'bet')
    expect(screen.queryByRole('button', { name: 'Ouvrir Alpha' })).toBeNull()
    await user.clear(screen.getByLabelText('Rechercher un brainstorm'))

    await user.click(screen.getByRole('button', { name: /Reprendre « Alpha »/ }))
    await waitFor(() => expect(useUiStore.getState().brainstorm?.id).toBe(B))
    expect(api.invoke).toHaveBeenCalledWith('brainstorms:open', { id: B })
    const ui = useUiStore.getState()
    expect(ui.view).toBe('ideas')
    expect(ui.structureViews).toEqual({ [G]: 'workflow' })
    expect(ui.restoredViewport).toEqual({ x: 5, y: 6, zoom: 0.7 })
    expect(useCards.getState().cards.map((card) => [card.id, card.side, card.pinned])).toEqual([[G, 'chat', true]])
    expect(await screen.findByText(/3 fichiers non commités/)).toBeDefined()
    expect(screen.getByText('[2026-10-09] FEAT — dernière entrée')).toBeDefined()
  })

  it('should_open_a_vault_project_by_its_slug_the_first_time', async () => {
    const user = userEvent.setup()
    const { api } = renderManager({ 'brainstorms:list': () => [item({})], 'brainstorms:open': () => opened })
    await user.click(await screen.findByRole('button', { name: 'Ouvrir Alpha' }))
    await waitFor(() => expect(api.invoke).toHaveBeenCalledWith('brainstorms:open', { slug: 'alpha' }))
  })

  it('should_create_a_project_from_scratch_and_open_its_conversation_with_a_prefilled_prompt', async () => {
    const user = userEvent.setup()
    const { api, container } = renderManager({
      'brainstorms:list': () => [],
      'brainstorms:createScratch': () => ({ id: B, warning: null }),
      'brainstorms:open': () => ({ ...opened, viewState: null, anomalies: [], journal: [] })
    })
    // Aucun brainstorm : « Nouveau brainstorm » est proposé d'office.
    expect(await screen.findByRole('heading', { name: 'Nouveau projet de zéro' })).toBeDefined()
    expect(screen.getByRole('button', { name: /Depuis un lien Git/ })).toHaveProperty('disabled', true)
    await expectNoAxeViolations(container)
    await user.type(screen.getByLabelText('Nom'), 'Essai local')
    expect((screen.getByLabelText('Nom du dossier') as HTMLInputElement).value).toBe('essai-local')
    await user.selectOptions(screen.getByLabelText('Type'), 'Web App')
    await user.type(screen.getByLabelText('Description'), 'Un essai')
    await user.click(screen.getByRole('button', { name: 'Créer et ouvrir le canevas' }))
    await waitFor(() => expect(useUiStore.getState().brainstorm?.id).toBe(B))
    expect(api.invoke).toHaveBeenCalledWith('brainstorms:createScratch', {
      name: 'Essai local',
      slug: 'essai-local',
      description: 'Un essai',
      type: 'Web App',
      github: false
    })
    expect(useUiStore.getState().chatDrafts[G]).toMatch(/« Essai local » \(Un essai\)/)
    expect(useCards.getState().cards.find((card) => card.id === G)?.side).toBe('chat')
  })

  it('should_ask_for_the_vault_when_none_is_chosen', async () => {
    renderManager({ 'project:settings': () => ({ root: null, hub: false }), 'brainstorms:list': () => [] })
    expect(await screen.findByRole('button', { name: 'Choisir mon coffre' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Créer et ouvrir le canevas' })).toHaveProperty('disabled', true)
  })

  it('should_turn_the_interface_into_a_bounded_view_state_and_back', () => {
    const cards = [
      { id: 'b', offset: { x: 0, y: 0 }, sheet: false, side: 'reader' as const, reader: null, z: 2, pinned: false },
      { id: 'a', offset: { x: 1, y: 1 }, sheet: true, side: 'chat' as const, reader: null, z: 1, pinned: true }
    ]
    const state = viewStateOf({ g: 'architecture' }, cards, null)
    expect(state.openCards.map((card) => [card.id, card.side])).toEqual([
      ['a', 'chat'],
      ['b', null]
    ])
    expect(cardsOf(state).cards.map((card) => [card.id, card.z])).toEqual([
      ['a', 1],
      ['b', 2]
    ])
    expect(cardsOf(null)).toEqual({ cards: [], activeId: null })
  })
})
