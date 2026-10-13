import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { BrainstormBar } from '../../../src/renderer/src/home/BrainstormBar'
import type { GitStatusView } from '../../../src/shared/git/model'
import { expectNoAxeViolations } from '../../support/axe'
import { installFakeApi } from './support/fakeApi'

const B = '00000000-0000-4000-8000-000000000b01'
const G = '00000000-0000-4000-8000-000000000b02'

const status: GitStatusView = {
  state: 'ok',
  branch: 'main',
  detached: false,
  upstream: { remote: 'origin', branch: 'main' },
  ahead: 7,
  behind: 0,
  lastFetchAt: null,
  files: [],
  filesTotal: 0,
  operation: 'none',
  onPrBranch: false,
  trusted: false,
  riskyConfig: [],
  github: null,
  newSinceVisit: 0
}

describe('barre du projet ouvert (spec 024, entrée du volet Dépôt)', () => {
  afterEach(() => useUiStore.setState({ brainstorm: null, openSummary: null, repoGenesisId: null }))

  it('should_keep_the_repository_entry_once_the_opening_summary_is_closed', async () => {
    const user = userEvent.setup()
    installFakeApi({ 'git:status': () => status, 'savepoints:list': () => [] })
    useUiStore.setState({
      brainstorm: {
        id: B,
        slug: 'alpha',
        name: 'Alpha',
        description: '',
        location: 'vault',
        folder: 'C:\\coffre\\projects\\alpha',
        genesisId: G
      },
      openSummary: { anomalies: [{ kind: 'unpushed', count: 7 }], journal: [] },
      repoGenesisId: null
    })
    const { container } = render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <BrainstormBar />
      </QueryClientProvider>
    )
    await user.click(screen.getByRole('button', { name: 'Fermer' }))
    const entry = await screen.findByRole('button', { name: /^Dépôt du projet : ⎇ main · à jour · ↑7/ })
    await expectNoAxeViolations(container)
    await user.click(entry)
    expect(useUiStore.getState().repoGenesisId).toBe(G)
  })
})
