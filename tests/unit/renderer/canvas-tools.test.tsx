import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { IdeasCanvas } from '../../../src/renderer/src/canvas/IdeasCanvas'
import type { BlockView, IdeasCanvasView } from '../../../src/shared/ipc/canvas'
import { DEFAULT_APP_SETTINGS } from '../../../src/shared/ipc/app'
import { expectNoAxeViolations } from '../../support/axe'
import { canvasView, RAW_ID } from '../../fixtures/ui/canvas'
import { installFakeApi } from './support/fakeApi'
import { installReactFlowMocks } from './support/reactFlowMocks'

const LABEL_ID = '00000000-0000-4000-8000-0000000000c1'
const WIDGET_ID = '00000000-0000-4000-8000-0000000000c2'

const block = (patch: Partial<BlockView>): BlockView => ({
  id: LABEL_ID,
  kind: 'label',
  x: 0,
  y: 0,
  width: 240,
  height: 72,
  text: 'Zone mariage',
  versionId: null,
  ...patch
})

function renderCanvas(view: IdeasCanvasView = canvasView()) {
  const api = installFakeApi({
    'canvas:get': () => view,
    'canvas:savePositions': () => ({ ok: true }),
    'app:getSettings': () => DEFAULT_APP_SETTINGS,
    'canvas:createBlock': (payload) => block({ id: LABEL_ID, ...(payload as object), text: '' }),
    'canvas:updateBlock': (payload) => block(payload as Partial<BlockView>),
    'canvas:deleteBlock': () => ({ batchId: 'b1' }),
    'widget:get': () => ({ blockId: WIDGET_ID, current: null, versions: [], messages: [] })
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(
    <QueryClientProvider client={client}>
      <IdeasCanvas />
    </QueryClientProvider>
  )
  return { api, ...result }
}

const pane = async (): Promise<Element> => {
  await screen.findByText('1 brute · 1 en dév. · 2 écloses')
  const element = document.querySelector('.react-flow__pane')
  if (element === null) throw new Error('fond de carte introuvable')
  return element
}

describe('boîte à outils de la carte (spec 004)', () => {
  beforeAll(() => installReactFlowMocks())
  beforeEach(() => useUiStore.setState({ view: 'ideas', openRootId: null, bornId: null, toast: null }))

  it('should_open_the_tools_at_the_right_click_with_the_first_tool_focused_and_close_on_escape', async () => {
    const user = userEvent.setup()
    renderCanvas()
    fireEvent.contextMenu(await pane(), { clientX: 300, clientY: 200 })
    const menu = await screen.findByRole('menu', { name: 'Outils de la carte' })
    const items = within(menu).getAllByRole('menuitem')
    expect(items).toHaveLength(3)
    for (const name of [/^Nouvelle idée/, /^Note/, /^Widget IA/]) {
      expect(within(menu).getByRole('menuitem', { name })).toBeDefined()
    }
    expect(document.activeElement).toBe(items[0])
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(items[1])
    await user.keyboard('{ArrowUp}{ArrowUp}')
    expect(document.activeElement).toBe(items[2])
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('should_create_a_note_and_a_widget_where_the_right_click_happened', async () => {
    const user = userEvent.setup()
    const { api } = renderCanvas()
    fireEvent.contextMenu(await pane(), { clientX: 300, clientY: 200 })
    await user.click(await screen.findByRole('menuitem', { name: /^Note/ }))
    expect(api.invoke).toHaveBeenCalledWith('canvas:createBlock', {
      kind: 'label',
      x: expect.any(Number),
      y: expect.any(Number)
    })
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.contextMenu(await pane(), { clientX: 320, clientY: 220 })
    await user.click(await screen.findByRole('menuitem', { name: /^Widget IA/ }))
    expect(api.invoke).toHaveBeenCalledWith('canvas:createBlock', expect.objectContaining({ kind: 'widget' }))
  })

  it('should_open_the_idea_prompt_at_the_right_click_for_a_new_idea', async () => {
    const user = userEvent.setup()
    renderCanvas()
    fireEvent.contextMenu(await pane(), { clientX: 300, clientY: 200 })
    await user.click(await screen.findByRole('menuitem', { name: /^Nouvelle idée/ }))
    expect(await screen.findByRole('textbox', { name: 'Nouvelle idée' })).toBeDefined()
  })

  it('should_not_open_the_tools_on_an_idea', async () => {
    renderCanvas()
    await pane()
    const node = await waitFor(() => {
      const found = document.querySelector(`.react-flow__node[data-id="${RAW_ID}"]`)
      if (found === null) throw new Error('idée introuvable')
      return found
    })
    fireEvent.contextMenu(node, { clientX: 10, clientY: 10 })
    expect(screen.queryByRole('menu', { name: 'Outils de la carte' })).toBeNull()
  })

  it('should_edit_a_note_on_double_click_and_save_its_text_on_escape', async () => {
    const user = userEvent.setup()
    const { api } = renderCanvas({ ...canvasView(), blocks: [block({})] })
    const text = await screen.findByText('Zone mariage')
    fireEvent.doubleClick(text)
    const field = await screen.findByRole('textbox', { name: 'Texte de la note' })
    await user.clear(field)
    await user.type(field, 'Zone photo{Escape}')
    expect(api.invoke).toHaveBeenCalledWith(
      'canvas:updateBlock',
      expect.objectContaining({ id: LABEL_ID, text: 'Zone photo' })
    )
  })

  it('should_open_a_note_just_created_in_writing_mode', async () => {
    useUiStore.setState({ bornId: LABEL_ID })
    renderCanvas({ ...canvasView(), blocks: [block({ text: '' })] })
    expect(await screen.findByRole('textbox', { name: 'Texte de la note' })).toBeDefined()
  })

  it('should_delete_a_widget_and_offer_to_undo', async () => {
    const user = userEvent.setup()
    const { api } = renderCanvas({ ...canvasView(), blocks: [block({ id: WIDGET_ID, kind: 'widget', text: null })] })
    await user.click(await screen.findByRole('button', { name: 'Supprimer le widget' }))
    expect(api.invoke).toHaveBeenCalledWith('canvas:deleteBlock', { id: WIDGET_ID })
    await waitFor(() => expect(useUiStore.getState().toast?.text).toBe('Widget supprimé.'))
    expect(useUiStore.getState().toast?.undoBatchId).toBe('b1')
  })

  it('should_have_no_accessibility_violation_with_the_tools_open', async () => {
    const { container } = renderCanvas({ ...canvasView(), blocks: [block({})] })
    fireEvent.contextMenu(await pane(), { clientX: 300, clientY: 200 })
    await screen.findByRole('menu')
    await expectNoAxeViolations(container)
  })
})
