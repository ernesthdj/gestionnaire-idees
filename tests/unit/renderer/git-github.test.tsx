import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { GitStatusView } from '../../../src/shared/git/model'
import { ForkDialog } from '../../../src/renderer/src/git/ForkDialog'
import { GitHubMarkdown } from '../../../src/renderer/src/git/GitHubMarkdown'
import { RepoPanel } from '../../../src/renderer/src/git/RepoPanel'
import { expectNoAxeViolations } from '../../support/axe'
import { installFakeApi } from './support/fakeApi'

const G = '00000000-0000-4000-8000-000000000c26'
const IDEA = '00000000-0000-4000-8000-000000000c27'

const status = (github: GitStatusView['github']): GitStatusView => ({
  state: 'ok',
  branch: 'export',
  detached: false,
  upstream: { remote: 'origin', branch: 'export' },
  ahead: 0,
  behind: 0,
  lastFetchAt: null,
  files: [],
  filesTotal: 0,
  operation: 'none',
  onPrBranch: false,
  trusted: false,
  riskyConfig: [],
  github,
  newSinceVisit: 0
})
const pr = {
  number: 12,
  title: 'feat: export CSV',
  author: 'collegue',
  state: 'open',
  draft: false,
  head: 'export',
  base: 'main',
  updatedAt: '2026-10-10T10:00:00Z',
  url: 'https://github.com/compte/projet/pull/12'
}

function wrap(node: React.ReactNode): React.JSX.Element {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {node}
    </QueryClientProvider>
  )
}

describe('textes venus de GitHub (spec 021 T046)', () => {
  it('should_render_no_html_no_remote_image_and_open_only_github_links', async () => {
    const user = userEvent.setup()
    const { invoke } = installFakeApi({ 'git:openExternal': () => ({ ok: true }) })
    const { container } = render(
      <GitHubMarkdown
        text={
          '<script>alert(1)</script><img src="https://tracker.example/x.png">\n\n![logo](https://tracker.example/l.png)\n\n' +
          '[la PR](https://github.com/compte/projet/pull/1) et [un piège](https://github.com.evil.example/login)'
        }
      />
    )
    expect(container.querySelector('script, img, a')).toBeNull()
    expect(screen.getByText('[image : logo]')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'un piège' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Copier l’adresse https://github.com.evil.example/login' })).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'la PR' }))
    expect(invoke).toHaveBeenCalledWith('git:openExternal', { url: 'https://github.com/compte/projet/pull/1' })
    await expectNoAxeViolations(container)
  })
})

describe('PR, issues et fork dans le volet Dépôt (spec 021 T050)', () => {
  it('should_hide_the_github_tabs_outside_github', async () => {
    installFakeApi({ 'git:status': () => status(null) })
    render(wrap(<RepoPanel genesisId={G} onClose={() => undefined} />))
    await screen.findByRole('tab', { name: 'Historique' })
    expect(screen.queryByRole('tab', { name: 'PR' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Issues' })).toBeNull()
  })

  it('should_review_a_pr_with_claude_and_publish_a_comment_only_after_reading_it', async () => {
    const user = userEvent.setup()
    const { invoke } = installFakeApi({
      'git:status': () => status({ repo: 'compte/projet', isGitHub: true }),
      'git:prList': () => ({ items: [pr], more: false }),
      'git:prView': () => ({
        ...pr,
        body: 'Ajoute **l’export**.',
        files: [{ path: 'src/export.ts', additions: 3, deletions: 0 }],
        diff: 'diff --git a/src/export.ts b/src/export.ts\n+export const csv = 1\n',
        truncated: false
      }),
      'git:prReview': () => ({
        summary: 'Ajoute un export.',
        comments: [{ path: 'src/export.ts', line: 1, text: 'Tester le cas vide.' }]
      }),
      'git:prComment': () => ({ url: 'https://github.com/compte/projet/pull/12#issuecomment-1' })
    })
    const { container } = render(wrap(<RepoPanel genesisId={G} onClose={() => undefined} />))
    await user.click(await screen.findByRole('tab', { name: 'PR' }))
    await user.click(await screen.findByRole('button', { name: /#12 feat: export CSV/ }))
    const article = await screen.findByRole('article', { name: 'PR #12' })
    expect(within(article).getByLabelText('Diff de la PR').textContent).toContain('+export const csv = 1')
    await user.click(within(article).getByRole('button', { name: '✨ Relire avec Claude' }))
    const review = await within(article).findByRole('region', { name: 'Relecture de Claude' })
    expect(invoke).not.toHaveBeenCalledWith('git:prComment', expect.anything())
    await user.click(within(review).getByRole('button', { name: 'Commenter' }))
    const box = within(article).getByLabelText('Commentaire publié sur GitHub (relis-le)')
    expect((box as HTMLTextAreaElement).value).toBe('src/export.ts:1 — Tester le cas vide.')
    await expectNoAxeViolations(container)
    await user.click(within(article).getByRole('button', { name: 'Publier ce commentaire' }))
    await within(article).findByText('Commentaire publié.')
    expect(invoke).toHaveBeenCalledWith('git:prComment', {
      genesisId: G,
      number: 12,
      body: 'src/export.ts:1 — Tester le cas vide.',
      confirm: true
    })
    expect(screen.queryByRole('button', { name: /fusionner|approuver/i })).toBeNull()
  })

  it('should_propose_a_pr_text_and_create_it_after_the_recap', async () => {
    const user = userEvent.setup()
    const { invoke } = installFakeApi({
      'git:status': () => status({ repo: 'compte/projet', isGitHub: true }),
      'git:prList': () => ({ items: [], more: false }),
      'git:log': () => ({ commits: [{ hash: 'a'.repeat(40) }], authors: [] }),
      'git:prPropose': () => ({ title: 'feat: export', body: '## Quoi\nExport' }),
      'git:prCreate': () => ({ number: 42, url: 'https://github.com/compte/projet/pull/42' })
    })
    render(wrap(<RepoPanel genesisId={G} onClose={() => undefined} />))
    await user.click(await screen.findByRole('tab', { name: 'PR' }))
    await user.click(await screen.findByRole('button', { name: 'Nouvelle PR' }))
    await user.click(screen.getByRole('button', { name: '✨ Proposer le texte' }))
    await waitFor(() => expect((screen.getByLabelText('Titre') as HTMLInputElement).value).toBe('feat: export'))
    await user.click(screen.getByRole('button', { name: 'Vérifier et créer' }))
    expect(invoke).not.toHaveBeenCalledWith('git:prCreate', expect.anything())
    const recap = screen.getByRole('alertdialog', { name: 'Récapitulatif de la PR' })
    await user.click(within(recap).getByRole('button', { name: 'Créer la PR' }))
    await screen.findByText('PR #42 créée.')
    expect(invoke).toHaveBeenCalledWith('git:prCreate', {
      genesisId: G,
      base: 'main',
      title: 'feat: export',
      body: '## Quoi\nExport',
      draft: false,
      confirm: true,
      expectedHead: 'a'.repeat(40)
    })
  })

  it('should_create_an_issue_from_an_idea_and_link_an_issue_to_an_idea', async () => {
    const user = userEvent.setup()
    let links: { id: string; kind: 'issue'; number: number; neuronId: string }[] = []
    const { invoke } = installFakeApi({
      'git:status': () => status({ repo: 'compte/projet', isGitHub: true }),
      'git:issueList': () => ({
        items: [
          {
            number: 3,
            title: 'Bug export',
            author: 'collegue',
            state: 'open',
            labels: ['bug'],
            updatedAt: '2026-10-10T10:00:00Z',
            url: 'https://github.com/compte/projet/issues/3'
          }
        ],
        more: false
      }),
      'git:issueView': () => ({
        number: 3,
        title: 'Bug export',
        author: 'collegue',
        state: 'open',
        labels: [],
        updatedAt: '2026-10-10T10:00:00Z',
        url: 'https://github.com/compte/projet/issues/3',
        body: 'Le CSV est vide.'
      }),
      'neuron:getTree': () => ({
        root: { id: G, title: 'Projet fictif' },
        neurons: [{ id: IDEA, title: 'Export CSV' }]
      }),
      'git:issueLinks': () => links,
      'git:issueLink': (payload) => {
        const input = payload as { number: number; neuronId: string }
        links = [{ id: 'l1', kind: 'issue', number: input.number, neuronId: input.neuronId }]
        return { linkId: 'l1', batchId: 'b1' }
      },
      'git:issuePropose': () => ({ title: 'Export CSV', body: '## Contexte\nNote' }),
      'git:issueCreate': () => ({ number: 7, url: 'https://github.com/compte/projet/issues/7', linkBatchId: 'b2' })
    })
    render(wrap(<RepoPanel genesisId={G} onClose={() => undefined} />))
    await user.click(await screen.findByRole('tab', { name: 'Issues' }))
    await user.click(await screen.findByRole('button', { name: /#3 Bug export/ }))
    const article = await screen.findByRole('article', { name: 'Issue #3' })
    await within(article).findByRole('option', { name: 'Export CSV' })
    await user.selectOptions(within(article).getByLabelText('Idée à relier'), IDEA)
    await user.click(within(article).getByRole('button', { name: 'Relier' }))
    await within(article).findByRole('button', { name: 'Délier' })
    await user.click(within(article).getByRole('button', { name: '← Issues' }))

    await user.click(await screen.findByRole('button', { name: 'Nouvelle issue' }))
    await screen.findByRole('option', { name: 'Export CSV' })
    await user.selectOptions(screen.getByLabelText('Depuis une idée (facultatif)'), IDEA)
    await user.click(screen.getByRole('button', { name: '✨ Proposer' }))
    await waitFor(() => expect((screen.getByLabelText('Titre') as HTMLInputElement).value).toBe('Export CSV'))
    await user.click(screen.getByRole('button', { name: 'Vérifier et créer' }))
    await user.click(screen.getByRole('button', { name: 'Créer l’issue' }))
    await screen.findByText('Issue #7 créée et reliée à son idée.')
    expect(invoke).toHaveBeenCalledWith(
      'git:issueCreate',
      expect.objectContaining({ confirm: true, fromNeuronId: IDEA })
    )
  })

  it('should_show_the_fork_recap_then_fork_on_click', async () => {
    const user = userEvent.setup()
    const { invoke } = installFakeApi({
      'git:forkPreview': () => ({ source: 'compte/projet', target: 'moi/projet', alreadyForked: false }),
      'git:fork': () => ({ fork: 'moi/projet' })
    })
    const { container } = render(wrap(<ForkDialog genesisId={G} onDone={() => undefined} />))
    expect(await screen.findByText('upstream → compte/projet (l’original)')).toBeDefined()
    expect(invoke).not.toHaveBeenCalledWith('git:fork', expect.anything())
    await expectNoAxeViolations(container)
    await user.click(screen.getByRole('button', { name: 'Forker' }))
    await screen.findByText(/Fork prêt/)
    expect(invoke).toHaveBeenCalledWith('git:fork', { genesisId: G, confirm: true })
  })
})
