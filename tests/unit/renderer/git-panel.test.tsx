import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { GitFileView, GitStatusView } from '../../../src/shared/git/model'
import { RepoPanel } from '../../../src/renderer/src/git/RepoPanel'
import { repoStateText } from '../../../src/renderer/src/git/RepoBadge'
import { expectNoAxeViolations } from '../../support/axe'
import { FakeIpcError, installFakeApi } from './support/fakeApi'

const G = '00000000-0000-4000-8000-000000000c21'

const status = (files: readonly GitFileView[], extra: Partial<GitStatusView> = {}): GitStatusView => ({
  state: 'ok',
  branch: 'main',
  detached: false,
  upstream: null,
  ahead: 0,
  behind: 0,
  lastFetchAt: null,
  files,
  filesTotal: files.length,
  operation: 'none',
  onPrBranch: false,
  trusted: false,
  riskyConfig: [],
  github: null,
  newSinceVisit: 0,
  ...extra
})
const file = (path: string, staged = false, sensitive = false): GitFileView => ({
  path,
  status: 'M',
  staged,
  sensitive
})

function renderPanel(handlers: Parameters<typeof installFakeApi>[0]) {
  const api = installFakeApi(handlers)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(
    <QueryClientProvider client={client}>
      <RepoPanel genesisId={G} onClose={() => undefined} />
    </QueryClientProvider>
  )
  return { api, ...result }
}

describe('volet Dépôt (spec 021 T016, US1)', () => {
  it('should_check_nothing_by_default_lock_secrets_and_commit_only_the_checked_files', async () => {
    const user = userEvent.setup()
    let staged: string[] = []
    const { api, container } = renderPanel({
      'git:status': () =>
        status([
          file('a.ts', staged.includes('a.ts')),
          file('b.ts', staged.includes('b.ts')),
          file('c.ts'),
          file('.env', false, true)
        ]),
      'git:stage': (payload) => {
        staged = [...staged, ...(payload as { paths: string[] }).paths]
        return status([])
      },
      'git:proposeMessage': () => ({ message: 'feat: a et b', groups: [], offFormat: false }),
      'git:commit': () => ({ hash: 'a1b2c3d4e5', branch: 'main' })
    })
    expect(await screen.findByText(/⎇ main · 4 modifiés/)).toBeDefined()
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(boxes.every((box) => !box.checked)).toBe(true)
    const secret = screen.getByRole('checkbox', { name: 'Préparer .env' }) as HTMLInputElement
    expect(secret.disabled).toBe(true)
    expect(screen.getByRole('button', { name: /Commiter \(0 fichier\)/ })).toHaveProperty('disabled', true)
    await user.click(screen.getByRole('checkbox', { name: 'Préparer a.ts' }))
    await user.click(screen.getByRole('checkbox', { name: 'Préparer b.ts' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Commiter \(2 fichiers\)/ })).toBeDefined())
    await user.click(screen.getByRole('button', { name: /Proposer un message/ }))
    expect(await screen.findByDisplayValue('feat: a et b')).toBeDefined()
    await user.click(screen.getByRole('button', { name: /Commiter \(2 fichiers\)/ }))
    expect(await screen.findByText(/sur/)).toBeDefined()
    expect(api.invoke).toHaveBeenCalledWith('git:commit', {
      genesisId: G,
      message: 'feat: a et b',
      expectedStaged: ['a.ts', 'b.ts'],
      confirm: true
    })
    await expectNoAxeViolations(container)
  })

  it('should_show_the_failing_hook_output_without_any_bypass', async () => {
    const user = userEvent.setup()
    renderPanel({
      'git:status': () => status([file('a.ts', true)]),
      'git:commit': () => {
        throw new FakeIpcError('HOOK_FAILED', { hookOutput: 'lint en échec' })
      }
    })
    await user.type(await screen.findByLabelText('Message du commit'), 'feat: a')
    await user.keyboard('{Control>}{Enter}{/Control}')
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('lint en échec')).toBeDefined()
    expect(screen.queryByRole('button', { name: /no-verify|passer outre/i })).toBeNull()
  })

  it('should_run_nothing_and_explain_on_a_risky_config', async () => {
    const { api, container } = renderPanel({
      'git:status': () => status([], { state: 'risky_config', riskyConfig: ['filter.x.clean'] })
    })
    expect(await screen.findByText(/aucune commande git n’est lancée/)).toBeDefined()
    expect(screen.getByText('filter.x.clean')).toBeDefined()
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(api.invoke).toHaveBeenCalledTimes(1)
    await expectNoAxeViolations(container)
  })

  it('should_be_read_only_while_an_operation_runs_outside_the_app', async () => {
    renderPanel({ 'git:status': () => status([file('a.ts')], { operation: 'other' }) })
    expect(await screen.findByText(/le volet est en lecture seule/)).toBeDefined()
    expect((screen.getByRole('checkbox', { name: 'Préparer a.ts' }) as HTMLInputElement).disabled).toBe(true)
  })

  it('should_create_a_valid_branch_and_list_files_that_would_be_overwritten', async () => {
    const user = userEvent.setup()
    renderPanel({
      'git:status': () => status([]),
      'git:branches': () => ({
        current: 'main',
        detached: false,
        local: [
          { name: 'main', current: true, upstream: null, ahead: 0, behind: 0 },
          { name: 'essai', current: false, upstream: null, ahead: 0, behind: 0 }
        ],
        remote: []
      }),
      'git:switchBranch': () => {
        throw new FakeIpcError('DIRTY_TREE', { files: ['f.txt'] })
      }
    })
    await user.click(await screen.findByRole('tab', { name: 'Branches' }))
    const input = await screen.findByLabelText('Nouvelle branche')
    await user.type(input, '-x')
    expect(screen.getByRole('button', { name: 'Créer et y passer' })).toHaveProperty('disabled', true)
    await user.click(screen.getByRole('button', { name: 'Passer sur essai' }))
    expect(await screen.findByText('f.txt')).toBeDefined()
  })

  it('should_ask_confirmation_before_reverting_a_commit', async () => {
    const user = userEvent.setup()
    const { api, container } = renderPanel({
      'git:status': () => status([]),
      'git:log': () => ({
        commits: [
          { hash: 'a'.repeat(40), subject: 'feat: deux', date: '2026-10-09T10:00:00Z', authorKey: 'k', isMerge: false }
        ],
        authors: [
          { key: 'k', name: 'Alice Fictive', email: 'alice@example.invalid', initials: 'AF', color: 'hsl(200 55% 45%)' }
        ]
      }),
      'git:revert': () => ({ hash: 'b'.repeat(40) })
    })
    await user.click(await screen.findByRole('tab', { name: 'Historique' }))
    await user.click(await screen.findByRole('button', { name: 'Annuler le commit feat: deux' }))
    expect(api.invoke).not.toHaveBeenCalledWith('git:revert', expect.anything())
    await user.click(screen.getByRole('button', { name: 'Confirmer l’annulation' }))
    await waitFor(() =>
      expect(api.invoke).toHaveBeenCalledWith('git:revert', {
        genesisId: G,
        hash: 'a'.repeat(40),
        expectedHead: 'a'.repeat(40),
        confirm: true
      })
    )
    await expectNoAxeViolations(container)
  })

  it('should_describe_the_repo_state_in_words', () => {
    expect(repoStateText(status([]))).toBe('⎇ main · à jour')
    expect(repoStateText(status([file('a'), file('a', true)], { ahead: 2, behind: 1 }))).toBe(
      '⎇ main · 1 modifié · ↑2 · ↓1'
    )
    expect(repoStateText(status([], { state: 'no_repo' }))).toBe('pas de git')
    expect(repoStateText(status([], { detached: true, branch: null }))).toBe('⎇ HEAD détachée · à jour')
  })
})
