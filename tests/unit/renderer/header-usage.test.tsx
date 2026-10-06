import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HeaderUsage } from '../../../src/renderer/src/app/HeaderUsage'
import type { ChatUsageView } from '../../../src/shared/ipc/chat'
import { expectNoAxeViolations } from '../../support/axe'
import { installFakeApi } from './support/fakeApi'

const usage = (fiveHour: number, sevenDay: number): ChatUsageView => ({
  account: {
    status: 'allowed',
    fiveHour: { utilization: fiveHour, resetsAt: 1_791_287_400 },
    sevenDay: { utilization: sevenDay, resetsAt: 1_791_770_400 },
    updatedAt: new Date().toISOString()
  },
  app: { weekTokens: 12_400, weekTurns: 8, totalTokens: 50_000, totalTurns: 30, neuronTokens: 0, neuronTurns: 0 }
})

function renderUsage(view: ChatUsageView) {
  const api = installFakeApi({ 'usage:get': () => view })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(
    <QueryClientProvider client={client}>
      <HeaderUsage />
    </QueryClientProvider>
  )
  return { api, ...result }
}

describe('consommation Claude dans l’en-tête', () => {
  it('should_show_the_session_and_week_usage_outside_any_conversation', async () => {
    const { api, container } = renderUsage(usage(0.12, 0.38))
    expect(await screen.findByText('12 %')).toBeTruthy()
    expect(screen.getByText('38 %')).toBeTruthy()
    expect(api.invoke).toHaveBeenCalledWith('usage:get', undefined)
    expect(screen.getByRole('group', { name: 'Consommation Claude' }).title).toContain('relevé à l’instant')
    await expectNoAxeViolations(container)
  })

  it('should_follow_a_new_reading_from_any_conversation', async () => {
    const { api } = renderUsage(usage(0.12, 0.38))
    await screen.findByText('12 %')
    act(() => api.emit('chat:usage', { neuronId: 'n', usage: usage(0.91, 0.4) }))
    // React Query diffuse la nouvelle valeur de façon asynchrone.
    expect(await screen.findByText('91 %')).toBeTruthy()
    const session = screen.getByRole('meter', { name: 'Session de 5 h de l’abonnement Claude' })
    expect(session.getAttribute('aria-valuenow')).toBe('91')
  })

  it('should_say_when_no_reading_has_arrived_yet', async () => {
    renderUsage({ ...usage(0, 0), account: null })
    const group = screen.getByRole('group', { name: 'Consommation Claude' })
    await waitFor(() => expect(group.title).toContain('Pas encore de relevé'))
    expect(screen.getAllByText('—')).toHaveLength(2)
  })
})
