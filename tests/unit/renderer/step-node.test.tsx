import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { buildGraph, computeLayout, stepNodeId } from '../../../src/renderer/src/canvas/buildGraph'
import { IdeasCanvas } from '../../../src/renderer/src/canvas/IdeasCanvas'
import { DEFAULT_APP_SETTINGS } from '../../../src/shared/ipc/app'
import type { IdeasCanvasView } from '../../../src/shared/ipc/canvas'
import { canvasView, HATCHED_A_ID } from '../../fixtures/ui/canvas'
import { installFakeApi } from './support/fakeApi'
import { installReactFlowMocks } from './support/reactFlowMocks'

const NEW_ID = '00000000-0000-4000-8000-0000000000f1'
const STEP = 'Créer une page HTML simple avec un champ de texte.'

const withStep = (position: { x: number; y: number } | null = null): IdeasCanvasView => ({
  ...canvasView(),
  steps: [{ rootId: HATCHED_A_ID, text: STEP, position }]
})

function renderCanvas(handlers: Parameters<typeof installFakeApi>[0] = {}) {
  const api = installFakeApi({
    'canvas:get': () => withStep(),
    'canvas:savePositions': () => ({ ok: true }),
    'app:getSettings': () => DEFAULT_APP_SETTINGS,
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

describe('prochaine étape sur la carte (FR-037)', () => {
  beforeAll(() => installReactFlowMocks())
  beforeEach(() => useUiStore.setState({ toast: null, bornId: null, openRootId: null }))

  it('should_place_the_step_next_to_its_idea_and_link_it_to_that_idea', () => {
    const view = withStep()
    const graph = buildGraph(view, computeLayout(view))
    const node = graph.nodes.find((entry) => entry.id === stepNodeId(HATCHED_A_ID))
    expect(node).toMatchObject({ type: 'step', deletable: false })
    expect(node?.ariaLabel).toBe(`Prochaine étape de « Mission mariage », non modifiable : ${STEP}`)
    expect(graph.stepEdges).toEqual([
      expect.objectContaining({ source: HATCHED_A_ID, target: stepNodeId(HATCHED_A_ID), data: { style: 'step' } })
    ])
  })

  it('should_keep_a_dragged_step_where_it_was_left', () => {
    const view = withStep({ x: 640, y: -320 })
    const graph = buildGraph(view, computeLayout(view))
    expect(graph.nodes.find((entry) => entry.id === stepNodeId(HATCHED_A_ID))?.position).toEqual({ x: 640, y: -320 })
  })

  it('should_show_the_step_as_read_only_text', async () => {
    renderCanvas()
    expect(await screen.findByText(STEP)).toBeDefined()
    expect(screen.queryByRole('textbox', { name: /étape/i })).toBeNull()
  })

  it('should_start_a_new_idea_from_the_step_and_link_it_to_the_original_idea', async () => {
    const api = renderCanvas({
      'neuron:create': () => ({ ...canvasView().ideas[0], id: NEW_ID, title: STEP }),
      'links:create': () => ({ ok: true })
    })
    fireEvent.click(await screen.findByRole('button', { name: `Brainstormer cette étape : ${STEP}` }))
    await waitFor(() =>
      expect(api.invoke).toHaveBeenCalledWith('neuron:create', expect.objectContaining({ text: STEP }))
    )
    await waitFor(() =>
      expect(api.invoke).toHaveBeenCalledWith('links:create', {
        aRootId: HATCHED_A_ID,
        bRootId: NEW_ID,
        label: 'prochaine étape'
      })
    )
    expect(useUiStore.getState().bornId).toBe(NEW_ID)
  })

  it('should_explain_when_the_new_idea_cannot_be_created', async () => {
    renderCanvas({
      'neuron:create': () => {
        throw new Error('panne')
      }
    })
    fireEvent.click(await screen.findByRole('button', { name: `Brainstormer cette étape : ${STEP}` }))
    await waitFor(() => expect(useUiStore.getState().toast?.text).toBe('La nouvelle idée n’a pas pu être créée.'))
  })
})
