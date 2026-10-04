import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { TIER_SIZE, tierOf } from '../../../src/renderer/src/canvas/buildGraph'
import { IdeasCanvas } from '../../../src/renderer/src/canvas/IdeasCanvas'
import { DEFAULT_APP_SETTINGS } from '../../../src/shared/ipc/app'
import type { IdeasCanvasView } from '../../../src/shared/ipc/canvas'
import { canvasView, emptyCanvasView, HATCHED_A_ID, RAW_ID } from '../../fixtures/ui/canvas'
import { FakeIpcError, installFakeApi } from './support/fakeApi'
import { installReactFlowMocks } from './support/reactFlowMocks'

const NEW_ID = '00000000-0000-4000-8000-000000000020'

function renderCanvas(view: IdeasCanvasView = canvasView(), handlers: Parameters<typeof installFakeApi>[0] = {}) {
  const api = installFakeApi({
    'canvas:get': () => view,
    'canvas:savePositions': () => ({ ok: true }),
    'app:getSettings': () => DEFAULT_APP_SETTINGS,
    'neuron:create': () => ({ id: NEW_ID }),
    'links:create': () => ({}),
    ...handlers
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(
    <QueryClientProvider client={client}>
      <IdeasCanvas />
    </QueryClientProvider>
  )
  return { api, ...result }
}

async function pane(container: HTMLElement): Promise<Element> {
  return waitFor(() => {
    const element = container.querySelector('.react-flow__pane')
    if (element === null) throw new Error('volet absent')
    return element
  })
}

describe('carte unique : taille, création, liens (FR-029 à FR-031)', () => {
  beforeAll(() => installReactFlowMocks())
  beforeEach(() => useUiStore.setState({ view: 'ideas', openRootId: null, focusId: null, toast: null, bornId: null }))

  it('should_grow_with_the_context_level_from_raw_to_hatched', () => {
    const [raw, developing, hatched] = canvasView().ideas
    if (raw === undefined || developing === undefined || hatched === undefined) throw new Error('fixture')
    expect(tierOf(raw)).toBe('raw')
    expect(tierOf(developing)).toBe('insufficient')
    expect(tierOf({ ...developing, contextLevel: 'complete' })).toBe('complete')
    expect(tierOf(hatched)).toBe('hatched')
    const sizes = (['raw', 'insufficient', 'sufficient', 'complete', 'hatched'] as const).map((tier) => TIER_SIZE[tier])
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b))
    expect(sizes.every((size) => size % 8 === 0)).toBe(true)
  })

  it('should_explain_the_double_click_on_an_empty_map', async () => {
    renderCanvas(emptyCanvasView())
    expect(await screen.findByText(/Double-clique n’importe où/)).toBeDefined()
  })

  it('should_create_an_idea_where_the_user_double_clicks', async () => {
    const user = userEvent.setup()
    const { api, container } = renderCanvas()
    fireEvent.doubleClick(await pane(container), { clientX: 200, clientY: 120 })
    const input = await screen.findByLabelText('Nouvelle idée')
    await user.type(input, 'Louer un studio photo{Enter}')
    await waitFor(() =>
      expect(api.invoke).toHaveBeenCalledWith('neuron:create', {
        text: 'Louer un studio photo',
        position: { x: expect.any(Number), y: expect.any(Number) }
      })
    )
    await waitFor(() => expect(screen.queryByLabelText('Nouvelle idée')).toBeNull())
    expect(useUiStore.getState().bornId).toBe(NEW_ID)
  })

  it('should_never_create_an_idea_when_double_clicking_an_object_of_the_map', async () => {
    const { api, container } = renderCanvas()
    await pane(container)
    const idea = await waitFor(() => screen.getByRole('group', { name: /Acheter un flash cobra/ }))
    fireEvent.doubleClick(idea, { clientX: 200, clientY: 120 })
    const edge = container.querySelector('.react-flow__edge')
    if (edge !== null) fireEvent.doubleClick(edge, { clientX: 300, clientY: 200 })
    const control = container.querySelector('.react-flow__controls button')
    if (control !== null) fireEvent.doubleClick(control)
    expect(screen.queryByLabelText('Nouvelle idée')).toBeNull()
    expect(api.invoke).not.toHaveBeenCalledWith('neuron:create', expect.anything())
    // Le vide, lui, crée toujours une idée.
    fireEvent.doubleClick(await pane(container), { clientX: 200, clientY: 120 })
    expect(await screen.findByLabelText('Nouvelle idée')).toBeDefined()
  })

  it('should_cancel_the_new_idea_with_escape', async () => {
    const user = userEvent.setup()
    const { api, container } = renderCanvas()
    fireEvent.doubleClick(await pane(container), { clientX: 200, clientY: 120 })
    await user.type(await screen.findByLabelText('Nouvelle idée'), 'Brouillon{Escape}')
    expect(screen.queryByLabelText('Nouvelle idée')).toBeNull()
    expect(api.invoke).not.toHaveBeenCalledWith('neuron:create', expect.anything())
  })

  it('should_open_the_claude_conversation_of_an_idea_with_a_click_and_close_it_with_a_click_in_the_void', async () => {
    const idea = canvasView().ideas[0]
    if (idea === undefined) throw new Error('fixture')
    const chat = {
      neuronId: RAW_ID,
      title: idea.title,
      messages: [],
      sheet: { resume: '', points_cles: [], decisions: [], questions_ouvertes: [], manques: [] },
      maturity: null,
      busy: false,
      partial: '',
      usage: null,
      folder: null
    }
    const { container, api } = renderCanvas(canvasView(), {
      'chat:open': () => chat,
      'chat:close': () => ({ ok: true })
    })
    const node = await waitFor(() => screen.getByRole('group', { name: /Acheter un flash cobra/ }))
    fireEvent.click(node)
    expect(useUiStore.getState()).toMatchObject({ chatNeuronId: RAW_ID, openRootId: null })
    const panel = await screen.findByRole('complementary', { name: 'Conversation du neurone' })
    expect(await within(panel).findByRole('button', { name: 'Commencer le brainstorm' })).toBeDefined()
    // Spec 008 : ouvrir une idée ne fait plus jamais brainstormer l'IA locale.
    expect(api.invoke).not.toHaveBeenCalledWith('growth:develop', expect.anything())
    // La carte reste affichée à côté du volet.
    expect(screen.getByRole('group', { name: /Mission mariage/ })).toBeDefined()

    fireEvent.click(await pane(container))
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Conversation du neurone' })).toBeNull())
    expect(useUiStore.getState().chatNeuronId).toBeNull()
  })

  it('should_warn_before_removing_an_idea_and_offer_to_undo', async () => {
    const user = userEvent.setup()
    const { api } = renderCanvas(canvasView(), { 'neuron:remove': () => ({ batchId: 'lot-1' }) })
    const node = await waitFor(() => screen.getByRole('group', { name: /Acheter un flash cobra/ }))
    node.focus()
    await user.keyboard('{Shift>}{F10}{/Shift}')
    const menu = await screen.findByRole('dialog', { name: 'Acheter un flash cobra' })
    await user.click(within(menu).getByRole('button', { name: 'Supprimer l’idée…' }))
    // Avertissement : rien n'est supprimé avant la confirmation ; « Garder » annule.
    expect(within(menu).getByRole('alert').textContent).toMatch(/tout son contenu/)
    expect(api.invoke).not.toHaveBeenCalledWith('neuron:remove', expect.anything())
    await user.click(within(menu).getByRole('button', { name: 'Garder' }))
    expect(within(menu).queryByRole('alert')).toBeNull()
    await user.click(within(menu).getByRole('button', { name: 'Supprimer l’idée…' }))
    await user.click(within(menu).getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => expect(api.invoke).toHaveBeenCalledWith('neuron:remove', { rootId: RAW_ID }))
    await waitFor(() => expect(useUiStore.getState().toast).toMatchObject({ undoBatchId: 'lot-1' }))
  })

  it('should_link_two_ideas_from_the_menu_with_the_keyboard', async () => {
    const user = userEvent.setup()
    const { api } = renderCanvas()
    const node = await waitFor(() => screen.getByRole('group', { name: /Acheter un flash cobra/ }))
    node.focus()
    await user.keyboard('{Shift>}{F10}{/Shift}')
    const menu = await screen.findByRole('dialog', { name: 'Acheter un flash cobra' })
    await user.click(within(menu).getByRole('button', { name: 'Relier à une autre idée…' }))
    await user.selectOptions(within(menu).getByLabelText('Relier à'), HATCHED_A_ID)
    await user.type(within(menu).getByLabelText('Libellé du lien (facultatif)'), 'éclairage')
    await user.click(within(menu).getByRole('button', { name: 'Relier' }))
    await waitFor(() =>
      expect(api.invoke).toHaveBeenCalledWith('links:create', {
        aRootId: RAW_ID,
        bRootId: HATCHED_A_ID,
        label: 'éclairage'
      })
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('should_say_when_the_link_already_exists', async () => {
    const user = userEvent.setup()
    renderCanvas(canvasView(), {
      'links:create': () => {
        throw new FakeIpcError('DUPLICATE')
      }
    })
    const node = await waitFor(() => screen.getByRole('group', { name: /Acheter un flash cobra/ }))
    node.focus()
    await user.keyboard('{Shift>}{F10}{/Shift}')
    const menu = await screen.findByRole('dialog', { name: 'Acheter un flash cobra' })
    await user.click(within(menu).getByRole('button', { name: 'Relier à une autre idée…' }))
    await user.selectOptions(within(menu).getByLabelText('Relier à'), HATCHED_A_ID)
    await user.type(within(menu).getByLabelText('Libellé du lien (facultatif)'), 'éclairage')
    await user.click(within(menu).getByRole('button', { name: 'Relier' }))
    await waitFor(() => expect(useUiStore.getState().toast?.text).toMatch(/déjà reliées/))
    expect(screen.getByRole('dialog', { name: 'Acheter un flash cobra' })).toBeDefined()
  })
})
