import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SeedCard } from '../../../src/renderer/src/dive/SeedCard'
import type { IdeaSummaryView, RootView } from '../../../src/shared/ipc/neurons'
import { expectNoAxeViolations } from '../../support/axe'
import { installFakeApi } from './support/fakeApi'

const ROOT_ID = '00000000-0000-4000-8000-0000000000a1'

const root: RootView = {
  id: ROOT_ID,
  title: 'Deuxième écran',
  content: 'Acheter un deuxième écran\npour la retouche.',
  nature: 'action',
  natureSource: 'user',
  category: null,
  categorySource: null,
  state: 'developing',
  version: 3,
  position: null,
  pinned: false,
  createdAt: '2026-09-30T00:00:00.000Z',
  updatedAt: '2026-09-30T00:00:00.000Z'
}

function renderCard(summary: () => IdeaSummaryView, idea: RootView = root) {
  const api = installFakeApi({ 'neuron:summary': summary })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(
    <QueryClientProvider client={client}>
      <SeedCard root={idea} />
    </QueryClientProvider>
  )
  return { api, ...result }
}

const card = (): HTMLElement => screen.getByRole('region', { name: 'Idée de départ' })

describe('fiche de l’idée de départ', () => {
  it('should_always_show_the_original_text_then_the_summary_of_the_brainstorming', async () => {
    const { api } = renderCard(() => ({ summary: 'Tu veux un second écran pour 300 €.', stale: false }))
    expect(within(card()).getByText(/Acheter un deuxième écran/)).toBeDefined()
    expect(await within(card()).findByText('Tu veux un second écran pour 300 €.')).toBeDefined()
    expect(api.invoke).toHaveBeenCalledWith('neuron:summary', { rootId: ROOT_ID })
  })

  it('should_show_the_title_when_the_idea_has_no_longer_text', async () => {
    renderCard(() => ({ summary: null, stale: false }), { ...root, content: null })
    expect(within(card()).getByText('Deuxième écran')).toBeDefined()
  })

  it('should_say_so_when_the_summary_is_older_than_the_idea', async () => {
    renderCard(() => ({ summary: 'Ancien résumé.', stale: true }))
    expect(await within(card()).findByText(/Résumé d’avant les derniers changements/)).toBeDefined()
  })

  it('should_keep_the_original_text_when_the_summary_cannot_be_loaded', async () => {
    renderCard(() => {
      throw new Error('panne')
    })
    await waitFor(() => expect(within(card()).queryByText(/résume l’idée/)).toBeNull())
    expect(within(card()).getByText(/Acheter un deuxième écran/)).toBeDefined()
  })

  it('should_have_no_accessibility_violation', async () => {
    const { container } = renderCard(() => ({ summary: 'Résumé.', stale: false }))
    await within(card()).findByText('Résumé.')
    await expectNoAxeViolations(container)
  })
})
