import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { buildGraph, computeLayout } from '../../../src/renderer/src/canvas/buildGraph'
import { IdeasCanvas } from '../../../src/renderer/src/canvas/IdeasCanvas'
import { createThrottle } from '../../../src/renderer/src/widgets/emitThrottle'
import { DEFAULT_APP_SETTINGS } from '../../../src/shared/ipc/app'
import type { BlockView, IdeasCanvasView } from '../../../src/shared/ipc/canvas'
import type {
  WidgetEmitView,
  WidgetInputsView,
  WidgetIoStateView,
  WidgetResultView
} from '../../../src/shared/ipc/widgetIo'
import type { WidgetView } from '../../../src/shared/ipc/widgets'
import { canvasView } from '../../fixtures/ui/canvas'
import { FakeIpcError, installFakeApi } from './support/fakeApi'
import { installReactFlowMocks } from './support/reactFlowMocks'

const WIDGET_ID = '00000000-0000-4000-8000-0000000000c2'
const RESULT_ID = '00000000-0000-4000-8000-0000000000c3'
const VERSION_ID = '00000000-0000-4000-8000-0000000000d1'

const widgetBlock: BlockView = {
  id: WIDGET_ID,
  kind: 'widget',
  x: 0,
  y: 0,
  width: 520,
  height: 440,
  text: null,
  versionId: VERSION_ID,
  sourceBlockId: null,
  title: null,
  parentBlockId: null,
  frameId: null,
  origin: 'user'
}
const resultBlock: BlockView = {
  id: RESULT_ID,
  kind: 'result',
  x: 600,
  y: 0,
  width: 400,
  height: 320,
  text: null,
  versionId: null,
  sourceBlockId: WIDGET_ID,
  title: null,
  parentBlockId: null,
  frameId: null,
  origin: 'user'
}

const widget: WidgetView = {
  blockId: WIDGET_ID,
  current: {
    id: VERSION_ID,
    number: 1,
    title: 'Budget',
    summary: 'Version 1',
    model: 'claude-sonnet-5-5',
    createdAt: '2026-09-30T00:00:00.000Z',
    html: '<main></main>',
    css: '',
    ts: 'gi.output({ total: 1250 })'
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

const result: WidgetResultView = {
  blockId: RESULT_ID,
  widgetBlockId: WIDGET_ID,
  widgetTitle: 'Budget',
  data: { total: 1250 },
  updatedAt: '2026-09-30T00:00:00.000Z'
}

const view = (blocks: readonly BlockView[]): IdeasCanvasView => ({ ...canvasView(), blocks })

function renderCanvas(blocks: readonly BlockView[], handlers: Parameters<typeof installFakeApi>[0] = {}) {
  const api = installFakeApi({
    'canvas:get': () => view(blocks),
    'canvas:savePositions': () => ({ ok: true }),
    'app:getSettings': () => DEFAULT_APP_SETTINGS,
    'widget:get': () => widget,
    'widgetIo:state': (): WidgetIoStateView => ({ blockId: WIDGET_ID, inputs: [], approved: false }),
    'widgetIo:inputs': (): WidgetInputsView => ({ approved: true, inputs: [] }),
    'widgetIo:result': () => result,
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

const frameOf = async (region: RegExp, title: string): Promise<Window> => {
  const node = await screen.findByRole('region', { name: region })
  const frame = (await within(node).findByTitle(title)) as HTMLIFrameElement
  if (frame.contentWindow === null) throw new Error('cadre attendu')
  return frame.contentWindow
}

const says = (source: Window, data: unknown): void => {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data, source }))
  })
}

describe('regroupement des résultats émis en rafale (spec 005)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('should_send_the_first_value_at_once_then_only_the_last_one_of_each_interval', () => {
    const sent: number[] = []
    const throttle = createThrottle<number>((value) => sent.push(value), 500)
    throttle.push(1)
    throttle.push(2)
    throttle.push(3)
    expect(sent).toEqual([1])
    vi.advanceTimersByTime(499)
    expect(sent).toEqual([1])
    vi.advanceTimersByTime(1)
    expect(sent).toEqual([1, 3])
    // Pendant l'intervalle suivant, une nouvelle valeur attend encore son tour.
    throttle.push(4)
    expect(sent).toEqual([1, 3])
    vi.advanceTimersByTime(500)
    expect(sent).toEqual([1, 3, 4])
    // Au repos, la valeur suivante repart aussitôt.
    vi.advanceTimersByTime(500)
    throttle.push(5)
    expect(sent).toEqual([1, 3, 4, 5])
  })

  it('should_send_nothing_more_once_cancelled', () => {
    const sent: number[] = []
    const throttle = createThrottle<number>((value) => sent.push(value), 500)
    throttle.push(1)
    throttle.push(2)
    throttle.cancel()
    vi.advanceTimersByTime(1000)
    expect(sent).toEqual([1])
  })

  it('should_send_the_waiting_value_at_once_when_flushed', () => {
    const sent: number[] = []
    const throttle = createThrottle<number>((value) => sent.push(value), 500)
    throttle.push(1)
    throttle.push(2)
    throttle.flush()
    expect(sent).toEqual([1, 2])
    vi.advanceTimersByTime(1000)
    expect(sent).toEqual([1, 2])
  })
})

describe('sortie d’un widget sur la carte (spec 005 lot 2)', () => {
  beforeAll(() => installReactFlowMocks())
  beforeEach(() => useUiStore.setState({ toast: null, bornId: null }))

  it('should_link_the_result_frame_to_its_widget', () => {
    const canvas = view([widgetBlock, resultBlock])
    const graph = buildGraph(canvas, computeLayout(canvas))
    expect(graph.nodes.find((node) => node.id === RESULT_ID)).toMatchObject({
      type: 'result',
      ariaLabel: 'Résultat d’un widget'
    })
    expect(graph.edges.filter((edge) => edge.data?.style === 'io').map((edge) => [edge.source, edge.target])).toEqual([
      [WIDGET_ID, RESULT_ID]
    ])
  })

  it('should_relay_a_result_of_its_own_frame_to_the_main_process_and_refresh_the_map', async () => {
    const emitted: WidgetEmitView = { resultBlockId: RESULT_ID, created: true }
    const api = renderCanvas([widgetBlock], { 'widgetIo:emit': () => emitted })
    const frame = await frameOf(/^Widget IA/, 'Budget')

    // Un résultat venu d'une autre fenêtre n'est pas relayé.
    says(window, { type: 'gi:output', data: { total: 1 } })
    expect(api.invoke).not.toHaveBeenCalledWith('widgetIo:emit', expect.anything())

    says(frame, { type: 'gi:output', data: { total: 1250 } })
    await waitFor(() =>
      expect(api.invoke).toHaveBeenCalledWith('widgetIo:emit', {
        blockId: WIDGET_ID,
        versionId: VERSION_ID,
        data: { total: 1250 }
      })
    )
    // Premier résultat : le cadre vient d'être créé, la carte est relue.
    await waitFor(() => expect(api.invoke.mock.calls.filter(([channel]) => channel === 'canvas:get').length).toBe(2))
  })

  it('should_tell_the_widget_why_its_result_was_refused', async () => {
    renderCanvas([widgetBlock], {
      'widgetIo:emit': () => {
        throw new FakeIpcError('VALIDATION')
      }
    })
    const frame = await frameOf(/^Widget IA/, 'Budget')
    const post = vi.spyOn(frame, 'postMessage')
    says(frame, { type: 'gi:output', data: { total: 1 } })
    await waitFor(() => expect(post).toHaveBeenCalledWith({ type: 'gi:refused', message: expect.any(String) }, '*'))
  })

  it('should_give_the_result_frame_the_result_of_its_widget_once_it_is_ready', async () => {
    const api = renderCanvas([widgetBlock, resultBlock])
    const frame = await frameOf(/^Résultat · Budget$/, 'Résultat · Budget')
    await waitFor(() => expect(api.invoke).toHaveBeenCalledWith('widgetIo:result', { blockId: RESULT_ID }))
    const post = vi.spyOn(frame, 'postMessage')
    says(frame, { type: 'gi:ready' })
    expect(post).toHaveBeenCalledWith({ type: 'gi:inputs', inputs: [{ kind: 'result', data: { total: 1250 } }] }, '*')
    // Un cadre résultat n'émet rien : un « résultat » venu de lui est ignoré.
    says(frame, { type: 'gi:output', data: { total: 9 } })
    expect(api.invoke).not.toHaveBeenCalledWith('widgetIo:emit', expect.anything())
  })

  it('should_delete_the_result_frame_and_offer_to_undo', async () => {
    const user = userEvent.setup()
    const api = renderCanvas([widgetBlock, resultBlock], { 'canvas:deleteBlock': () => ({ batchId: 'lot-9' }) })
    const node = await screen.findByRole('region', { name: /^Résultat · Budget$/ })
    await user.click(within(node).getByRole('button', { name: 'Supprimer le cadre résultat' }))
    await waitFor(() => expect(api.invoke).toHaveBeenCalledWith('canvas:deleteBlock', { id: RESULT_ID }))
    await waitFor(() => expect(useUiStore.getState().toast).toMatchObject({ undoBatchId: 'lot-9' }))
  })
})
