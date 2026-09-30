import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { buildGraph, computeLayout, stepNodeId } from '../../../src/renderer/src/canvas/buildGraph'
import { IdeasCanvas } from '../../../src/renderer/src/canvas/IdeasCanvas'
import { useWidgetReview } from '../../../src/renderer/src/widgets/useWidgetIo'
import { DEFAULT_APP_SETTINGS } from '../../../src/shared/ipc/app'
import type { BlockView, IdeasCanvasView } from '../../../src/shared/ipc/canvas'
import type { IdeaPart, WidgetInputsView, WidgetIoStateView } from '../../../src/shared/ipc/widgetIo'
import type { WidgetView } from '../../../src/shared/ipc/widgets'
import { canvasView, HATCHED_A_ID } from '../../fixtures/ui/canvas'
import { installFakeApi } from './support/fakeApi'
import { installReactFlowMocks } from './support/reactFlowMocks'

const BLOCK_ID = '00000000-0000-4000-8000-0000000000c2'
const VERSION_ID = '00000000-0000-4000-8000-0000000000d1'
const INPUT_ID = '00000000-0000-4000-8000-0000000000e1'

const block: BlockView = {
  id: BLOCK_ID,
  kind: 'widget',
  x: 0,
  y: 0,
  width: 520,
  height: 440,
  text: null,
  versionId: VERSION_ID,
  sourceBlockId: null
}

const widget: WidgetView = {
  blockId: BLOCK_ID,
  current: {
    id: VERSION_ID,
    number: 1,
    title: 'Budget',
    summary: 'Version 1',
    model: 'claude-sonnet-5-5',
    createdAt: '2026-09-30T00:00:00.000Z',
    html: '<main></main>',
    css: 'main{}',
    ts: 'gi.onInputs((inputs) => render(inputs))'
  },
  versions: [
    {
      id: VERSION_ID,
      number: 1,
      title: 'Budget',
      summary: 'Version 1',
      model: 'claude-sonnet-5-5',
      createdAt: '2026-09-30T00:00:00.000Z'
    }
  ],
  messages: []
}

const state = (approved: boolean, parts: readonly IdeaPart[] = ['identity', 'original']): WidgetIoStateView => ({
  blockId: BLOCK_ID,
  approved,
  inputs: [
    {
      id: INPUT_ID,
      blockId: BLOCK_ID,
      sourceKind: 'idea',
      sourceId: HATCHED_A_ID,
      title: 'Mission mariage',
      parts: [...parts]
    }
  ]
})

const view = (): IdeasCanvasView => ({
  ...canvasView(),
  blocks: [block],
  io: [{ id: INPUT_ID, blockId: BLOCK_ID, sourceKind: 'idea', sourceId: HATCHED_A_ID }]
})

function renderCanvas(handlers: Parameters<typeof installFakeApi>[0]) {
  const api = installFakeApi({
    'canvas:get': view,
    'canvas:savePositions': () => ({ ok: true }),
    'app:getSettings': () => DEFAULT_APP_SETTINGS,
    'widget:get': () => widget,
    'widgetIo:inputs': (): WidgetInputsView => ({ approved: false, inputs: [] }),
    ...handlers
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <IdeasCanvas />
    </QueryClientProvider>
  )
  return api
}

const node = (): Promise<HTMLElement> => screen.findByRole('region', { name: /^Widget IA/ })

describe('entrées d’un widget sur la carte (spec 005 lot 1)', () => {
  beforeAll(() => installReactFlowMocks())
  beforeEach(() => {
    useUiStore.setState({ toast: null, bornId: null, openRootId: null })
    useWidgetReview.setState({ blockId: null })
  })

  it('should_draw_a_line_from_the_idea_or_the_step_to_the_widget', () => {
    const base = view()
    const withStep: IdeasCanvasView = {
      ...base,
      steps: [{ rootId: HATCHED_A_ID, text: 'Comparer', position: null }],
      io: [...base.io, { id: 'io-2', blockId: BLOCK_ID, sourceKind: 'step', sourceId: HATCHED_A_ID }]
    }
    const lines = buildGraph(withStep, computeLayout(withStep)).stepEdges.filter((edge) => edge.data?.style === 'io')
    expect(lines.map((edge) => [edge.source, edge.target])).toEqual([
      [HATCHED_A_ID, BLOCK_ID],
      [stepNodeId(HATCHED_A_ID), BLOCK_ID]
    ])
  })

  it('should_warn_that_nothing_is_transmitted_until_the_version_is_reviewed', async () => {
    renderCanvas({ 'widgetIo:state': () => state(false) })
    const alert = await within(await node()).findByRole('alert')
    expect(alert.textContent).toMatch(/ne reçoit rien tant que tu n’as pas autorisé cette version/)
    expect(within(await node()).getByRole('button', { name: 'Entrées du widget : 1, à revoir' })).toBeDefined()
  })

  it('should_show_what_the_widget_reads_and_its_code_then_authorize_this_version', async () => {
    const user = userEvent.setup()
    const api = renderCanvas({ 'widgetIo:state': () => state(false), 'widgetIo:approve': () => state(true) })
    await user.click(await within(await node()).findByRole('button', { name: 'Revoir' }))

    const dialog = await screen.findByRole('dialog', { name: 'Revue du widget « Budget »' })
    expect(within(dialog).getByText('Lire l’idée « Mission mariage »')).toBeDefined()
    expect((within(dialog).getByLabelText('Texte d’origine') as HTMLInputElement).checked).toBe(true)
    expect((within(dialog).getByLabelText('Questions et réponses') as HTMLInputElement).checked).toBe(false)
    // Le code est montré comme du texte, jamais interprété.
    expect(within(dialog).getByRole('tabpanel').textContent).toBe('gi.onInputs((inputs) => render(inputs))')

    await user.click(within(dialog).getByRole('button', { name: 'Autoriser cette version' }))
    await waitFor(() => expect(api.invoke).toHaveBeenCalledWith('widgetIo:approve', { blockId: BLOCK_ID }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /^Revue du widget/ })).toBeNull())
    await waitFor(async () => expect(within(await node()).queryByRole('alert')).toBeNull())
  })

  it('should_let_the_user_choose_the_transmitted_parts_and_disconnect_a_source', async () => {
    const user = userEvent.setup()
    const api = renderCanvas({
      'widgetIo:state': () => state(false),
      'widgetIo:setParts': () => state(false, ['identity']),
      'widgetIo:disconnect': () => ({ batchId: 'lot-7', blockId: BLOCK_ID })
    })
    await user.click(await within(await node()).findByRole('button', { name: 'Revoir' }))
    const dialog = await screen.findByRole('dialog', { name: /^Revue du widget/ })
    await user.click(within(dialog).getByLabelText('Texte d’origine'))
    expect(api.invoke).toHaveBeenCalledWith('widgetIo:setParts', { inputId: INPUT_ID, parts: ['identity'] })

    await user.click(within(dialog).getByRole('button', { name: /^Débrancher/ }))
    await waitFor(() => expect(api.invoke).toHaveBeenCalledWith('widgetIo:disconnect', { inputId: INPUT_ID }))
    await waitFor(() => expect(useUiStore.getState().toast).toMatchObject({ undoBatchId: 'lot-7' }))
  })

  it('should_hand_the_inputs_to_its_own_frame_only_once_the_frame_is_ready', async () => {
    const given: WidgetInputsView = {
      approved: true,
      inputs: [{ kind: 'idea', id: HATCHED_A_ID, title: 'Mission mariage' }]
    }
    const api = renderCanvas({ 'widgetIo:state': () => state(true), 'widgetIo:inputs': () => given })
    const frame = (await within(await node()).findByTitle('Budget')) as HTMLIFrameElement
    await waitFor(() =>
      expect(api.invoke).toHaveBeenCalledWith('widgetIo:inputs', { blockId: BLOCK_ID, versionId: VERSION_ID })
    )
    const target = frame.contentWindow
    if (target === null) throw new Error('cadre attendu')
    const post = vi.spyOn(target, 'postMessage')

    // Un message venu d'ailleurs (autre fenêtre, autre cadre) n'obtient rien.
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'gi:ready' }, source: window }))
    })
    expect(post).not.toHaveBeenCalled()
    // Un message hors contrat du bon cadre non plus.
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'gi:steal' }, source: target }))
    })
    expect(post).not.toHaveBeenCalled()

    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'gi:ready' }, source: target }))
    })
    expect(post).toHaveBeenCalledWith({ type: 'gi:inputs', inputs: given.inputs }, '*')
  })

  it('should_open_the_review_from_the_inputs_button_of_an_authorized_widget', async () => {
    renderCanvas({ 'widgetIo:state': () => state(true) })
    fireEvent.click(await within(await node()).findByRole('button', { name: 'Entrées du widget : 1' }))
    const dialog = await screen.findByRole('dialog', { name: /^Revue du widget/ })
    expect(within(dialog).getByRole('status').textContent).toMatch(/Cette version est autorisée/)
    expect(within(dialog).queryByRole('button', { name: 'Autoriser cette version' })).toBeNull()
  })
})
