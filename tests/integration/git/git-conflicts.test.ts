import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { reviewConflict } from '../../../src/main/application/ai/GitConflictTask'
import { ConflictService } from '../../../src/main/application/git/ConflictService'
import { GitAccess } from '../../../src/main/application/git/GitAccess'
import { GitService } from '../../../src/main/application/git/GitService'
import { RepoLocator } from '../../../src/main/application/git/RepoLocator'
import { SyncService } from '../../../src/main/application/git/SyncService'
import { openDatabase } from '../../../src/main/infrastructure/db/client'
import { GitRepository } from '../../../src/main/infrastructure/db/repositories/GitRepository'
import { NeuronRepository } from '../../../src/main/infrastructure/db/repositories/NeuronRepository'
import { GitRunner } from '../../../src/main/infrastructure/git/GitRunner'
import { GitWriteQueue } from '../../../src/main/infrastructure/git/GitWriteQueue'
import { buildScenario, git } from '../../support/gitRepos'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')
const root = mkdtempSync(join(tmpdir(), 'gi-git-conflicts-'))
const dataDir = join(root, 'profil')
mkdirSync(dataDir, { recursive: true })

/** Claude simulé : renvoie ce qu'on lui dit, relu comme en production. */
function harness(dir: string, options: { localOnly?: boolean; proposal?: string } = {}) {
  const handle = openDatabase({
    file: join(root, `${randomUUID()}.db`),
    key: 'b'.repeat(64),
    migrationsFolder: MIGRATIONS
  })
  const genesisId = randomUUID()
  new NeuronRepository(handle.db).insertRoot({
    id: genesisId,
    title: 'Projet',
    content: null,
    nature: 'action',
    natureSource: null
  })
  const gitRepository = new GitRepository(handle.db)
  const runner = new GitRunner({ emptyHooksDir: join(dataDir, 'git-empty-hooks'), allowLocalTransportForTests: true })
  const locator = new RepoLocator({ projectDir: () => dir, isTrusted: () => false, runner, dataDir })
  const queue = new GitWriteQueue()
  const service = new GitService({
    locator,
    runner,
    queue,
    repository: gitRepository,
    authorSecret: () => 's',
    changed: () => undefined
  })
  const access = new GitAccess({ locator, runner, repository: gitRepository })
  const sync = new SyncService({
    access,
    queue,
    repository: gitRepository,
    gh: {
      status: async () => ({ installed: false, login: null }),
      run: async () => {
        throw new Error('gh interdit')
      }
    },
    status: (id) => service.status(id),
    changed: () => undefined,
    openMerge: (id, mergeHead, head) => {
      gitRepository.openMergeSession({ genesisId: id, mergeHead, head })
    }
  })
  const asked: string[] = []
  const conflicts = new ConflictService({
    access,
    queue,
    repository: gitRepository,
    status: (id) => service.status(id),
    changed: () => undefined,
    localOnly: () => options.localOnly === true,
    propose: async (input, indexes) => {
      asked.push(input)
      return reviewConflict(
        {
          hunks: [
            {
              index: 0,
              text: '<<<<<<< piège\nexport const liste = []',
              explanation: 'x',
              risk: '',
              confidence: 'check'
            },
            {
              index: 0,
              text: options.proposal ?? 'export const liste = [0, 1, 2, 3, 4]',
              explanation: 'Garde le 0 et le 4.',
              risk: '',
              confidence: 'sure'
            }
          ]
        },
        indexes
      )
    }
  })
  return { genesisId, sync, conflicts, service, gitRepository, asked, close: () => handle.close() }
}

/** Fusion lancée par l'app sur le scénario `conflit` (deux côtés ont modifié `src/liste.ts` et `logo.png`). */
async function conflicted(name: string, options: Parameters<typeof harness>[1] = {}) {
  const work = buildScenario(join(root, name), 'conflit')
  const h = harness(work, options)
  await h.sync.fetch(h.genesisId)
  const pulled = await h.sync.pull(h.genesisId)
  expect(pulled.result).toBe('diverged')
  const merged = await h.sync.merge(h.genesisId, pulled.upstreamHead ?? '')
  expect(merged.result).toBe('conflicts')
  return { work, ...h }
}

describe('résoudre un conflit avec Claude (spec 021 US4, T034–T037)', { timeout: 60_000 }, () => {
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  it('should_resolve_block_by_block_reject_a_proposal_with_markers_and_finish_on_click', async () => {
    const { work, genesisId, conflicts, service, gitRepository, asked, close } = await conflicted('resoudre')
    expect((await service.status(genesisId)).operation).toBe('merge')
    const state = await conflicts.mergeState(genesisId)
    expect(state.files).toEqual([
      { path: 'logo.png', kind: 'binary', state: 'unresolved' },
      { path: 'src/liste.ts', kind: 'content', state: 'unresolved' }
    ])
    const file = await conflicts.file(genesisId, 'src/liste.ts')
    expect(file.hunks.map((hunk) => [hunk.ours, hunk.theirs])).toEqual([
      ['export const liste = [0, 1, 2, 3]', 'export const liste = [1, 2, 3, 4]']
    ])
    // La proposition contenant un marqueur est rejetée ; la seconde (sans marqueur) est gardée.
    const proposed = await conflicts.propose(genesisId, 'src/liste.ts')
    expect(proposed.hunks[0]?.proposal?.text).toBe('export const liste = [0, 1, 2, 3, 4]')
    expect(asked[0]).toContain('<la_leur>')
    await expect(conflicts.finish(genesisId, undefined)).rejects.toMatchObject({ code: 'UNRESOLVED_FILES' })
    await expect(conflicts.resolveFile(genesisId, 'src/liste.ts', proposed.previewHash)).rejects.toMatchObject({
      code: 'UNDECIDED_HUNKS'
    })
    const decided = await conflicts.decide({ genesisId, path: 'src/liste.ts', hunkIndex: 0, choice: 'claude' })
    await expect(conflicts.resolveFile(genesisId, 'src/liste.ts', proposed.previewHash)).rejects.toMatchObject({
      code: 'STALE'
    })
    await conflicts.resolveFile(genesisId, 'src/liste.ts', decided.previewHash)
    const afterBinary = await conflicts.wholeFile(genesisId, 'logo.png', 'theirs')
    expect(afterBinary.files.every((entry) => entry.state === 'resolved')).toBe(true)

    const session = gitRepository.openSession(genesisId)
    const { hash } = await conflicts.finish(genesisId, undefined)
    expect(git(work, ['log', '-1', '--format=%P']).trim().split(' ')).toHaveLength(2)
    expect(git(work, ['rev-parse', 'HEAD']).trim()).toBe(hash)
    expect(readFileSync(join(work, 'src', 'liste.ts'), 'utf8')).toBe('export const liste = [0, 1, 2, 3, 4]\n')
    // Le code des collègues ne reste pas en base.
    expect(gitRepository.hunks(session?.id ?? '', 'src/liste.ts')).toEqual([])
    expect(gitRepository.openSession(genesisId)).toBeUndefined()
    close()
  })

  it('should_bring_back_the_exact_state_when_aborted', async () => {
    const { work, genesisId, conflicts, close } = await conflicted('abandon')
    const before = git(work, ['rev-parse', 'HEAD^{tree}']).trim()
    await conflicts.decide({ genesisId, path: 'src/liste.ts', hunkIndex: 0, choice: 'ours' })
    const status = await conflicts.abort(genesisId)
    expect(status.operation).toBe('none')
    expect(existsSync(join(work, '.git', 'MERGE_HEAD'))).toBe(false)
    // Vu par l'app, avec la configuration git du poste (fins de ligne comprises) : rien de modifié.
    expect(status.files).toEqual([])
    expect(git(work, ['rev-parse', 'HEAD^{tree}']).trim()).toBe(before)
    await expect(conflicts.mergeState(genesisId)).rejects.toMatchObject({ code: 'NO_MERGE' })
    close()
  })

  it('should_send_nothing_to_claude_for_a_local_only_project_and_lose_a_merge_aborted_in_a_terminal', async () => {
    const { work, genesisId, conflicts, gitRepository, asked, close } = await conflicted('local', { localOnly: true })
    await expect(conflicts.propose(genesisId, 'src/liste.ts')).rejects.toMatchObject({ code: 'LOCAL_ONLY' })
    expect(asked).toEqual([])
    git(work, ['merge', '--abort'])
    await expect(conflicts.mergeState(genesisId)).rejects.toMatchObject({ code: 'NO_MERGE' })
    expect(gitRepository.openSession(genesisId)).toBeUndefined()
    close()
  })
})
