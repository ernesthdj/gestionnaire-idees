import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { OpeningSummary } from '../../../src/renderer/src/git/OpeningSummary'
import { RepoBadge } from '../../../src/renderer/src/git/RepoBadge'
import { ProjectMenu } from '../../../src/renderer/src/home/ProjectMenu'
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

const project = (name: string, folder: string | null) => ({
  id: B,
  slug: 'alpha',
  name,
  description: '',
  location: 'vault' as const,
  folder,
  genesisId: G
})
const wrap = (node: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {node}
    </QueryClientProvider>
  )

describe('le projet ouvert dans la barre fine (spec 033 D2 à D6)', () => {
  afterEach(() =>
    useUiStore.setState({ brainstorm: null, openSummary: null, repoGenesisId: null, structureViews: {}, view: 'home' })
  )

  it('should_show_the_branch_with_a_warning_when_commits_wait_and_open_the_repository', async () => {
    const user = userEvent.setup()
    installFakeApi({ 'git:status': () => status })
    const { container } = wrap(<RepoBadge genesisId={G} variant="chip" />)
    const chip = await screen.findByRole('button', { name: /^Dépôt du projet : ⎇ main · à jour · ↑7/ })
    expect(chip.textContent).toBe('main')
    expect(chip.querySelectorAll('svg')).toHaveLength(2)
    await expectNoAxeViolations(container)
    await user.click(chip)
    expect(useUiStore.getState().repoGenesisId).toBe(G)
  })

  it('should_open_the_project_menu_with_the_way_back_the_folder_and_save_points_but_no_explorer', async () => {
    const user = userEvent.setup()
    installFakeApi({ 'savepoints:list': () => [], 'reprise:get': () => ({ genesisId: G }) })
    useUiStore.setState({ brainstorm: project('Alpha', 'C:/coffre/projects/alpha'), view: 'ideas' })
    const { container } = wrap(<ProjectMenu />)
    await user.click(screen.getByRole('button', { name: 'Projet Alpha : menu' }))
    const menu = screen.getByRole('region', { name: 'Projet Alpha' })
    expect(menu.textContent).toContain('C:/coffre/projects/alpha')
    expect(await screen.findByRole('button', { name: 'Points de sauvegarde (0)' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Explorateur' })).toBeNull()
    await expectNoAxeViolations(container)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('region', { name: 'Projet Alpha' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Projet Alpha : menu' }))
    await user.click(screen.getByRole('button', { name: '← Tous les projets' }))
    expect(useUiStore.getState().view).toBe('home')
  })

  it('should_analyse_the_code_after_choosing_the_confidentiality_then_show_the_architecture_view', async () => {
    const user = userEvent.setup()
    let analyzed = false
    const api = installFakeApi({
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
    useUiStore.setState({ brainstorm: project('Mon projet', 'C:/coffre/projects/mien'), view: 'ideas' })
    wrap(<ProjectMenu />)
    await user.click(screen.getByRole('button', { name: 'Projet Mon projet : menu' }))
    await user.click(await screen.findByRole('button', { name: 'Analyser le code…' }))
    // Aucune confidentialité par défaut : rien ne part avant le choix.
    expect(screen.getByRole('button', { name: 'Analyser' })).toHaveProperty('disabled', true)
    await user.click(screen.getByRole('radio', { name: /Local uniquement/ }))
    await user.click(screen.getByRole('button', { name: 'Analyser' }))
    expect(api.invoke).toHaveBeenCalledWith('reprise:adopt', { genesisId: G, confidentiality: 'local' })
    await waitFor(() => expect(useUiStore.getState().structureViews[G]).toBe('architecture'))
  })

  it('should_tell_in_the_repository_what_the_hub_noticed_at_opening_and_the_journal', async () => {
    useUiStore.setState({
      openSummary: {
        anomalies: [
          { kind: 'uncommitted', count: 19 },
          { kind: 'unpushed', count: 1 }
        ],
        journal: ['[2026-10-15] FEAT — la coque compacte']
      }
    })
    const { container } = wrap(<OpeningSummary />)
    expect(screen.getByText('⚠ 19 fichiers non commités.')).toBeTruthy()
    expect(screen.getByText('⚠ 1 commit non poussé.')).toBeTruthy()
    expect(screen.getByText('[2026-10-15] FEAT — la coque compacte')).toBeTruthy()
    await expectNoAxeViolations(container)
  })
})
