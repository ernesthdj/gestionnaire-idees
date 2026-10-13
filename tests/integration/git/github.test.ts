import { randomUUID } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { GitAccess } from '../../../src/main/application/git/GitAccess'
import { GitHubService } from '../../../src/main/application/git/GitHubService'
import { RepoLocator } from '../../../src/main/application/git/RepoLocator'
import { HistoryService } from '../../../src/main/application/history/HistoryService'
import { openDatabase } from '../../../src/main/infrastructure/db/client'
import { GitRepository } from '../../../src/main/infrastructure/db/repositories/GitRepository'
import { HistoryRepository } from '../../../src/main/infrastructure/db/repositories/HistoryRepository'
import { NeuronRepository } from '../../../src/main/infrastructure/db/repositories/NeuronRepository'
import { GitRunner } from '../../../src/main/infrastructure/git/GitRunner'
import { GitWriteQueue } from '../../../src/main/infrastructure/git/GitWriteQueue'
import type { ProcessResult } from '../../../src/main/infrastructure/process/ProcessRunner'
import { AUTHORS, commit, git, initRepo } from '../../support/gitRepos'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')
const root = mkdtempSync(join(tmpdir(), 'gi-github-'))
const dataDir = join(root, 'profil')
mkdirSync(dataDir, { recursive: true })

const result = (stdout: string, code = 0, stderr = ''): ProcessResult => ({
  code,
  stdout,
  stderr,
  truncated: false,
  timedOut: false,
  spawnFailed: false
})
const pr = (number: number) => ({
  number,
  title: `feat: ${number}`,
  author: { login: 'collegue' },
  state: 'OPEN',
  isDraft: false,
  headRefName: `branche-${number}`,
  baseRefName: 'main',
  updatedAt: '2026-10-10T10:00:00Z',
  url: `https://github.com/compte/projet/pull/${number}`
})

/** `gh` simulé : réponses fixes, appels et entrées standard enregistrés (aucun appel réseau). */
function fakeGh(options: { readonly prCount?: number; readonly login?: string } = {}) {
  const calls: { readonly args: string[]; readonly stdin?: string }[] = []
  return {
    calls,
    gh: {
      status: async () => ({ installed: true, login: options.login ?? 'moi' }),
      run: async (args: readonly string[], run: { readonly stdin?: string } = {}) => {
        calls.push({ args: [...args], ...(run.stdin === undefined ? {} : { stdin: run.stdin }) })
        const [first, second] = args
        if (first === 'pr' && second === 'list') {
          return result(JSON.stringify(Array.from({ length: options.prCount ?? 2 }, (_, index) => pr(index + 1))))
        }
        if (first === 'pr' && second === 'view') {
          return result(
            JSON.stringify({
              ...pr(1),
              body: '<img src="https://tracker.example/x.png"> Merci de relire',
              files: [{ path: 'src/a.ts', additions: 3, deletions: 1 }],
              createdAt: '2026-10-09T10:00:00Z'
            })
          )
        }
        if (first === 'pr' && second === 'diff') return result('diff --git a/src/a.ts b/src/a.ts\n+ligne\n')
        if (first === 'pr' && second === 'comment')
          return result('https://github.com/compte/projet/pull/1#issuecomment-9\n')
        if (first === 'pr' && second === 'create') return result('https://github.com/compte/projet/pull/42\n')
        if (first === 'issue' && second === 'create') return result('https://github.com/compte/projet/issues/7\n')
        if (first === 'repo' && second === 'view') {
          return args[2] === 'moi/projet'
            ? result(JSON.stringify({ url: 'https://github.com/moi/projet', nameWithOwner: 'moi/projet' }))
            : result('', 1, 'not found')
        }
        if (first === 'repo' && second === 'fork') return result('')
        return result('[]')
      }
    }
  }
}

function harness(dir: string, gh = fakeGh().gh, options: { readonly localOnly?: boolean } = {}) {
  const handle = openDatabase({
    file: join(root, `${randomUUID()}.db`),
    key: 'c'.repeat(64),
    migrationsFolder: MIGRATIONS
  })
  const genesisId = randomUUID()
  new NeuronRepository(handle.db).insertRoot({
    id: genesisId,
    title: 'Projet fictif',
    content: 'Exporter les commandes en CSV',
    nature: 'action',
    natureSource: null
  })
  const runner = new GitRunner({ emptyHooksDir: join(dataDir, 'git-empty-hooks') })
  const repository = new GitRepository(handle.db)
  const inputs: string[] = []
  const service = new GitHubService({
    access: new GitAccess({
      locator: new RepoLocator({ projectDir: () => dir, isTrusted: () => false, runner, dataDir }),
      runner,
      repository
    }),
    queue: new GitWriteQueue(),
    gh,
    repository,
    authorSecret: () => 'secret-de-test',
    localOnly: () => options.localOnly === true,
    neuron: (id, neuronId) =>
      id === genesisId && neuronId === genesisId ? { title: 'Export CSV', content: 'Note' } : null,
    changed: () => undefined,
    prText: async (input) => {
      inputs.push(input)
      return { title: 'feat: export', body: '## Quoi\nExport\n\nCo-Authored-By: Claude <noreply@anthropic.com>' }
    },
    prReview: async (input) => {
      inputs.push(input)
      return { summary: 'Ajoute une ligne.', comments: [{ path: 'src/a.ts', line: 1, text: 'Tester le cas vide.' }] }
    },
    issueText: async (input) => {
      inputs.push(input)
      return { title: 'Export CSV', body: '## Contexte\nNote' }
    }
  })
  const history = new HistoryService(new HistoryRepository(handle.db), service.historyHandlers())
  return { genesisId, service, history, inputs, close: () => handle.close() }
}

/** Dépôt dont `origin` pointe vers github.com (jamais contacté : `gh` est simulé, aucun push). */
function githubRepo(name: string): string {
  const dir = initRepo(join(root, name))
  commit(dir, { 'README.md': '# Projet\n' }, 'chore: départ', AUTHORS.alice)
  git(dir, ['remote', 'add', 'origin', 'https://github.com/compte/projet.git'])
  return dir
}

describe('pull requests, issues et fork (spec 021 US6)', { timeout: 60_000 }, () => {
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  it('should_list_at_most_50_prs_keep_them_5_minutes_and_refuse_a_project_outside_github', async () => {
    const fake = fakeGh({ prCount: 51 })
    const { genesisId, service, close } = harness(githubRepo('liste'), fake.gh)
    const first = await service.prList(genesisId, 'open')
    expect(first.items).toHaveLength(50)
    expect(first.more).toBe(true)
    await service.prList(genesisId, 'open')
    expect(fake.calls.filter((call) => call.args[1] === 'list')).toHaveLength(1)
    await service.prList(genesisId, 'open', true)
    expect(fake.calls.filter((call) => call.args[1] === 'list')).toHaveLength(2)
    const detail = await service.prView(genesisId, 1)
    expect(detail.diff).toContain('+ligne')
    expect(detail.files).toEqual([{ path: 'src/a.ts', additions: 3, deletions: 1 }])
    close()
    const local = initRepo(join(root, 'local'))
    commit(local, { 'a.txt': 'a\n' }, 'chore: a')
    const offline = harness(local)
    await expect(offline.service.prList(offline.genesisId, 'open')).rejects.toMatchObject({ code: 'NOT_GITHUB' })
    offline.close()
  })

  it('should_propose_a_pr_with_pseudonyms_and_without_co_author_then_create_it_only_once_pushed', async () => {
    const dir = githubRepo('pr')
    git(dir, ['update-ref', 'refs/remotes/origin/main', 'HEAD'])
    git(dir, ['switch', '-q', '-c', 'export'])
    commit(dir, { 'src/export.ts': 'export const csv = 1\n' }, 'feat: export CSV', AUTHORS.bob)
    const fake = fakeGh()
    const { genesisId, service, inputs, close } = harness(dir, fake.gh)
    const proposal = await service.prPropose(genesisId, 'main')
    expect(proposal.body).not.toMatch(/Co-Authored-By/i)
    expect(inputs[0]).toContain('Auteur A · feat: export CSV')
    expect(inputs[0]).toContain('src/export.ts +1 -0')
    expect(inputs[0]).not.toContain(AUTHORS.bob.name)
    const head = git(dir, ['rev-parse', 'HEAD']).trim()
    const input = {
      genesisId,
      base: 'main',
      title: 'feat: export',
      body: proposal.body,
      draft: false,
      expectedHead: head
    }
    await expect(service.prCreate(input)).rejects.toMatchObject({ code: 'BRANCH_NOT_PUSHED' })
    git(dir, ['update-ref', 'refs/remotes/origin/export', 'HEAD'])
    git(dir, ['branch', '-q', '--set-upstream-to=origin/export'])
    await expect(service.prCreate({ ...input, expectedHead: 'a'.repeat(40) })).rejects.toMatchObject({
      code: 'HEAD_CHANGED'
    })
    expect(await service.prCreate(input)).toEqual({ number: 42, url: 'https://github.com/compte/projet/pull/42' })
    const create = fake.calls.find((call) => call.args[1] === 'create')
    expect(create?.args).toContain('--head=export')
    expect(create?.stdin).toBe('## Quoi\nExport')
    close()
  })

  it('should_review_a_pr_in_the_app_and_publish_a_comment_only_when_asked', async () => {
    const fake = fakeGh()
    const { genesisId, service, inputs, close } = harness(githubRepo('relecture'), fake.gh)
    const review = await service.prReview(genesisId, 1)
    expect(review.comments).toHaveLength(1)
    expect(inputs[0]).toContain('<diff>')
    expect(fake.calls.some((call) => call.args[1] === 'comment')).toBe(false)
    expect(await service.prComment(genesisId, 1, 'Tester le cas vide.')).toEqual({
      url: 'https://github.com/compte/projet/pull/1#issuecomment-9'
    })
    close()
    const local = harness(githubRepo('relecture-locale'), fakeGh().gh, { localOnly: true })
    await expect(local.service.prReview(local.genesisId, 1)).rejects.toMatchObject({ code: 'LOCAL_ONLY' })
    local.close()
  })

  it('should_create_an_issue_from_an_idea_link_it_and_undo_the_link_from_the_history', async () => {
    const { genesisId, service, history, close } = harness(githubRepo('issue'))
    expect(await service.issuePropose(genesisId, genesisId)).toEqual({ title: 'Export CSV', body: '## Contexte\nNote' })
    const created = await service.issueCreate({ genesisId, title: 'Export CSV', body: 'Note', fromNeuronId: genesisId })
    expect(created.number).toBe(7)
    expect(service.issueLinks(genesisId)).toEqual([
      expect.objectContaining({ kind: 'issue', number: 7, neuronId: genesisId })
    ])
    expect(() => service.link(genesisId, 'issue', 7, genesisId)).toThrow(/existe déjà/)
    expect(() => service.link(genesisId, 'pr', 1, randomUUID())).toThrow(/introuvable/)
    history.undo(created.linkBatchId ?? '')
    expect(service.issueLinks(genesisId)).toEqual([])
    const { batchId } = service.link(genesisId, 'pr', 1, genesisId)
    expect(history.list().items[0]?.summary).toBe('PR #1 reliée à une idée')
    service.unlink(genesisId, 'pr', 1, genesisId)
    expect(service.issueLinks(genesisId)).toEqual([])
    expect(batchId).not.toBe('')
    close()
  })

  it('should_fork_and_set_origin_to_the_fork_and_upstream_to_the_original', async () => {
    const dir = githubRepo('fork')
    const fake = fakeGh()
    const { genesisId, service, close } = harness(dir, fake.gh)
    expect(await service.forkPreview(genesisId)).toEqual({
      source: 'compte/projet',
      target: 'moi/projet',
      alreadyForked: true
    })
    expect(await service.fork(genesisId)).toEqual({ fork: 'moi/projet' })
    expect(git(dir, ['remote', 'get-url', 'origin']).trim()).toBe('https://github.com/moi/projet.git')
    expect(git(dir, ['remote', 'get-url', 'upstream']).trim()).toBe('https://github.com/compte/projet.git')
    // Déjà forké : aucun `gh repo fork` lancé.
    expect(fake.calls.some((call) => call.args[1] === 'fork')).toBe(false)
    await expect(service.forkPreview(genesisId)).rejects.toMatchObject({ code: 'OWN_REPO' })
    close()
  })
})
