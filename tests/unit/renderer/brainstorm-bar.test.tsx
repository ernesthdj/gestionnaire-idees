import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { BrainstormBar } from '../../../src/renderer/src/home/BrainstormBar'
import type { GitStatusView } from '../../../src/shared/git/model'
import { expectNoAxeViolations } from '../../support/axe'
import { FakeIpcError, installFakeApi } from './support/fakeApi'

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
    // Projet non repris : pas d'explorateur.
    expect(screen.queryByRole('button', { name: 'Explorateur' })).toBeNull()
  })

  it('should_open_the_explorer_of_a_resumed_project_from_the_bar', async () => {
    const user = userEvent.setup()
    installFakeApi({ 'git:status': () => status, 'savepoints:list': () => [], 'reprise:get': () => ({ genesisId: G }) })
    useUiStore.setState({
      brainstorm: {
        id: B,
        slug: 'boutique',
        name: 'Boutique',
        description: '',
        location: 'vault',
        folder: 'C:\\coffre\\projects\\boutique',
        genesisId: G
      },
      openSummary: null
    })
    const { container } = render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <BrainstormBar />
      </QueryClientProvider>
    )
    await user.click(await screen.findByRole('button', { name: 'Explorateur' }))
    expect(useUiStore.getState()).toMatchObject({ explorerGenesisId: G, explorerMarks: null })
    await expectNoAxeViolations(container)
  })

  it('should_analyse_the_code_of_a_project_with_a_folder_after_choosing_the_confidentiality', async () => {
    const user = userEvent.setup()
    let analyzed = false
    const api = installFakeApi({
      'git:status': () => status,
      'savepoints:list': () => [],
      'reprise:get': () => {
        if (!analyzed) throw new FakeIpcError('NOT_FOUND')
        return { genesisId: G }
      },
      'reprise:adopt': () => {
        analyzed = true
        return { genesisId: G }
      }
    })
    useUiStore.setState({
      brainstorm: {
        id: B,
        slug: 'mien',
        name: 'Mon projet',
        description: '',
        location: 'vault',
        folder: 'C:\\coffre\\projects\\mien',
        genesisId: G
      },
      openSummary: null,
      explorerGenesisId: null
    })
    const { container } = render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <BrainstormBar />
      </QueryClientProvider>
    )
    await user.click(await screen.findByRole('button', { name: 'Analyser le code…' }))
    const panel = screen.getByRole('region', { name: 'Analyser le code du projet' })
    // Aucune confidentialité par défaut : rien ne part avant le choix.
    expect(screen.getByRole('button', { name: 'Analyser' })).toHaveProperty('disabled', true)
    await expectNoAxeViolations(container)
    await user.click(screen.getByRole('radio', { name: /Local uniquement/ }))
    await user.click(screen.getByRole('button', { name: 'Analyser' }))
    expect(api.invoke).toHaveBeenCalledWith('reprise:adopt', { genesisId: G, confidentiality: 'local' })
    expect(await screen.findByRole('button', { name: 'Explorateur' })).toBeTruthy()
    expect(panel.isConnected).toBe(false)
    expect(useUiStore.getState().explorerGenesisId).toBe(G)
  })

  it('should_open_the_explorer_of_the_project_that_already_analysed_the_same_folder', async () => {
    const user = userEvent.setup()
    const other = '00000000-0000-4000-8000-000000000b03'
    installFakeApi({
      'git:status': () => status,
      'savepoints:list': () => [],
      'reprise:get': () => {
        throw new FakeIpcError('NOT_FOUND', { analyzedBy: other })
      }
    })
    useUiStore.setState({
      brainstorm: {
        id: B,
        slug: 'mien',
        name: 'Mon projet',
        description: '',
        location: 'vault',
        folder: 'C:/coffre/mien',
        genesisId: G
      },
      openSummary: null,
      explorerGenesisId: null
    })
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <BrainstormBar />
      </QueryClientProvider>
    )
    await user.click(await screen.findByRole('button', { name: 'Explorateur' }))
    expect(useUiStore.getState().explorerGenesisId).toBe(other)
    expect(screen.queryByRole('button', { name: 'Analyser le code…' })).toBeNull()
  })
})
