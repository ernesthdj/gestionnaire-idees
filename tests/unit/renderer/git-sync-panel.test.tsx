import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { GitStatusView } from '../../../src/shared/git/model'
import type { PublishPreviewView, PushPreviewView } from '../../../src/shared/git/sync'
import { PublishPanel } from '../../../src/renderer/src/git/PublishPanel'
import { PushPanel } from '../../../src/renderer/src/git/PushPanel'
import { checkedAgo, SyncBar } from '../../../src/renderer/src/git/SyncBar'
import { expectNoAxeViolations } from '../../support/axe'
import { FakeIpcError, installFakeApi } from './support/fakeApi'

const G = '00000000-0000-4000-8000-000000000c22'
const HEAD = 'a'.repeat(40)
const UP = 'b'.repeat(40)

const status = (extra: Partial<GitStatusView> = {}): GitStatusView => ({
  state: 'ok',
  branch: 'main',
  detached: false,
  upstream: { remote: 'origin', branch: 'main' },
  ahead: 2,
  behind: 1,
  lastFetchAt: null,
  files: [],
  filesTotal: 0,
  operation: 'none',
  onPrBranch: false,
  trusted: false,
  riskyConfig: [],
  github: null,
  newSinceVisit: 0,
  ...extra
})

const pushPreview = (extra: Partial<PushPreviewView> = {}): PushPreviewView => ({
  remote: 'origin',
  remoteUrl: 'https://github.com/moi/projet.git',
  githubRepo: 'moi/projet',
  branch: 'main',
  targetBranch: 'main',
  firstPush: false,
  head: HEAD,
  commits: [
    { hash: 'c'.repeat(40), date: '2026-10-10T10:00:00Z', subject: 'feat: b' },
    { hash: 'd'.repeat(40), date: '2026-10-10T09:00:00Z', subject: 'feat: a' }
  ],
  total: 2,
  findings: [],
  namesOnly: false,
  permission: 'admin',
  isDefaultBranch: true,
  ownedByViewer: true,
  blocked: null,
  checkedAt: '2026-10-10T10:00:00Z',
  ...extra
})

function renderWith(node: React.ReactNode, handlers: Parameters<typeof installFakeApi>[0]) {
  const api = installFakeApi(handlers)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return { api, ...render(<QueryClientProvider client={client}>{node}</QueryClientProvider>) }
}

describe('publier, tirer, pousser dans le volet (spec 021 T025, US2)', () => {
  it('should_check_the_remote_once_then_offer_to_merge_two_diverged_histories', async () => {
    const user = userEvent.setup()
    const { api, container } = renderWith(
      <SyncBar genesisId={G} status={status()} readOnly={false} onPush={() => undefined} onPublish={() => undefined} />,
      {
        'git:fetch': () => status(),
        'git:pull': () => ({ result: 'diverged', incoming: 1, upstreamHead: UP }),
        'git:merge': () => ({ result: 'merged', hash: HEAD })
      }
    )
    await waitFor(() => expect(api.invoke).toHaveBeenCalledWith('git:fetch', { genesisId: G }))
    await expectNoAxeViolations(container)
    await user.click(screen.getByRole('button', { name: '↓ Tirer (1)' }))
    expect(await screen.findByText(/les deux historiques ont divergé/)).toBeDefined()
    expect(api.invoke).not.toHaveBeenCalledWith('git:merge', expect.anything())
    await user.click(screen.getByRole('button', { name: 'Fusionner les deux historiques' }))
    await waitFor(() =>
      expect(api.invoke).toHaveBeenCalledWith('git:merge', { genesisId: G, confirm: true, expectedUpstreamHead: UP })
    )
    expect(await screen.findByText('Les deux historiques sont fusionnés.')).toBeDefined()
  })

  it('should_offer_publishing_for_a_repo_without_remote_and_never_check_it', async () => {
    const user = userEvent.setup()
    let published = false
    const { api } = renderWith(
      <SyncBar
        genesisId={G}
        status={status({ upstream: null, ahead: 0, behind: 0 })}
        readOnly={false}
        onPush={() => undefined}
        onPublish={() => (published = true)}
      />,
      {}
    )
    await user.click(screen.getByRole('button', { name: 'Publier sur GitHub…' }))
    expect(published).toBe(true)
    expect(api.invoke).not.toHaveBeenCalledWith('git:fetch', expect.anything())
    expect(checkedAgo(null)).toBe('distant jamais vérifié')
    expect(checkedAgo('2026-10-10T10:00:00Z', Date.parse('2026-10-10T10:07:00Z'))).toBe('vérifié il y a 7 min')
  })

  it('should_push_after_the_user_accepts_each_token_finding_and_never_a_blocking_one', async () => {
    const user = userEvent.setup()
    const finding = {
      id: 'e'.repeat(16),
      kind: 'token_pattern' as const,
      path: 'config.ts',
      commit: 'c'.repeat(40),
      line: 3,
      excerpt: 'ghp_••••••',
      reason: 'Préfixe de jeton',
      blocking: false
    }
    const { api, container } = renderWith(<PushPanel genesisId={G} onClose={() => undefined} />, {
      'git:pushPreview': () => pushPreview({ findings: [finding] }),
      'git:push': () => ({ pushed: 2 })
    })
    expect(await screen.findByText('https://github.com/moi/projet.git')).toBeDefined()
    expect(screen.getByText('feat: b')).toBeDefined()
    const button = screen.getByRole('button', { name: 'Pousser 2 commits' })
    expect(button).toHaveProperty('disabled', true)
    await expectNoAxeViolations(container)
    await user.click(screen.getByLabelText('Ce n’est pas un secret'))
    await user.click(button)
    await waitFor(() =>
      expect(api.invoke).toHaveBeenCalledWith('git:push', {
        genesisId: G,
        confirm: true,
        expectedHead: HEAD,
        expectedRemote: 'origin',
        expectedBranch: 'main',
        acceptFindings: [finding.id]
      })
    )
    expect(await screen.findByText(/2 commit\(s\) poussé\(s\)/)).toBeDefined()
  })

  it('should_explain_a_blocked_push_without_any_bypass', async () => {
    renderWith(<PushPanel genesisId={G} onClose={() => undefined} />, {
      'git:pushPreview': () =>
        pushPreview({ blocked: 'THIRD_PARTY_DEFAULT_BRANCH', ownedByViewer: false, permission: 'write' })
    })
    expect((await screen.findByRole('alert')).textContent).toMatch(/Crée une branche/)
    expect(screen.getByRole('button', { name: 'Pousser 2 commits' })).toHaveProperty('disabled', true)
  })

  it('should_publish_privately_by_default_and_ask_a_second_confirmation_for_public', async () => {
    const user = userEvent.setup()
    const preview: PublishPreviewView = {
      login: 'moi',
      suggestedName: 'mon-projet',
      branch: 'main',
      head: HEAD,
      commitsToPush: 3,
      hasGitignore: true,
      findings: [],
      blocked: false
    }
    const { api, container } = renderWith(<PublishPanel genesisId={G} onClose={() => undefined} />, {
      'git:publishPreview': () => preview,
      'git:publish': () => ({ githubRepo: 'moi/mon-projet', url: 'https://github.com/moi/mon-projet.git' })
    })
    expect(((await screen.findByLabelText('Nom du dépôt')) as HTMLInputElement).value).toBe('mon-projet')
    expect((screen.getByLabelText(/Privé/) as HTMLInputElement).checked).toBe(true)
    await expectNoAxeViolations(container)
    await user.click(screen.getByLabelText(/Public/))
    expect(screen.getByRole('button', { name: 'Publier' })).toHaveProperty('disabled', true)
    await user.click(screen.getByLabelText(/Je confirme/))
    await user.click(screen.getByRole('button', { name: 'Publier' }))
    await waitFor(() =>
      expect(api.invoke).toHaveBeenCalledWith('git:publish', {
        genesisId: G,
        name: 'mon-projet',
        description: '',
        visibility: 'public',
        confirm: true,
        confirmPublic: true,
        expectedHead: HEAD
      })
    )
  })

  it('should_show_the_command_to_copy_when_gh_is_not_logged_in', async () => {
    renderWith(<PublishPanel genesisId={G} onClose={() => undefined} />, {
      'git:publishPreview': () => {
        throw new FakeIpcError('GH_NOT_LOGGED_IN')
      }
    })
    expect(await screen.findByText('gh auth login')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Copier la commande' })).toBeDefined()
  })
})
