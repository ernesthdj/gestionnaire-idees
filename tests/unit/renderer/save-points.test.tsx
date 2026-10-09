import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { SavePointView } from '../../../src/shared/ipc/brainstorms'
import { EMPTY_VIEW_STATE } from '../../../src/shared/brainstorms/viewState'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { SavePoints } from '../../../src/renderer/src/canvas/SavePoints'
import { expectNoAxeViolations } from '../../support/axe'
import { installFakeApi } from './support/fakeApi'

const B = '00000000-0000-4000-8000-000000000024'
const P = '00000000-0000-4000-8000-0000000000b1'
const U = '00000000-0000-4000-8000-0000000000c1'

function renderPoints(handlers: Parameters<typeof installFakeApi>[0]) {
  const api = installFakeApi({ 'brainstorms:viewState': () => ({ ok: true }), ...handlers })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(
    <QueryClientProvider client={client}>
      <SavePoints brainstormId={B} />
    </QueryClientProvider>
  )
  return { api, ...result }
}

describe('points de sauvegarde (spec 024 T020, US2)', () => {
  beforeEach(() => useUiStore.setState({ brainstorm: null, canvasEpoch: 0 }))

  it('should_pose_a_named_point', async () => {
    const user = userEvent.setup()
    let points: SavePointView[] = []
    const { api, container } = renderPoints({
      'savepoints:list': () => points,
      'savepoints:create': (payload) => {
        const point = {
          id: P,
          name: (payload as { name: string }).name,
          createdAt: '2026-10-10T09:00:00Z',
          sizeBytes: 9
        }
        points = [point]
        return point
      }
    })
    await user.click(await screen.findByRole('button', { name: 'Points de sauvegarde (0)' }))
    expect(screen.getByText(/sauvegardé en continu/)).toBeDefined()
    await expectNoAxeViolations(container)
    await user.type(screen.getByLabelText('Nom du point'), 'avant refonte')
    await user.click(screen.getByRole('button', { name: 'Poser' }))
    expect(await screen.findByText('avant refonte')).toBeDefined()
    expect(api.invoke).toHaveBeenCalledWith('savepoints:create', { brainstormId: B, name: 'avant refonte' })
    expect(screen.getByRole('button', { name: 'Points de sauvegarde (1)' })).toBeDefined()
  })

  it('should_confirm_before_returning_then_offer_to_undo_the_return', async () => {
    const user = userEvent.setup()
    const view = { ...EMPTY_VIEW_STATE, viewport: { x: 3, y: 4, zoom: 1 } }
    const { api, container } = renderPoints({
      'savepoints:list': () => [{ id: P, name: 'avant refonte', createdAt: '2026-10-10T09:00:00Z', sizeBytes: 9 }],
      'savepoints:restore': () => ({ undoId: U, viewState: view }),
      'savepoints:undoRestore': () => ({ viewState: null })
    })
    await user.click(await screen.findByRole('button', { name: 'Points de sauvegarde (1)' }))
    await user.click(await screen.findByRole('button', { name: 'Revenir à avant refonte' }))
    expect(api.invoke).not.toHaveBeenCalledWith('savepoints:restore', expect.anything())
    await expectNoAxeViolations(container)
    await user.click(screen.getByRole('button', { name: 'Confirmer le retour' }))
    await waitFor(() => expect(api.invoke).toHaveBeenCalledWith('savepoints:restore', { id: P }))
    await waitFor(() => expect(useUiStore.getState().canvasEpoch).toBe(1))
    expect(useUiStore.getState().restoredViewport).toEqual({ x: 3, y: 4, zoom: 1 })
    await user.click(screen.getByRole('button', { name: /Annuler le retour à « avant refonte »/ }))
    await waitFor(() => expect(api.invoke).toHaveBeenCalledWith('savepoints:undoRestore', { undoId: U }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /Annuler le retour/ })).toBeNull())
  })

  it('should_rename_and_delete_after_confirmation', async () => {
    const user = userEvent.setup()
    const { api } = renderPoints({
      'savepoints:list': () => [{ id: P, name: 'p1', createdAt: '2026-10-10T09:00:00Z', sizeBytes: 9 }],
      'savepoints:rename': () => ({ ok: true }),
      'savepoints:delete': () => ({ ok: true })
    })
    await user.click(await screen.findByRole('button', { name: 'Points de sauvegarde (1)' }))
    await user.click(await screen.findByRole('button', { name: 'Renommer p1' }))
    const input = screen.getByLabelText('Nouveau nom de p1')
    await user.clear(input)
    await user.type(input, 'p2{Enter}')
    await waitFor(() => expect(api.invoke).toHaveBeenCalledWith('savepoints:rename', { id: P, name: 'p2' }))
    await user.click(await screen.findByRole('button', { name: 'Supprimer p1' }))
    expect(api.invoke).not.toHaveBeenCalledWith('savepoints:delete', expect.anything())
    await user.click(screen.getByRole('button', { name: 'Confirmer la suppression' }))
    await waitFor(() => expect(api.invoke).toHaveBeenCalledWith('savepoints:delete', { id: P }))
  })
})
