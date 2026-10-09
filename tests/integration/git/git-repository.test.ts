import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type DatabaseHandle } from '../../../src/main/infrastructure/db/client'
import { GitRepository } from '../../../src/main/infrastructure/db/repositories/GitRepository'
import { neurons } from '../../../src/main/infrastructure/db/schemaNeurons'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')
const G = '00000000-0000-4000-8000-000000000a21'

describe('données git de l’app (spec 021 T011)', () => {
  let dir: string
  let handle: DatabaseHandle
  let repository: GitRepository

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gi-git-db-'))
    handle = openDatabase({ file: join(dir, 'g.db'), key: '9'.repeat(64), migrationsFolder: MIGRATIONS })
    handle.db.insert(neurons).values({ id: G, rootId: G, kind: 'root', title: 'Projet', origin: 'user' }).run()
    repository = new GitRepository(handle.db)
  })
  afterEach(() => {
    handle.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('should_save_a_repo_and_refuse_an_address_with_a_credential', () => {
    repository.saveRepo(G, { defaultRemote: 'origin', remoteUrl: 'https://github.com/o/n.git', githubRepo: 'o/n' })
    repository.saveRepo(G, { lastSeenCommit: 'a'.repeat(40) })
    expect(repository.repo(G)).toMatchObject({ githubRepo: 'o/n', lastSeenCommit: 'a'.repeat(40), cloned: false })
    for (const url of ['https://jeton@github.com/o/n.git', 'https://nom:secret@github.com/o/n.git']) {
      expect(() => repository.saveRepo(G, { remoteUrl: url })).toThrow(/identifiant/)
    }
    expect(repository.repo(G)?.remoteUrl).toBe('https://github.com/o/n.git')
  })

  it('should_journal_operations_without_content_and_shorten_hashes', () => {
    const at = '2026-10-09T10:00:00.000Z'
    repository.logOperation({
      genesisId: G,
      kind: 'commit',
      status: 'ok',
      commitHash: 'a1b2c3d4e5f6',
      branch: 'main',
      count: 2,
      startedAt: at,
      finishedAt: at
    })
    repository.logOperation({
      genesisId: G,
      kind: 'push',
      status: 'failed',
      errorCode: 'NON_FAST_FORWARD',
      remote: 'origin',
      startedAt: at,
      finishedAt: at
    })
    const [first, second] = repository.operations(G)
    expect([first?.kind, second?.kind].sort()).toEqual(['commit', 'push'])
    expect(repository.operations(G).find((row) => row.kind === 'commit')?.commitHash).toBe('a1b2c3d')
    expect(() =>
      repository.logOperation({
        genesisId: G,
        kind: 'commit',
        status: 'ok',
        commitHash: 'pas-une-empreinte',
        startedAt: at,
        finishedAt: at
      })
    ).toThrow()
  })

  it('should_track_running_clones_for_cleanup', () => {
    repository.addRunningClone({ id: 'c1', targetDir: join(dir, 'clone'), profile: 'historique' })
    expect(repository.runningClones().map((row) => row.id)).toEqual(['c1'])
    repository.removeRunningClone('c1')
    expect(repository.runningClones()).toEqual([])
  })
})
