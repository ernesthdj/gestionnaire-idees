import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ElementStatusSelect } from '../../../src/renderer/src/canvas/nodes/ElementNode'
import { CommitDelivery } from '../../../src/renderer/src/git/CommitDelivery'
import type { ElementView } from '../../../src/shared/ipc/canvas'
import { expectNoAxeViolations } from '../../support/axe'
import { installFakeApi } from './support/fakeApi'

const element = (extra: Partial<ElementView> = {}): ElementView => ({
  id: 'e1',
  genesisId: 'g',
  parentId: 'g',
  key: 'fonctionnalite:depot',
  type: 'fonctionnalite',
  title: 'Dépôt au comptoir',
  status: 'en_cours',
  summary: null,
  paths: [],
  collapsed: false,
  childCount: 0,
  order: null,
  ...extra
})

const wrap = (node: React.JSX.Element) =>
  render(<QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>)

describe('statut d’un élément à la main (spec 030 D2)', () => {
  it('should_send_the_chosen_status_and_keep_an_unusual_current_status_in_the_list', async () => {
    const user = userEvent.setup()
    const api = installFakeApi({ 'element:setStatus': () => ({ batchId: 'b1' }) })
    const { container } = wrap(<ElementStatusSelect element={element({ status: 'specifiee' })} />)
    const select = screen.getByRole('combobox', { name: 'Statut de « Dépôt au comptoir »' })
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'spécifiée',
      'à faire',
      'en cours',
      'livrée',
      'bloquée'
    ])
    await user.selectOptions(select, 'livree')
    expect(api.invoke).toHaveBeenCalledWith('element:setStatus', { elementIds: ['e1'], status: 'livree' })
    await expectNoAxeViolations(container)
  })
})

describe('livrée au commit (spec 030 D5)', () => {
  const covered = [
    { id: 'e1', key: 'fonctionnalite:depot', title: 'Dépôt au comptoir' },
    { id: 'e2', key: 'composant:api-depots', title: 'API de dépôt' }
  ]

  it('should_propose_every_covered_element_checked_and_deliver_only_the_checked_ones', async () => {
    const user = userEvent.setup()
    const api = installFakeApi({ 'element:setStatus': () => ({ batchId: 'b2' }) })
    const onDone = vi.fn()
    const { container } = wrap(<CommitDelivery elements={covered} onDone={onDone} />)
    await expectNoAxeViolations(container)
    await user.click(screen.getByRole('checkbox', { name: /API de dépôt/ }))
    await user.click(screen.getByRole('button', { name: 'Passer en livrée (1)' }))
    expect(api.invoke).toHaveBeenCalledWith('element:setStatus', { elementIds: ['e1'], status: 'livree' })
    await vi.waitFor(() => expect(onDone).toHaveBeenCalled())
  })

  it('should_write_nothing_when_postponed', async () => {
    const user = userEvent.setup()
    const api = installFakeApi()
    const onDone = vi.fn()
    wrap(<CommitDelivery elements={covered} onDone={onDone} />)
    await user.click(screen.getByRole('button', { name: 'Plus tard' }))
    expect(onDone).toHaveBeenCalled()
    expect(api.invoke).not.toHaveBeenCalled()
  })
})
