import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { HistoryView } from '../../../src/shared/git/history'
import { Timeline, withRealNames, windowOf } from '../../../src/renderer/src/git/Timeline'
import { expectNoAxeViolations } from '../../support/axe'
import { installFakeApi } from './support/fakeApi'

const G = '00000000-0000-4000-8000-000000000c25'
const A = 'a'.repeat(16)
const B = 'b'.repeat(16)
const C = 'c'.repeat(16)
const author = (key: string, name: string, initials: string) => ({
  key,
  name,
  email: `${initials.toLowerCase()}@example.invalid`,
  initials,
  color: '#2563eb'
})
const commit = (n: number, key: string, day: number) => ({
  hash: String(n).repeat(40).slice(0, 40),
  subject: `feat: ${n}`,
  date: `2026-10-${String(day).padStart(2, '0')}T10:00:00Z`,
  authorKey: key,
  isMerge: false
})

const history = (merged = false): HistoryView => ({
  commits: [commit(4, A, 9), commit(3, merged ? C : B, 8), commit(2, C, 5), commit(1, A, 1)],
  authors: merged
    ? [author(A, 'Alice Fictive', 'AF'), author(C, 'Chloé Fictive', 'CF')]
    : [author(A, 'Alice Fictive', 'AF'), author(B, 'Bob Fictif', 'BF'), author(C, 'Chloé Fictive', 'CF')],
  merged: merged ? [{ key: B, mainKey: C, name: 'Bob Fictif' }] : [],
  more: false
})

function renderTimeline(handlers: Parameters<typeof installFakeApi>[0]) {
  const api = installFakeApi(handlers)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    api,
    ...render(
      <QueryClientProvider client={client}>
        <Timeline genesisId={G} readOnly={false} />
      </QueryClientProvider>
    )
  }
}

describe('frise des auteurs (spec 021 T043, US5 lot 1)', () => {
  it('should_show_one_line_per_author_and_move_between_commits_with_the_arrows', async () => {
    const user = userEvent.setup()
    const { container } = renderTimeline({ 'git:history': () => history() })
    expect(await screen.findByRole('list', { name: 'Légende des auteurs' })).toBeDefined()
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
    await expectNoAxeViolations(container)
    await user.click(screen.getByRole('button', { name: /feat: 2,/ }))
    await user.keyboard('{ArrowRight}')
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^feat: 3,/)
    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^feat: 1,/)
    await user.click(screen.getByRole('button', { name: 'semaine' }))
    // Fenêtre d'une semaine avant le dernier commit (9 octobre) : le commit du 1er n'y est plus.
    expect(screen.queryByRole('button', { name: /feat: 1,/ })).toBeNull()
    expect(screen.getByRole('button', { name: /feat: 4,/ })).toBeDefined()
  })

  it('should_merge_two_identities_then_offer_to_separate_them', async () => {
    const user = userEvent.setup()
    let merged = false
    const { api } = renderTimeline({
      'git:history': () => history(merged),
      'git:mergeAuthors': () => {
        merged = true
        return { ok: true }
      }
    })
    await user.click(await screen.findByLabelText('Choisir Chloé Fictive pour fusionner'))
    await user.click(screen.getByLabelText('Choisir Bob Fictif pour fusionner'))
    await user.click(screen.getByRole('button', { name: 'Fusionner les identités' }))
    await waitFor(() =>
      expect(api.invoke).toHaveBeenCalledWith('git:mergeAuthors', { genesisId: G, mainKey: C, aliasKeys: [B] })
    )
    expect(await screen.findByRole('button', { name: 'Séparer' })).toBeDefined()
  })

  it('should_tell_the_period_with_real_names_put_back_on_screen', async () => {
    const user = userEvent.setup()
    const { api } = renderTimeline({
      'git:history': () => history(),
      'git:story': () => ({
        text: 'Auteur A a lancé, Auteur B a suivi.',
        names: { 'Auteur A': A, 'Auteur B': B },
        commits: 4
      })
    })
    await user.click(await screen.findByRole('button', { name: /Raconter la période/ }))
    expect(await screen.findByText('Alice Fictive a lancé, Bob Fictif a suivi.')).toBeDefined()
    expect(api.invoke).toHaveBeenCalledWith('git:story', {
      genesisId: G,
      from: commit(1, A, 1).hash,
      to: commit(4, A, 9).hash
    })
  })

  it('should_compute_the_window_and_replace_longer_pseudonyms_first', () => {
    expect(windowOf(history().commits, 'semaine').shown.map((entry) => entry.subject)).toEqual([
      'feat: 4',
      'feat: 3',
      'feat: 2'
    ])
    const authors = [author('k1', 'Un', 'U'), author('k11', 'Onze', 'O')]
    expect(
      withRealNames(
        { text: 'Auteur A1 et Auteur A', names: { 'Auteur A': 'k1', 'Auteur A1': 'k11' }, commits: 2 },
        authors
      )
    ).toBe('Onze et Un')
  })
})
