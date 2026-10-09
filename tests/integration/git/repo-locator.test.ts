import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { RepoLocator } from '../../../src/main/application/git/RepoLocator'
import { GitRunner } from '../../../src/main/infrastructure/git/GitRunner'
import { GitWriteQueue } from '../../../src/main/infrastructure/git/GitWriteQueue'
import { buildScenario } from '../../support/gitRepos'

describe('dépôt d’un genesis et file d’écriture (spec 021 T009)', () => {
  const root = mkdtempSync(join(tmpdir(), 'gi-repo-locator-'))
  afterAll(() => rmSync(root, { recursive: true, force: true }))
  const dataDir = join(root, 'profil')
  mkdirSync(dataDir, { recursive: true })
  const runner = new GitRunner({ emptyHooksDir: join(dataDir, 'git-empty-hooks') })
  const commands: string[][] = []
  const spy = {
    run: (cwd: string, args: readonly string[], options: Parameters<GitRunner['run']>[2]) => {
      commands.push([...args])
      return runner.run(cwd, args, options)
    }
  }
  const locator = (dir: string | null | undefined, trusted = false): RepoLocator =>
    new RepoLocator({ projectDir: () => dir, isTrusted: () => trusted, runner: spy, dataDir })

  it('should_block_an_untrusted_repo_with_a_risky_config_after_reading_only_its_config', async () => {
    const repo = buildScenario(join(root, 'piege'), 'config-piegee')
    commands.length = 0
    const context = await locator(repo).locate('g')
    expect(context.blocked).toBe(true)
    expect([...context.risky.blocking].sort()).toEqual(['core.sshcommand', 'filter.x.clean'])
    // Seule la lecture de la configuration a été lancée : ni status, ni fetch.
    expect(commands).toEqual([['config', '--local', '--list', '--name-only', '-z']])
    expect(existsSync(join(repo, 'filtre-a-tourne.txt'))).toBe(false)
    expect((await locator(repo, true).locate('g')).blocked).toBe(false)
  })

  it('should_refuse_missing_folders_and_the_app_data_folder', async () => {
    await expect(locator(undefined).locate('g')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(locator(join(root, 'absent')).locate('g')).rejects.toMatchObject({ code: 'DIR_MISSING' })
    await expect(locator(dataDir).locate('g')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(locator(root).locate('g')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('should_report_a_folder_without_repo', async () => {
    const plain = join(root, 'sans-git')
    mkdirSync(plain, { recursive: true })
    expect(await locator(plain).locate('g')).toMatchObject({ gitDir: null, blocked: false })
  })

  it('should_serialize_writes_and_never_remove_a_foreign_index_lock', async () => {
    const repo = buildScenario(join(root, 'file'), 'trois-auteurs')
    const queue = new GitWriteQueue()
    const order: string[] = []
    const slow = (name: string, ms: number) => async (): Promise<string> => {
      order.push(`début ${name}`)
      await new Promise((done) => setTimeout(done, ms))
      order.push(`fin ${name}`)
      return name
    }
    await Promise.all([
      queue.run('g', join(repo, '.git'), slow('a', 40)),
      queue.run('g', join(repo, '.git'), slow('b', 5))
    ])
    expect(order).toEqual(['début a', 'fin a', 'début b', 'fin b'])
    writeFileSync(join(repo, '.git', 'index.lock'), '')
    await expect(queue.run('g', join(repo, '.git'), slow('c', 1))).rejects.toMatchObject({ code: 'BUSY' })
    expect(existsSync(join(repo, '.git', 'index.lock'))).toBe(true)
  })
})
