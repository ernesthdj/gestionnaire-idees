import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { Toast } from '../../../src/renderer/src/app/Toast'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { HistoryPage } from '../../../src/renderer/src/pages/HistoryPage'
import type { HistoryEntryView, HistoryPageView } from '../../../src/shared/ipc/history'
import { expectNoAxeViolations } from '../../support/axe'
import { FakeIpcError, installFakeApi } from './support/fakeApi'

const ROOT = '00000000-0000-4000-8000-0000000000a1'

function entry(id: number, patch: Partial<HistoryEntryView> = {}): HistoryEntryView {
  return {
    batchId: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
    kind: 'confirm_synthesis',
    rootId: ROOT,
    summary: `Éclosion de « Idée ${id} »`,
    at: '2026-09-28T20:30:00.000Z',
    undoable: true,
    undone: false,
    ...patch
  }
}

function renderWith(ui: React.ReactNode, handlers: Parameters<typeof installFakeApi>[0]) {
  const api = installFakeApi(handlers)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
  return api
}

describe('historique', () => {
  beforeEach(() => useUiStore.setState({ view: 'history', diveRootId: null, toast: null }))

  it('should_list_changes_and_undo_one_of_them', async () => {
    const user = userEvent.setup()
    const page: HistoryPageView = {
      items: [
        entry(2, { kind: 'undo', summary: 'Éclosion annulée de « Idée 1 »' }),
        entry(1, { undoable: false, undone: true })
      ],
      nextCursor: null
    }
    const api = renderWith(<HistoryPage />, {
      'history:list': () => page,
      'history:undo': () => ({ undoBatchId: 'x' })
    })
    expect(await screen.findByText('Éclosion annulée de « Idée 1 »')).toBeDefined()
    expect(screen.getByText(/· annulé/)).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'Rétablir : Éclosion annulée de « Idée 1 »' }))
    expect(api.invoke).toHaveBeenCalledWith('history:undo', { batchId: entry(2).batchId })
    expect(screen.queryByRole('button', { name: /^Annuler : Éclosion de « Idée 1 »/ })).toBeNull()
  })

  it('should_explain_a_conflict_when_the_undo_is_refused', async () => {
    const user = userEvent.setup()
    renderWith(<HistoryPage />, {
      'history:list': () => ({ items: [entry(1)], nextCursor: null }),
      'history:undo': () => {
        throw new FakeIpcError('UNDO_CONFLICT', {
          conflicts: ['L’idée a changé depuis (réouverte, complétée ou déjà modifiée).']
        })
      }
    })
    await user.click(await screen.findByRole('button', { name: 'Annuler : Éclosion de « Idée 1 »' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/L’idée a changé depuis/)
  })

  it('should_open_the_idea_concerned_and_load_more_on_demand', async () => {
    const user = userEvent.setup()
    const api = renderWith(<HistoryPage />, {
      'history:list': (payload) =>
        (payload as { cursor?: string }).cursor === undefined
          ? { items: [entry(3)], nextCursor: '42' }
          : { items: [entry(1)], nextCursor: null }
    })
    await user.click(await screen.findByRole('button', { name: 'Voir plus' }))
    expect(api.invoke).toHaveBeenCalledWith('history:list', { limit: 30, cursor: '42' })
    expect(await screen.findByText('Éclosion de « Idée 1 »')).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'Ouvrir l’idée : Éclosion de « Idée 3 »' }))
    expect(useUiStore.getState()).toMatchObject({ view: 'ideas', diveRootId: ROOT })
  })

  it('should_explain_that_nothing_happened_yet_when_the_history_is_empty', async () => {
    renderWith(<HistoryPage />, { 'history:list': () => ({ items: [], nextCursor: null }) })
    expect(await screen.findByText(/Aucun changement pour l’instant/)).toBeDefined()
  })

  it('should_have_no_accessibility_violation', async () => {
    // Comme dans l'app : la page est rendue dans le <main> de la coquille.
    renderWith(
      <main>
        <HistoryPage />
      </main>,
      { 'history:list': () => ({ items: [entry(1)], nextCursor: null }) }
    )
    await screen.findByText('Éclosion de « Idée 1 »')
    await expectNoAxeViolations(document.body)
  })
})

describe('notification d’éclosion', () => {
  beforeEach(() => useUiStore.setState({ toast: null }))

  it('should_undo_the_hatching_from_the_notification', async () => {
    const user = userEvent.setup()
    const api = renderWith(<Toast />, { 'history:undo': () => ({ undoBatchId: 'x' }) })
    act(() => useUiStore.getState().hatch(ROOT, '« Idée » a éclos.', entry(7).batchId))
    const toast = await screen.findByRole('status')
    await user.click(within(toast).getByRole('button', { name: 'Annuler' }))
    expect(api.invoke).toHaveBeenCalledWith('history:undo', { batchId: entry(7).batchId })
    expect((await screen.findByRole('status')).textContent).toMatch(/Éclosion annulée/)
  })
})
