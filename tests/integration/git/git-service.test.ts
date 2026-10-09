import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { GitService } from '../../../src/main/application/git/GitService'
import { RepoLocator } from '../../../src/main/application/git/RepoLocator'
import { GitRunner } from '../../../src/main/infrastructure/git/GitRunner'
import { GitWriteQueue } from '../../../src/main/infrastructure/git/GitWriteQueue'
import type { GitOperationInput } from '../../../src/main/infrastructure/db/repositories/GitRepository'
import { AUTHORS, buildScenario, commit, git, initRepo, writeFiles } from '../../support/gitRepos'

const root = mkdtempSync(join(tmpdir(), 'gi-git-service-'))
const dataDir = join(root, 'profil')
mkdirSync(dataDir, { recursive: true })

function harness(dir: string, options: { trusted?: boolean } = {}) {
  const operations: GitOperationInput[] = []
  const changed: string[] = []
  const runner = new GitRunner({ emptyHooksDir: join(dataDir, 'git-empty-hooks') })
  const service = new GitService({
    locator: new RepoLocator({ projectDir: () => dir, isTrusted: () => options.trusted === true, runner, dataDir }),
    runner,
    queue: new GitWriteQueue(),
    repository: {
      repo: () => undefined,
      logOperation: (input) => {
        operations.push(input)
        return 'id'
      },
      openMergeHead: () => null
    },
    authorSecret: () => 'secret-de-test',
    changed: (genesisId) => changed.push(genesisId)
  })
  return { service, operations, changed }
}

const G = 'g'

describe('dépôt local d’un projet (spec 021 US1, T012–T013)', () => {
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  it('should_commit_only_the_two_checked_files_without_co_author_and_keep_the_third_modified', async () => {
    const repo = initRepo(join(root, 'trois'))
    commit(repo, { 'a.ts': '1', 'b.ts': '1', 'c.ts': '1' }, 'chore: départ')
    writeFiles(repo, { 'a.ts': '2', 'b.ts': '2', 'c.ts': '2', '.env': 'API_KEY=faux' })
    const { service, operations, changed } = harness(repo)
    const before = await service.status(G)
    expect(before.state).toBe('ok')
    expect(before.files.every((file) => !file.staged)).toBe(true)
    expect(before.files.find((file) => file.path === '.env')?.sensitive).toBe(true)
    await expect(service.stage(G, ['.env'])).rejects.toMatchObject({ code: 'SENSITIVE_FILE' })
    await service.stage(G, ['a.ts', 'b.ts'])
    const result = await service.commit(G, 'feat: a et b\n\nCo-Authored-By: Quelqu’un <x@example.invalid>', [
      'a.ts',
      'b.ts'
    ])
    expect(result.branch).toBe('main')
    expect(git(repo, ['show', '--name-only', '--format=%B', 'HEAD'])).not.toMatch(/co-authored-by/i)
    expect(git(repo, ['show', '--name-only', '--format=', 'HEAD']).trim().split('\n').sort()).toEqual(['a.ts', 'b.ts'])
    const after = await service.status(G)
    expect(after.files.map((file) => file.path).sort()).toEqual(['.env', 'c.ts'])
    expect(operations.at(-1)).toMatchObject({ kind: 'commit', status: 'ok', count: 2, branch: 'main' })
    expect(changed).toContain(G)
  })

  it('should_refuse_the_commit_when_the_selection_changed_behind_the_users_back', async () => {
    const repo = initRepo(join(root, 'selection'))
    commit(repo, { 'a.ts': '1', 'b.ts': '1' }, 'chore: départ')
    writeFiles(repo, { 'a.ts': '2', 'b.ts': '2' })
    const { service } = harness(repo)
    await service.stage(G, ['a.ts'])
    git(repo, ['add', '--', 'b.ts'])
    await expect(service.commit(G, 'feat: a', ['a.ts'])).rejects.toMatchObject({ code: 'STAGED_CHANGED' })
    await expect(service.commit(G, 'feat: a', [])).rejects.toMatchObject({ code: 'STAGED_CHANGED' })
  })

  it('should_run_hooks_only_when_trusted_and_show_a_failing_hook_output', async () => {
    const repo = buildScenario(join(root, 'hook'), 'hook-temoin')
    writeFiles(repo, { 'x.txt': 'x' })
    const untrusted = harness(repo)
    await untrusted.service.stage(G, ['x.txt'])
    await untrusted.service.commit(G, 'feat: x', ['x.txt'])
    expect(existsSync(join(repo, 'hook-a-tourne.txt'))).toBe(false)
    writeFiles(repo, { '.git/hooks/pre-commit': '#!/bin/sh\necho "lint en échec" >&2\nexit 1\n', 'y.txt': 'y' })
    const trusted = harness(repo, { trusted: true })
    await trusted.service.stage(G, ['y.txt'])
    await expect(trusted.service.commit(G, 'feat: y', ['y.txt'])).rejects.toMatchObject({
      code: 'HOOK_FAILED',
      details: { hookOutput: expect.stringContaining('lint en échec') }
    })
  })

  it('should_create_and_switch_branches_and_explain_when_files_would_be_overwritten', async () => {
    const repo = initRepo(join(root, 'branches'))
    commit(repo, { 'f.txt': 'main' }, 'chore: départ')
    const { service } = harness(repo)
    await expect(service.createBranch(G, 'essai/volet')).resolves.toMatchObject({ branch: 'essai/volet' })
    await expect(service.createBranch(G, 'essai/volet')).rejects.toMatchObject({ code: 'NAME_TAKEN' })
    commit(repo, { 'f.txt': 'essai' }, 'feat: essai')
    writeFiles(repo, { 'f.txt': 'modifié' })
    await expect(service.switchBranch(G, 'main')).rejects.toMatchObject({
      code: 'DIRTY_TREE',
      details: { files: ['f.txt'] }
    })
    git(repo, ['checkout', '-q', '--', 'f.txt'])
    await expect(service.switchBranch(G, 'main')).resolves.toMatchObject({ branch: 'main' })
    await expect(service.switchBranch(G, 'nexiste-pas')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    const branches = await service.branches(G)
    expect(branches.local.map((branch) => branch.name).sort()).toEqual(['essai/volet', 'main'])
    expect(branches.current).toBe('main')
  })

  it('should_revert_a_simple_commit_and_refuse_a_merge_commit_or_a_moved_head', async () => {
    const repo = initRepo(join(root, 'revert'))
    commit(repo, { 'f.txt': '1' }, 'chore: départ')
    commit(repo, { 'f.txt': '2' }, 'feat: deux')
    const { service } = harness(repo)
    const head = git(repo, ['rev-parse', 'HEAD']).trim()
    await expect(service.revert(G, head, 'b'.repeat(7))).rejects.toMatchObject({ code: 'HEAD_CHANGED' })
    await service.revert(G, head, head.slice(0, 7))
    expect(git(repo, ['log', '-1', '--format=%s']).trim()).toBe('Revert "feat: deux"')
    git(repo, ['switch', '-q', '-c', 'cote'])
    commit(repo, { 'g.txt': 'g' }, 'feat: côté')
    git(repo, ['switch', '-q', 'main'])
    git(repo, ['merge', '-q', '--no-ff', '-m', 'Merge cote', 'cote'])
    const merge = git(repo, ['rev-parse', 'HEAD']).trim()
    await expect(service.revert(G, merge, merge)).rejects.toMatchObject({ code: 'MERGE_COMMIT' })
  })

  it('should_read_only_when_an_operation_runs_outside_the_app_and_report_a_detached_head', async () => {
    const repo = initRepo(join(root, 'lecture'))
    commit(repo, { 'f.txt': '1' }, 'chore: départ')
    commit(repo, { 'f.txt': '2' }, 'feat: deux')
    writeFiles(repo, { 'n.txt': 'n' })
    mkdirSync(join(repo, '.git', 'rebase-merge'))
    const { service } = harness(repo)
    expect((await service.status(G)).operation).toBe('other')
    await expect(service.stage(G, ['n.txt'])).rejects.toMatchObject({ code: 'READ_ONLY_STATE' })
    rmSync(join(repo, '.git', 'rebase-merge'), { recursive: true })
    git(repo, ['checkout', '-q', 'HEAD~1'])
    await expect(service.status(G)).resolves.toMatchObject({ detached: true, branch: null })
    await service.stage(G, ['n.txt'])
    await expect(service.commit(G, 'feat: n', ['n.txt'])).rejects.toMatchObject({ code: 'DETACHED_HEAD' })
  })

  it('should_list_commits_with_author_keys_merging_identities_by_email', async () => {
    const repo = buildScenario(join(root, 'auteurs'), 'trois-auteurs')
    const { service } = harness(repo)
    const log = await service.log(G, 50)
    expect(log.commits).toHaveLength(4)
    expect(JSON.stringify(log.commits)).not.toContain('@example.invalid')
    // Alice et « A. Fictive » ont le même e-mail (casse près) : une seule clé.
    expect(log.authors).toHaveLength(3)
    expect(log.authors.find((author) => author.email.toLowerCase() === AUTHORS.alice.email)?.initials).toBe('AF')
  })

  it('should_diff_tracked_untracked_and_binary_files_and_never_read_a_secret', async () => {
    const repo = initRepo(join(root, 'diff'))
    commit(repo, { 'a.ts': 'un\ndeux\n', 'logo.png': Buffer.from([0x89, 0, 1]) }, 'chore: départ')
    writeFiles(repo, {
      'a.ts': 'un\ntrois\n',
      'nouveau.ts': 'x\ny\n',
      'logo.png': Buffer.from([0x89, 0, 2]),
      '.env': 'K=v'
    })
    const { service } = harness(repo)
    const tracked = await service.diff(G, 'a.ts', false)
    expect(tracked.hunks[0]?.lines.map((line) => `${line.kind}:${line.text}`)).toEqual([
      'ctx:un',
      'del:deux',
      'add:trois'
    ])
    expect((await service.diff(G, 'nouveau.ts', false)).hunks[0]?.lines).toHaveLength(2)
    expect((await service.diff(G, 'logo.png', false)).binary).toBe(true)
    await expect(service.diff(G, '.env', false)).rejects.toMatchObject({ code: 'SENSITIVE_FILE' })
  })

  it('should_launch_nothing_but_the_config_read_on_a_risky_untrusted_repo', async () => {
    const repo = buildScenario(join(root, 'risque'), 'config-piegee')
    const { service } = harness(repo)
    expect(await service.status(G)).toMatchObject({ state: 'risky_config', files: [] })
    await expect(service.stage(G, ['README.md'])).rejects.toMatchObject({ code: 'RISKY_CONFIG' })
    expect(existsSync(join(repo, 'filtre-a-tourne.txt'))).toBe(false)
  })

  it('should_report_a_folder_without_git', async () => {
    const plain = join(root, 'sans-git')
    mkdirSync(plain, { recursive: true })
    writeFileSync(join(plain, 'a.txt'), 'a')
    expect((await harness(plain).service.status(G)).state).toBe('no_repo')
  })
})
