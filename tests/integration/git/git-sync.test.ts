import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { GitAccess } from '../../../src/main/application/git/GitAccess'
import { GitService } from '../../../src/main/application/git/GitService'
import { PublishService } from '../../../src/main/application/git/PublishService'
import { RepoLocator } from '../../../src/main/application/git/RepoLocator'
import { SyncService } from '../../../src/main/application/git/SyncService'
import { GitRunner } from '../../../src/main/infrastructure/git/GitRunner'
import { GitWriteQueue } from '../../../src/main/infrastructure/git/GitWriteQueue'
import type { GitRepoRow } from '../../../src/main/infrastructure/db/repositories/GitRepository'
import { runProcess, type ProcessResult } from '../../../src/main/infrastructure/process/ProcessRunner'
import { FAKE_PRIVATE_KEY, FAKE_TOKEN, bareWithClone, commit, git, initRepo } from '../../support/gitRepos'

const root = mkdtempSync(join(tmpdir(), 'gi-git-sync-'))
const dataDir = join(root, 'profil')
mkdirSync(dataDir, { recursive: true })
const G = 'g'

const ok = (stdout: string): ProcessResult => ({
  code: 0,
  stdout,
  stderr: '',
  truncated: false,
  timedOut: false,
  spawnFailed: false
})

/** `gh` simulé : connecté en « moi », droits donnés, création enregistrée (aucun appel réseau). */
function fakeGh(options: { login?: string | null; permission?: string; owner?: string; createUrl?: string } = {}) {
  const calls: string[][] = []
  return {
    calls,
    gh: {
      status: async () => ({ installed: true, login: options.login === undefined ? 'moi' : options.login }),
      run: async (args: readonly string[]) => {
        calls.push([...args])
        if (args[0] === 'repo' && args[1] === 'view') {
          return ok(
            JSON.stringify({
              viewerPermission: options.permission ?? 'ADMIN',
              owner: { login: options.owner ?? 'moi' },
              defaultBranchRef: { name: 'main' }
            })
          )
        }
        if (args[0] === 'repo' && args[1] === 'create')
          return ok(`${options.createUrl ?? 'https://github.com/moi/projet'}\n`)
        return ok('')
      }
    }
  }
}

/** `offline` : tout push échoue sans rien lancer (aucun appel réseau vers github.com dans les tests). */
function harness(dir: string, gh = fakeGh().gh, offline = false) {
  const rows = new Map<string, Partial<GitRepoRow>>()
  const runner = new GitRunner({
    emptyHooksDir: join(dataDir, 'git-empty-hooks'),
    allowLocalTransportForTests: true,
    run: (request) =>
      offline && request.args.includes('push')
        ? Promise.resolve({ ...ok(''), code: 128, stderr: 'fatal: unable to access (simulé)' })
        : runProcess(request)
  })
  const locator = new RepoLocator({ projectDir: () => dir, isTrusted: () => false, runner, dataDir })
  const repository = {
    repo: (id: string) => rows.get(id) as GitRepoRow | undefined,
    saveRepo: (id: string, patch: Partial<GitRepoRow>) => rows.set(id, { ...rows.get(id), ...patch }),
    logOperation: () => 'id',
    openMergeHead: () => null
  }
  const queue = new GitWriteQueue()
  const service = new GitService({
    locator,
    runner,
    queue,
    repository,
    authorSecret: () => 's',
    changed: () => undefined
  })
  const access = new GitAccess({ locator, runner, repository })
  const deps = {
    access,
    queue,
    repository,
    gh,
    status: (id: string) => service.status(id),
    changed: () => undefined,
    openMerge: () => undefined
  }
  return { sync: new SyncService(deps), publish: new PublishService(deps), rows, service }
}

// Vrai git (dépôts nus locaux) : sous la charge de la suite complète, chaque test peut dépasser 5 s.
describe('publier, tirer, pousser (spec 021 US2, T021–T024)', { timeout: 60_000 }, () => {
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  it('should_push_two_commits_then_pull_a_commit_made_elsewhere', async () => {
    const { bare, work } = bareWithClone(join(root, 'aller-retour'))
    commit(work, { 'a.ts': '1' }, 'feat: a')
    commit(work, { 'b.ts': '1' }, 'feat: b')
    const { sync } = harness(work)
    const preview = await sync.pushPreview(G)
    expect(preview).toMatchObject({
      remote: 'origin',
      branch: 'main',
      targetBranch: 'main',
      firstPush: false,
      total: 2
    })
    expect(preview.commits.map((entry) => entry.subject)).toEqual(['feat: b', 'feat: a'])
    expect(preview.remoteUrl).toBe('dépôt local')
    expect(preview.blocked).toBeNull()
    await expect(
      sync.push({
        genesisId: G,
        expectedHead: preview.head,
        expectedRemote: 'origin',
        expectedBranch: 'main',
        acceptFindings: []
      })
    ).resolves.toEqual({ pushed: 2 })
    expect(git(bare, ['log', '--format=%s', 'main']).trim().split('\n')).toEqual([
      'feat: b',
      'feat: a',
      'chore: départ'
    ])

    // Un collègue pousse un commit ; on vérifie le distant, puis on tire en avance rapide.
    const other = join(root, 'aller-retour', 'collegue')
    git(root, ['clone', '-q', bare, other])
    git(other, ['config', 'user.name', 'Collègue Fictif'])
    git(other, ['config', 'user.email', 'collegue@example.invalid'])
    commit(other, { 'c.ts': '1' }, 'feat: c')
    git(other, ['push', '-q', 'origin', 'main'])
    const fetched = await sync.fetch(G)
    expect(fetched.behind).toBe(1)
    await expect(sync.pull(G)).resolves.toEqual({ result: 'fast_forward', incoming: 1 })
    expect(git(work, ['log', '-1', '--format=%s']).trim()).toBe('feat: c')
    await expect(sync.pull(G)).resolves.toEqual({ result: 'up_to_date', incoming: 0 })
  })

  it('should_refuse_a_push_when_the_state_changed_and_ask_to_pull_first_when_rejected', async () => {
    const { bare, work } = bareWithClone(join(root, 'rejet'))
    commit(work, { 'a.ts': '1' }, 'feat: a')
    const { sync } = harness(work)
    const preview = await sync.pushPreview(G)
    commit(work, { 'b.ts': '1' }, 'feat: b')
    await expect(
      sync.push({
        genesisId: G,
        expectedHead: preview.head,
        expectedRemote: 'origin',
        expectedBranch: 'main',
        acceptFindings: []
      })
    ).rejects.toMatchObject({ code: 'HEAD_CHANGED' })

    const other = join(root, 'rejet', 'collegue')
    git(root, ['clone', '-q', bare, other])
    git(other, ['config', 'user.name', 'Collègue Fictif'])
    git(other, ['config', 'user.email', 'collegue@example.invalid'])
    commit(other, { 'c.ts': '1' }, 'feat: c')
    git(other, ['push', '-q', 'origin', 'main'])
    const fresh = await sync.pushPreview(G)
    await expect(
      sync.push({
        genesisId: G,
        expectedHead: fresh.head,
        expectedRemote: 'origin',
        expectedBranch: 'main',
        acceptFindings: []
      })
    ).rejects.toMatchObject({ code: 'NON_FAST_FORWARD' })
    // Deux historiques : tirer annonce la divergence, la fusion confirmée les réunit.
    await sync.fetch(G)
    const upstream = git(work, ['rev-parse', 'refs/remotes/origin/main']).trim()
    await expect(sync.pull(G)).resolves.toEqual({ result: 'diverged', incoming: 1, upstreamHead: upstream })
    await expect(sync.merge(G, '0'.repeat(40))).rejects.toMatchObject({ code: 'UPSTREAM_CHANGED' })
    const merged = await sync.merge(G, upstream)
    expect(merged.result).toBe('merged')
    expect(git(work, ['log', '-1', '--format=%P']).trim().split(' ')).toHaveLength(2)
  })

  it('should_block_a_push_with_a_secret_in_an_old_commit_and_accept_a_token_line_by_line', async () => {
    const { bare, work } = bareWithClone(join(root, 'secrets'))
    commit(work, { '.env': 'API_KEY=faux\n' }, 'chore: oubli')
    commit(work, { 'a.ts': 'export {}\n' }, 'feat: a')
    const { sync } = harness(work)
    const blocked = await sync.pushPreview(G)
    // Le fichier sensible est dans l'AVANT-DERNIER commit, pas dans le dernier : il bloque quand même.
    expect(blocked.blocked).toBe('SENSITIVE_IN_HISTORY')
    expect(blocked.findings.map((finding) => finding.path)).toContain('.env')
    await expect(
      sync.push({
        genesisId: G,
        expectedHead: blocked.head,
        expectedRemote: 'origin',
        expectedBranch: 'main',
        acceptFindings: blocked.findings.map((f) => f.id)
      })
    ).rejects.toMatchObject({ code: 'SENSITIVE_IN_HISTORY' })
    expect(git(bare, ['log', '--format=%s', 'main']).trim()).toBe('chore: départ')

    const { work: second } = bareWithClone(join(root, 'jeton'))
    commit(second, { 'config.ts': `const t = '${FAKE_TOKEN}'\n` }, 'feat: config')
    const tokens = harness(second).sync
    const preview = await tokens.pushPreview(G)
    expect(preview.blocked).toBeNull()
    const [finding] = preview.findings
    expect(finding).toMatchObject({ kind: 'token_pattern', blocking: false })
    expect(finding?.excerpt).not.toContain(FAKE_TOKEN)
    await expect(
      tokens.push({
        genesisId: G,
        expectedHead: preview.head,
        expectedRemote: 'origin',
        expectedBranch: 'main',
        acceptFindings: []
      })
    ).rejects.toMatchObject({ code: 'SENSITIVE_IN_HISTORY' })
    await expect(
      tokens.push({
        genesisId: G,
        expectedHead: preview.head,
        expectedRemote: 'origin',
        expectedBranch: 'main',
        acceptFindings: [finding?.id ?? '']
      })
    ).resolves.toEqual({ pushed: 1 })
  })

  it('should_leave_the_repository_untouched_when_the_remote_is_unreachable', async () => {
    const { bare, work } = bareWithClone(join(root, 'reseau'))
    commit(work, { 'a.ts': '1' }, 'feat: a')
    rmSync(bare, { recursive: true, force: true })
    const { sync } = harness(work)
    const head = git(work, ['rev-parse', 'HEAD']).trim()
    const refs = git(work, ['for-each-ref']).trim()
    await expect(sync.fetch(G)).rejects.toMatchObject({ code: expect.stringMatching(/NOT_FOUND|NETWORK|GIT_FAILED/) })
    const preview = await sync.pushPreview(G)
    await expect(
      sync.push({
        genesisId: G,
        expectedHead: preview.head,
        expectedRemote: 'origin',
        expectedBranch: 'main',
        acceptFindings: []
      })
    ).rejects.toMatchObject({ code: expect.stringMatching(/NOT_FOUND|NETWORK|GIT_FAILED/) })
    expect(git(work, ['rev-parse', 'HEAD']).trim()).toBe(head)
    expect(git(work, ['for-each-ref']).trim()).toBe(refs)
  })

  it('should_publish_privately_by_default_without_letting_gh_run_git_and_refuse_a_secret', async () => {
    const work = initRepo(join(root, 'publier', 'mon-projet'))
    commit(work, { 'README.md': '# Fictif\n' }, 'chore: départ')
    // L'adresse renvoyée par gh (simulé) est contrôlée avant d'être reliée.
    const { gh, calls } = fakeGh({ createUrl: 'https://github.com/moi/mon-projet' })
    const { publish, rows } = harness(work, gh, true)
    const preview = await publish.preview(G)
    expect(preview).toMatchObject({ login: 'moi', suggestedName: 'mon-projet', branch: 'main', blocked: false })
    await expect(
      publish.publish({
        genesisId: G,
        name: 'mon-projet',
        description: '',
        visibility: 'public',
        confirmPublic: false,
        expectedHead: preview.head
      })
    ).rejects.toMatchObject({ code: 'PUBLIC_NOT_CONFIRMED' })
    // Push simulé en échec (aucun réseau) : le dépôt reste « créé, pas encore poussé ».
    await expect(
      publish.publish({
        genesisId: G,
        name: 'mon-projet',
        description: 'Projet fictif',
        visibility: 'private',
        confirmPublic: false,
        expectedHead: preview.head
      })
    ).rejects.toMatchObject({ code: 'PUSH_FAILED' })
    expect(calls.find((call) => call[1] === 'create')).toEqual([
      'repo',
      'create',
      'mon-projet',
      '--private',
      '--description=Projet fictif'
    ])
    expect(calls.flat()).not.toContain('--source=.')
    expect(git(work, ['remote', 'get-url', 'origin']).trim()).toBe('https://github.com/moi/mon-projet.git')
    expect(rows.get(G)?.githubRepo).toBe('moi/mon-projet')

    const secret = initRepo(join(root, 'publier', 'secret'))
    commit(secret, { id_ed25519: FAKE_PRIVATE_KEY }, 'chore: clé')
    const blocked = harness(secret, fakeGh().gh).publish
    const refused = await blocked.preview(G)
    expect(refused.blocked).toBe(true)
    await expect(
      blocked.publish({
        genesisId: G,
        name: 'secret',
        description: '',
        visibility: 'private',
        confirmPublic: false,
        expectedHead: refused.head
      })
    ).rejects.toMatchObject({ code: 'SENSITIVE_IN_HISTORY' })
    expect(git(secret, ['remote']).trim()).toBe('')
  })

  it('should_explain_that_gh_is_missing_or_logged_out', async () => {
    const work = initRepo(join(root, 'sans-gh'))
    commit(work, { 'a.ts': '1' }, 'chore: départ')
    const absent = harness(work, { status: async () => ({ installed: false, login: null }), run: async () => ok('') })
    await expect(absent.publish.preview(G)).rejects.toMatchObject({ code: 'GH_MISSING' })
    const loggedOut = harness(work, fakeGh({ login: null }).gh)
    await expect(loggedOut.publish.preview(G)).rejects.toMatchObject({ code: 'GH_NOT_LOGGED_IN' })
  })

  it('should_list_the_commits_arrived_since_the_last_visit_until_marked_as_seen', async () => {
    const { bare, work } = bareWithClone(join(root, 'visite'))
    const { sync, service, rows } = harness(work)
    // Clone : le commit cloné est le dernier vu.
    rows.set(G, { lastSeenCommit: git(work, ['rev-parse', 'HEAD']).trim() })
    expect((await service.status(G)).newSinceVisit).toBe(0)
    const other = join(root, 'visite', 'collegue')
    git(root, ['clone', '-q', bare, other])
    git(other, ['config', 'user.name', 'Collègue Fictif'])
    git(other, ['config', 'user.email', 'collegue@example.invalid'])
    commit(other, { 'c.ts': '1' }, 'feat: c')
    commit(other, { 'd.ts': '1' }, 'feat: d')
    git(other, ['push', '-q', 'origin', 'main'])
    const fetched = await sync.fetch(G)
    expect(fetched.newSinceVisit).toBe(2)
    const updates = await service.updates(G)
    expect(updates.commits.map((entry) => entry.subject)).toEqual(['feat: d', 'feat: c'])
    expect(updates.authors).toHaveLength(1)
    await service.markSeen(G, updates.upstreamHead ?? '')
    expect((await service.updates(G)).commits).toEqual([])
    expect((await service.status(G)).newSinceVisit).toBe(0)
    await expect(service.markSeen(G, 'f'.repeat(40))).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
