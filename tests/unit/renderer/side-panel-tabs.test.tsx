import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useWaitingChats } from '../../../src/renderer/src/chat/waitingChats'
import { useCards } from '../../../src/renderer/src/canvas/cards/cardsStore'
import { SidePanel } from '../../../src/renderer/src/canvas/side/SidePanel'
import {
  bindNeuron,
  EMPTY_SIDE_PANEL,
  openWorkflowChat,
  useSidePanel
} from '../../../src/renderer/src/canvas/side/sidePanelStore'
import { targetIndex } from '../../../src/renderer/src/canvas/side/SideTabs'
import { useRunningChats } from '../../../src/renderer/src/canvas/workflow/runningChats'
import { expectNoAxeViolations } from '../../support/axe'
import { installFakeApi } from './support/fakeApi'

const A = '00000000-0000-4000-8000-000000002711'
const B = '00000000-0000-4000-8000-000000002712'
const C = '00000000-0000-4000-8000-000000002713'
const TITLES: Readonly<Record<string, string>> = { [A]: 'Genesis', [B]: 'Étape un', [C]: 'Étape deux' }

function renderPanel() {
  installFakeApi({
    'chat:open': (payload) => {
      const neuronId = (payload as { neuronId: string }).neuronId
      return {
        neuronId,
        title: TITLES[neuronId] ?? 'Tâche',
        messages: [],
        sheet: { resume: '', points_cles: [], decisions: [], questions_ouvertes: [], manques: [] },
        maturity: null,
        busy: false,
        partial: '',
        usage: null,
        folder: null
      }
    },
    'chat:close': () => ({ ok: true }),
    'workflow:chat': () => ({ neuronId: C })
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <SidePanel />
    </QueryClientProvider>
  )
}

const open = (id: string): void =>
  act(() => useSidePanel.getState().openChat({ nodeId: id, neuronId: id, title: TITLES[id] ?? id, kindLabel: 'Étape' }))
const tab = (name: RegExp): HTMLElement => within(screen.getByRole('tablist')).getByRole('tab', { name })

describe('onglets multiples (spec 027 US2)', () => {
  beforeEach(() => {
    useSidePanel.getState().reset()
    useCards.setState({ cards: [], activeId: null })
    useRunningChats.setState({ running: new Set() })
    useWaitingChats.setState({ waiting: new Map() })
  })

  it('should_add_a_second_tab_shown_and_keep_the_first_when_another_node_is_discussed', async () => {
    renderPanel()
    open(A)
    open(B)
    expect(screen.getAllByRole('tab')).toHaveLength(2)
    expect(tab(/Étape un/).getAttribute('aria-selected')).toBe('true')
    expect(tab(/Genesis/).getAttribute('aria-selected')).toBe('false')
    expect(await screen.findByRole('region', { name: 'Conversation : Étape un' })).toBeDefined()
  })

  it('should_tell_on_its_tab_that_claude_writes_or_waits_for_an_answer_when_it_is_not_shown', async () => {
    const { container } = renderPanel()
    open(A)
    open(B)
    act(() => useRunningChats.getState().mark(A, true))
    // jsdom colle le texte caché au titre, Chromium garde l'espace : on accepte les deux.
    expect(tab(/Genesis\s*\(Claude écrit\)/)).toBeDefined()
    // Une demande de permission prime sur « écrit » (c'est à toi d'agir) ; elle s'efface une fois tranchée.
    act(() => useWaitingChats.getState().add(A, 'r1'))
    expect(tab(/Genesis\s*\(attend ton accord\)/)).toBeDefined()
    expect(tab(/Genesis/).textContent).not.toContain('Claude écrit')
    await expectNoAxeViolations(container)
    act(() => useWaitingChats.getState().resolve(A, 'r1'))
    act(() => useRunningChats.getState().mark(A, false))
    expect(tab(/Genesis/).textContent).toBe('Genesis×')
  })

  it('should_follow_the_conversation_of_a_workflow_task_once_its_neuron_is_known', async () => {
    renderPanel()
    act(() =>
      useSidePanel
        .getState()
        .openWorkflowChat({ nodeId: 'wf:g:task:1', genesisId: 'g', title: 'T001', kindLabel: 'Tâche' })
    )
    await waitFor(() => expect(useSidePanel.getState().tabs[0]).toMatchObject({ neuronId: C }))
    act(() => useRunningChats.getState().mark(C, true))
    expect(tab(/T001\s*\(Claude écrit\)/)).toBeDefined()
  })

  it('should_move_between_tabs_with_arrows_home_and_end', () => {
    renderPanel()
    open(A)
    open(B)
    open(C)
    fireEvent.keyDown(tab(/Étape deux/), { key: 'ArrowRight' })
    expect(useSidePanel.getState().shownKey).toBe(A)
    expect(document.activeElement).toBe(tab(/Genesis/))
    fireEvent.keyDown(tab(/Genesis/), { key: 'ArrowLeft' })
    expect(useSidePanel.getState().shownKey).toBe(C)
    fireEvent.keyDown(tab(/Étape deux/), { key: 'Home' })
    expect(useSidePanel.getState().shownKey).toBe(A)
    fireEvent.keyDown(tab(/Genesis/), { key: 'End' })
    expect(useSidePanel.getState().shownKey).toBe(C)
    // Un seul onglet atteignable par Tab (tabindex itinérant).
    expect(screen.getAllByRole('tab').map((entry) => entry.tabIndex)).toEqual([-1, -1, 0])
  })

  it('should_show_the_neighbour_when_the_shown_tab_is_closed_and_keep_the_tab_when_its_card_closes', () => {
    renderPanel()
    open(A)
    open(B)
    act(() => useCards.getState().open(B))
    act(() => useCards.getState().close(B))
    expect(useSidePanel.getState().tabs.map((entry) => entry.key)).toEqual([A, B])
    // × de l'onglet affiché (à la souris) : le voisin s'affiche.
    const close = tab(/Étape un/).querySelector('.side-tab-close')
    if (close === null) throw new Error('× introuvable')
    fireEvent.click(close)
    expect(useSidePanel.getState().shownKey).toBe(A)
  })
})

describe('règles des onglets Workflow et du clavier', () => {
  it('should_bind_the_neuron_of_a_workflow_tab_only_once', () => {
    const state = openWorkflowChat(EMPTY_SIDE_PANEL, { nodeId: 'k', genesisId: 'g', title: 'T', kindLabel: 'Tâche' })
    const bound = bindNeuron(state, 'k', 'n')
    expect(bound.tabs[0]).toMatchObject({ neuronId: 'n' })
    expect(bindNeuron(bound, 'k', 'n')).toBe(bound)
    expect(bindNeuron(bound, 'absent', 'n')).toBe(bound)
  })

  it('should_wrap_arrows_and_ignore_other_keys', () => {
    expect(targetIndex('ArrowRight', 2, 3)).toBe(0)
    expect(targetIndex('ArrowLeft', 0, 3)).toBe(2)
    expect(targetIndex('End', 0, 3)).toBe(2)
    expect(targetIndex('Enter', 0, 3)).toBeNull()
    expect(targetIndex('ArrowRight', 0, 0)).toBeNull()
  })
})
