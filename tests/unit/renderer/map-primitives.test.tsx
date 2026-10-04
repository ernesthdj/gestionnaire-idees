import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useMainEvents } from '../../../src/renderer/src/app/useMainEvents'
import { Toast } from '../../../src/renderer/src/app/Toast'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { buildGraph, computeLayout } from '../../../src/renderer/src/canvas/buildGraph'
import { ClaudeCodeSettings } from '../../../src/renderer/src/pages/settings/claude/ClaudeCodeSettings'
import type { BlockView, IdeasCanvasView } from '../../../src/shared/ipc/canvas'
import { canvasView, RAW_ID } from '../../fixtures/ui/canvas'
import { installFakeApi } from './support/fakeApi'
import { installReactFlowMocks } from './support/reactFlowMocks'

const FRAME = '00000000-0000-4000-8000-0000000000a1'
const NOTE = '00000000-0000-4000-8000-0000000000a2'
const CHILD = '00000000-0000-4000-8000-0000000000a3'

const block = (id: string, kind: BlockView['kind'], extra: Partial<BlockView> = {}): BlockView => ({
  id,
  kind,
  x: 0,
  y: 0,
  width: 240,
  height: 96,
  text: null,
  versionId: null,
  sourceBlockId: null,
  title: null,
  parentBlockId: null,
  frameId: null,
  origin: 'claude',
  ...extra
})

const drawn = (): IdeasCanvasView => ({
  ...canvasView(),
  blocks: [
    block(FRAME, 'frame', { title: 'Mariage', width: 800, height: 600 }),
    block(NOTE, 'note', { title: 'Prestataires', frameId: FRAME }),
    block(CHILD, 'note', {
      title: '<b>Photographe</b>',
      text: '<script>x</script>',
      parentBlockId: NOTE,
      frameId: FRAME
    })
  ],
  mapLinks: [
    {
      id: 'l1',
      from: { kind: 'idea', id: RAW_ID },
      to: { kind: 'block', id: NOTE },
      label: 'budget',
      origin: 'claude',
      relation: null
    },
    {
      id: 'l2',
      from: { kind: 'block', id: NOTE },
      to: { kind: 'block', id: 'absent' },
      label: null,
      origin: 'claude',
      relation: null
    }
  ]
})

describe('primitives du pont MCP sur la carte (spec 007)', () => {
  beforeAll(() => installReactFlowMocks())
  beforeEach(() => useUiStore.setState({ toast: null }))

  it('should_map_notes_and_frames_to_their_nodes_with_the_frame_behind', () => {
    const view = drawn()
    const graph = buildGraph(view, computeLayout(view))
    expect(graph.nodes.find((node) => node.id === FRAME)).toMatchObject({ type: 'frame', zIndex: -1 })
    expect(graph.nodes.find((node) => node.id === NOTE)).toMatchObject({
      type: 'mapNote',
      ariaLabel: 'Note « Prestataires », par Claude'
    })
  })

  it('should_draw_the_note_tree_and_only_the_free_links_whose_ends_are_visible', () => {
    const view = drawn()
    const graph = buildGraph(view, computeLayout(view))
    expect(graph.stepEdges).toContainEqual(expect.objectContaining({ source: NOTE, target: CHILD }))
    expect(graph.mapEdges).toEqual([
      expect.objectContaining({ id: 'map-l1', source: RAW_ID, target: NOTE, data: { label: 'budget' } })
    ])
  })

  it('should_announce_a_claude_write_and_offer_to_undo_it', async () => {
    const api = installFakeApi({ 'history:undo': () => ({ undoBatchId: 'u1' }) })
    function Host(): React.JSX.Element {
      useMainEvents()
      return <Toast />
    }
    const client = new QueryClient()
    render(
      <QueryClientProvider client={client}>
        <Host />
      </QueryClientProvider>
    )
    act(() => api.emit('map:changed', { batchId: 'b1', summary: 'Claude : 3 notes, 1 cadre', count: 4 }))
    expect(await screen.findByText('Claude : 3 notes, 1 cadre')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /annuler/i }))
    expect(api.invoke).toHaveBeenCalledWith('history:undo', { batchId: 'b1' })
  })
})

describe('Réglages › Claude Code (spec 007 US5)', () => {
  it('should_show_the_bridge_state_and_a_command_without_secret_and_confirm_before_rotating', async () => {
    const api = installFakeApi({
      'mcp:status': () => ({ listening: true, clients: 1, command: 'claude mcp add brainstormer --scope user …' }),
      'mcp:rotateToken': () => ({ ok: true })
    })
    render(<ClaudeCodeSettings />)
    expect(await screen.findByText('● Pont actif — 1 client connecté')).toBeTruthy()
    expect((screen.getByLabelText('Commande d’enregistrement') as HTMLTextAreaElement).value).toContain(
      'claude mcp add brainstormer'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Régénérer le secret' }))
    expect(api.invoke).not.toHaveBeenCalledWith('mcp:rotateToken')
    await userEvent.click(screen.getByRole('button', { name: 'Oui, régénérer' }))
    expect(api.invoke).toHaveBeenCalledWith('mcp:rotateToken')
  })
})
