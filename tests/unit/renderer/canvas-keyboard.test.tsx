import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { IdeasCanvas } from '../../../src/renderer/src/canvas/IdeasCanvas'
import type { IdeasCanvasView } from '../../../src/shared/ipc/canvas'
import { DEFAULT_APP_SETTINGS } from '../../../src/shared/ipc/app'
import { expectNoAxeViolations } from '../../support/axe'
import {
  canvasView,
  DEVELOPING_ID,
  emptyCanvasView,
  HATCHED_A_ID,
  HATCHED_B_ID,
  LINK_ID,
  RAW_ID
} from '../../fixtures/ui/canvas'
import { useCanvasHover } from '../../../src/renderer/src/canvas/hoverStore'
import { installFakeApi } from './support/fakeApi'
import { installReactFlowMocks } from './support/reactFlowMocks'

function renderCanvas(view: IdeasCanvasView = canvasView()) {
  const api = installFakeApi({
    'canvas:get': () => view,
    'canvas:savePositions': () => ({ ok: true }),
    'app:getSettings': () => DEFAULT_APP_SETTINGS,
    'links:decide': () => ({}),
    'neuron:update': () => ({}),
    'neuron:create': () => ({}),
    'canvas:createBlock': () => ({}),
    'canvas:deleteBlock': () => ({ ok: true })
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(
    <QueryClientProvider client={client}>
      <IdeasCanvas />
    </QueryClientProvider>
  )
  return { api, ...result }
}

const idea = (name: RegExp): HTMLElement => screen.getByRole('group', { name })

describe('écran Idées', () => {
  beforeAll(() => installReactFlowMocks())
  beforeEach(() => useUiStore.setState({ view: 'ideas', openRootId: null }))

  it('should_show_counts_and_every_idea_with_a_spoken_description', async () => {
    renderCanvas()
    expect(await screen.findByText('1 brute · 1 en dév. · 2 écloses')).toBeDefined()
    await waitFor(() => expect(idea(/^Idée brute : Acheter un flash cobra/)).toBeDefined())
    expect(
      idea(/^En développement, contexte insuffisant : Deuxième écran, Action, catégorie Achat, 1 sous-neurone$/)
    ).toBeDefined()
    expect(idea(/^Idée éclose : Mission mariage, Réflexion \(proposée par l’IA\)/)).toBeDefined()
  })

  it('should_dive_into_an_idea_when_enter_is_pressed_on_it', async () => {
    const user = userEvent.setup()
    renderCanvas()
    const node = await waitFor(() => idea(/Deuxième écran/))
    node.focus()
    await user.keyboard('{Enter}')
    expect(useUiStore.getState().openRootId).toBe(DEVELOPING_ID)
  })

  it('should_reach_ideas_with_tab_from_the_toolbar', async () => {
    const user = userEvent.setup()
    renderCanvas()
    await waitFor(() => idea(/Acheter un flash cobra/))
    screen.getByRole('button', { name: 'Recentrer' }).focus()
    // Les boutons ✓ / ✗ d'un lien suggéré peuvent précéder les idées dans l'ordre de tabulation.
    const labels: string[] = []
    for (let press = 0; press < 5; press++) {
      await user.tab()
      labels.push((document.activeElement as HTMLElement).getAttribute('aria-label') ?? '')
    }
    expect(labels.some((label) => /^(Idée brute|En développement|Idée éclose) :/.test(label))).toBe(true)
  })

  it('should_move_the_view_and_not_the_idea_when_an_arrow_key_is_pressed', async () => {
    const user = userEvent.setup()
    const { container } = renderCanvas()
    const node = await waitFor(() => idea(/Acheter un flash cobra/))
    const viewport = container.querySelector('.react-flow__viewport') as HTMLElement
    const nodeTransform = node.style.transform
    const before = viewport.style.transform
    node.focus()
    await user.keyboard('{ArrowLeft}')
    expect(viewport.style.transform).not.toBe(before)
    expect(node.style.transform).toBe(nodeTransform)
  })

  it('should_open_the_menu_with_the_context_menu_key_and_change_the_category_in_one_gesture', async () => {
    const user = userEvent.setup()
    const { api } = renderCanvas()
    const node = await waitFor(() => idea(/Acheter un flash cobra/))
    node.focus()
    await user.keyboard('{Shift>}{F10}{/Shift}')
    const menu = await screen.findByRole('dialog', { name: 'Acheter un flash cobra' })
    await user.selectOptions(within(menu).getByLabelText(/Catégorie/), 'photo')
    expect(api.invoke).toHaveBeenCalledWith('neuron:update', { id: RAW_ID, categorySlug: 'photo' })
  })

  it('should_accept_a_suggested_link_in_place', async () => {
    const user = userEvent.setup()
    const { api } = renderCanvas()
    await user.click(await screen.findByRole('button', { name: /^Accepter le lien « financement »/ }))
    expect(api.invoke).toHaveBeenCalledWith('links:decide', { linkId: LINK_ID, accept: true })
  })

  it('should_ask_again_with_the_nature_filter_when_it_is_chosen', async () => {
    const user = userEvent.setup()
    const { api } = renderCanvas()
    await user.selectOptions(await screen.findByLabelText('Filtrer par nature'), 'action')
    await waitFor(() => expect(api.invoke).toHaveBeenCalledWith('canvas:get', { nature: 'action' }))
  })

  it('should_explain_how_to_capture_when_there_is_no_idea', async () => {
    renderCanvas(emptyCanvasView())
    expect(await screen.findByText(/Aucune idée pour l’instant/)).toBeDefined()
  })

  it('should_have_no_accessibility_violation', async () => {
    const { container } = renderCanvas()
    await waitFor(() => idea(/^Idée éclose : Mission mariage/))
    await expectNoAxeViolations(container)
  })

  it('should_add_a_block_and_delete_it_with_its_button', async () => {
    const user = userEvent.setup()
    const block = {
      id: '00000000-0000-4000-8000-0000000000b1',
      kind: 'empty' as const,
      x: 0,
      y: 0,
      width: 240,
      height: 160,
      text: null,
      versionId: null,
      sourceBlockId: null
    }
    const { api } = renderCanvas({ ...canvasView(), blocks: [block] })
    await user.click(await screen.findByRole('button', { name: '+ Bloc' }))
    expect(api.invoke).toHaveBeenCalledWith('canvas:createBlock', expect.objectContaining({ x: expect.any(Number) }))
    await user.click(await screen.findByRole('button', { name: 'Supprimer le bloc' }))
    expect(api.invoke).toHaveBeenCalledWith('canvas:deleteBlock', { id: block.id })
  })

  it('should_keep_an_accepted_link_discreet_and_show_its_label_on_hover_or_focus_of_one_of_its_ideas', async () => {
    useCanvasHover.setState({ edgeId: null, nodeId: null })
    const view = canvasView()
    const accepted = { ...view.links[0], status: 'accepted' as const, label: 'même budget' }
    renderCanvas({ ...view, links: [accepted as (typeof view.links)[number]] })
    const idea = await waitFor(() => screen.getByRole('group', { name: /^Idée éclose : Mission mariage/ }))
    expect(screen.queryByText('même budget')).toBeNull()
    fireEvent.mouseEnter(idea)
    expect(await screen.findByText('même budget')).toBeDefined()
    fireEvent.mouseLeave(idea)
    await waitFor(() => expect(screen.queryByText('même budget')).toBeNull())
    act(() => screen.getByRole('group', { name: /^Idée éclose : Portfolio photo/ }).focus())
    expect(await screen.findByText('même budget')).toBeDefined()
    expect([HATCHED_A_ID, HATCHED_B_ID]).toContain(useCanvasHover.getState().nodeId)
  })

  it('should_always_show_a_suggested_link_with_its_decision_buttons', async () => {
    useCanvasHover.setState({ edgeId: null, nodeId: null })
    renderCanvas()
    expect(await screen.findByText('financement')).toBeDefined()
    expect(screen.getByRole('button', { name: /^Refuser le lien « financement »/ })).toBeDefined()
  })
})
