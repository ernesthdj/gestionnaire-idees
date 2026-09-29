import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { buildGraph, computeLayout, layoutInput } from '../../../src/renderer/src/canvas/buildGraph'
import { SeedBadge } from '../../../src/renderer/src/canvas/edges/SeedBadge'
import type { IdeasCanvasView } from '../../../src/shared/ipc/canvas'
import type { SeedView } from '../../../src/shared/ipc/neurons'
import { expectNoAxeViolations } from '../../support/axe'
import { canvasView, HATCHED_A_ID, HATCHED_B_ID, LINK_ID } from '../../fixtures/ui/canvas'
import { FakeIpcError, installFakeApi } from './support/fakeApi'

const SEED_ID = '00000000-0000-4000-8000-000000000010'
const BORN_ID = '00000000-0000-4000-8000-000000000011'
const BATCH_ID = '00000000-0000-4000-8000-000000000012'

function seed(patch: Partial<SeedView> = {}): SeedView {
  return {
    id: SEED_ID,
    linkId: LINK_ID,
    title: 'Financer le portfolio par la mission',
    why: 'La mission paie, le portfolio attire la suivante.',
    status: 'suggested',
    bornRootId: null,
    parents: [
      { id: HATCHED_A_ID, title: 'Mission mariage' },
      { id: HATCHED_B_ID, title: 'Portfolio photo' }
    ],
    ...patch
  }
}

/** Lien accepté portant une graine en attente. */
function viewWithSeed(patch: Partial<SeedView> = {}): IdeasCanvasView {
  const view = canvasView()
  return {
    ...view,
    links: view.links.map((link) => ({ ...link, status: 'accepted' as const })),
    seeds: [seed(patch)]
  }
}

function renderBadge(handlers: Parameters<typeof installFakeApi>[0] = {}) {
  const api = installFakeApi({
    'seeds:accept': () => ({ rootId: BORN_ID, batchId: BATCH_ID, seed: seed({ status: 'accepted' }) }),
    'seeds:reject': () => ({ ok: true }),
    ...handlers
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(
    <QueryClientProvider client={client}>
      <SeedBadge seed={seed()} dimmed={false} />
    </QueryClientProvider>
  )
  return { api, ...result }
}

const badge = (): HTMLElement => screen.getByRole('button', { name: /Graine de l’IA/ })

describe('graines sur la carte (FR-028)', () => {
  beforeEach(() => useUiStore.setState({ toast: null, bornId: null }))

  it('should_put_a_pending_seed_on_accepted_links_only', () => {
    const accepted = viewWithSeed()
    const [edge] = buildGraph(accepted, computeLayout(accepted)).edges
    expect(edge?.data?.seed?.id).toBe(SEED_ID)

    const suggested = { ...accepted, links: canvasView().links }
    expect(buildGraph(suggested, computeLayout(suggested)).edges[0]?.data?.seed).toBeNull()
  })

  it('should_place_a_born_idea_in_the_network_and_say_where_it_comes_from', () => {
    const view = viewWithSeed({ status: 'accepted', bornRootId: BORN_ID })
    const born = { ...view.incubator[0], id: BORN_ID, title: 'Financer le portfolio' } as (typeof view.network)[0]
    const withBorn = { ...view, network: [...view.network, born] }
    expect(layoutInput(withBorn).find((node) => node.id === BORN_ID)?.zone).toBe('network')
    const node = buildGraph(withBorn, computeLayout(withBorn), null, BORN_ID).nodes.find((n) => n.id === BORN_ID)
    expect(node?.ariaLabel).toMatch(/née de Mission mariage × Portfolio photo/)
    expect(node?.className).toBe('neuron-born')
  })

  it('should_open_the_card_on_click_and_keep_it_open_until_a_click_outside', async () => {
    const { container } = renderBadge()
    expect(screen.queryByText(/La mission paie/)).toBeNull()
    await userEvent.hover(badge())
    expect(screen.queryByText(/La mission paie/)).toBeNull()

    await userEvent.click(badge())
    expect(screen.getByRole('dialog', { name: /Financer le portfolio/ })).toBeTruthy()
    expect(badge().getAttribute('aria-expanded')).toBe('true')
    await userEvent.unhover(badge())
    expect(screen.getByText(/La mission paie/)).toBeTruthy()
    await expectNoAxeViolations(container)

    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('should_toggle_the_card_when_clicking_the_badge_again', async () => {
    renderBadge()
    await userEvent.click(badge())
    await userEvent.click(badge())
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('should_open_with_enter_focus_the_main_action_and_close_with_escape', async () => {
    renderBadge()
    badge().focus()
    fireEvent.keyDown(badge(), { key: 'Enter' })
    const bearButton = await screen.findByRole('button', { name: 'Faire naître' })
    await waitFor(() => expect(document.activeElement).toBe(bearButton))

    fireEvent.keyDown(bearButton, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(badge())
  })

  it('should_bear_the_idea_and_offer_undo', async () => {
    const { api } = renderBadge()
    await userEvent.click(badge())
    await userEvent.click(screen.getByRole('button', { name: 'Faire naître' }))
    await waitFor(() => expect(api.invoke).toHaveBeenCalledWith('seeds:accept', { seedId: SEED_ID }))
    await waitFor(() => expect(useUiStore.getState().toast?.undoBatchId).toBe(BATCH_ID))
    expect(useUiStore.getState().bornId).toBe(BORN_ID)
    expect(useUiStore.getState().toast?.text).toMatch(/est née de Mission mariage × Portfolio photo/)
  })

  it('should_refuse_from_the_card', async () => {
    const { api } = renderBadge()
    await userEvent.click(badge())
    await userEvent.click(screen.getByRole('button', { name: 'Refuser' }))
    await waitFor(() => expect(api.invoke).toHaveBeenCalledWith('seeds:reject', { seedId: SEED_ID }))
    await waitFor(() => expect(useUiStore.getState().toast?.text).toMatch(/Graine refusée/))
  })

  it('should_explain_a_failure', async () => {
    renderBadge({
      'seeds:accept': () => {
        throw new FakeIpcError('INVALID_STATE')
      }
    })
    await userEvent.click(badge())
    await userEvent.click(screen.getByRole('button', { name: 'Faire naître' }))
    await waitFor(() => expect(useUiStore.getState().toast?.text).toBe('INVALID_STATE'))
    expect(useUiStore.getState().bornId).toBeNull()
  })
})
