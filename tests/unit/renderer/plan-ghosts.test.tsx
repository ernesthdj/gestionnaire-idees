import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { IdeasCanvas } from '../../../src/renderer/src/canvas/IdeasCanvas'
import { DEFAULT_APP_SETTINGS } from '../../../src/shared/ipc/app'
import type { IdeasCanvasView } from '../../../src/shared/ipc/canvas'
import { expectNoAxeViolations } from '../../support/axe'
import { canvasView, HATCHED_A_ID } from '../../fixtures/ui/canvas'
import { installFakeApi } from './support/fakeApi'
import { installReactFlowMocks } from './support/reactFlowMocks'

const STEP_1 = '00000000-0000-4000-8000-000000000101'
const PROPOSAL = '00000000-0000-4000-8000-000000000201'
const GHOST_A = '00000000-0000-4000-8000-000000000301'
const GHOST_B = '00000000-0000-4000-8000-000000000302'

function planView(): IdeasCanvasView {
  const base = canvasView()
  return {
    ...base,
    ideas: base.ideas.map((idea) => (idea.id === HATCHED_A_ID ? { ...idea, locked: true } : idea)),
    steps: [
      {
        id: STEP_1,
        genesisId: HATCHED_A_ID,
        parentId: HATCHED_A_ID,
        depth: 1,
        rank: 1,
        title: 'Valider le budget',
        status: 'en_cours',
        locked: false,
        lockProposed: false,
        waitsFor: [],
        offset: { x: 0, y: 0 }
      }
    ],
    proposals: [
      {
        id: PROPOSAL,
        parentId: HATCHED_A_ID,
        items: [
          { id: GHOST_A, title: 'Choisir le lieu', why: 'Après le budget', rank: 1, waitsFor: [] },
          { id: GHOST_B, title: 'Lancer la com', why: 'Quand le lieu est connu', rank: 2, waitsFor: [GHOST_A] }
        ]
      }
    ]
  }
}

function renderCanvas(view: IdeasCanvasView = planView()) {
  const api = installFakeApi({
    'canvas:get': () => view,
    'canvas:savePositions': () => ({ ok: true }),
    'app:getSettings': () => DEFAULT_APP_SETTINGS,
    'plan:decide': () => ({ batchId: 'b1', born: [GHOST_A] }),
    'history:list': () => ({ items: [], nextCursor: null })
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(
    <QueryClientProvider client={client}>
      <IdeasCanvas />
    </QueryClientProvider>
  )
  return { api, ...result }
}

describe('plan d’attaque sur la carte (spec 011 US1)', () => {
  beforeAll(() => installReactFlowMocks())
  beforeEach(() => useUiStore.setState({ view: 'ideas', chatNeuronId: null, toast: null }))

  it('should_show_steps_with_their_rank_and_ghosts_with_their_future_rank', async () => {
    renderCanvas()
    expect(
      await screen.findByRole('group', { name: 'Étape ① de « Mission mariage » : Valider le budget, en cours' })
    ).toBeDefined()
    expect(screen.getByRole('group', { name: 'Étape proposée ② : Choisir le lieu' })).toBeDefined()
    expect(screen.getByRole('group', { name: 'Étape proposée ③ : Lancer la com' })).toBeDefined()
    expect(screen.getByText('Claude propose 2 étapes')).toBeDefined()
  })

  it('should_accept_one_ghost_with_its_check_button', async () => {
    const user = userEvent.setup()
    const { api } = renderCanvas()
    await user.click(await screen.findByRole('button', { name: 'Valider l’étape « Choisir le lieu »' }))
    expect(api.invoke).toHaveBeenCalledWith('plan:decide', { proposalId: PROPOSAL, accept: [GHOST_A], reject: [] })
    await waitFor(() => expect(useUiStore.getState().toast?.undoBatchId).toBe('b1'))
  })

  it('should_refuse_one_ghost_with_its_cross_button', async () => {
    const user = userEvent.setup()
    const { api } = renderCanvas()
    await user.click(await screen.findByRole('button', { name: 'Refuser l’étape « Lancer la com »' }))
    expect(api.invoke).toHaveBeenCalledWith('plan:decide', { proposalId: PROPOSAL, accept: [], reject: [GHOST_B] })
  })

  it('should_accept_or_refuse_the_whole_layer_at_once', async () => {
    const user = userEvent.setup()
    const { api } = renderCanvas()
    await user.click(await screen.findByRole('button', { name: 'Tout valider' }))
    expect(api.invoke).toHaveBeenCalledWith('plan:decide', {
      proposalId: PROPOSAL,
      accept: [GHOST_A, GHOST_B],
      reject: []
    })
    await user.click(screen.getByRole('button', { name: 'Tout refuser' }))
    expect(api.invoke).toHaveBeenCalledWith('plan:decide', {
      proposalId: PROPOSAL,
      accept: [],
      reject: [GHOST_A, GHOST_B]
    })
  })

  it('should_open_the_conversation_of_a_step_when_it_is_clicked', async () => {
    renderCanvas()
    fireEvent.click(await screen.findByText('Valider le budget'))
    expect(useUiStore.getState().chatNeuronId).toBe(STEP_1)
  })

  it('should_draw_a_line_from_the_genesis_to_its_steps_and_its_ghosts', async () => {
    const { container } = renderCanvas()
    await screen.findByText('Claude propose 2 étapes')
    await waitFor(() => expect(container.querySelector(`[data-testid="rf__edge-plan-line-${STEP_1}"]`)).not.toBeNull())
    expect(container.querySelector(`[data-testid="rf__edge-plan-line-ghost-${GHOST_A}"]`)).not.toBeNull()
  })

  it('should_show_the_detail_of_a_ghost_before_deciding_and_accept_it_from_there', async () => {
    const user = userEvent.setup()
    const { api } = renderCanvas()
    await user.click(await screen.findByText('Lancer la com'))
    const panel = await screen.findByRole('complementary', { name: 'Étape proposée par Claude' })
    expect(panel.textContent).toContain('Quand le lieu est connu')
    expect(panel.textContent).toContain('② Choisir le lieu (proposée)')
    expect(panel.textContent).toContain('Dans le plan de « Mission mariage »')
    expect(useUiStore.getState().chatNeuronId).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Valider cette étape' }))
    expect(api.invoke).toHaveBeenCalledWith('plan:decide', { proposalId: PROPOSAL, accept: [GHOST_B], reject: [] })
  })

  it('should_have_no_accessibility_violation', async () => {
    const { container } = renderCanvas()
    await screen.findByText('Claude propose 2 étapes')
    await expectNoAxeViolations(container)
  })
})
