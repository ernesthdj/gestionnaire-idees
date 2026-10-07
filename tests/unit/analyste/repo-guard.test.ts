import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { HMAC_SECRET, RepoGuard, type RepoGuardDeps } from '../../../src/main/application/analyste/RepoGuard'

describe('garde du dépôt source de l’Analyste', () => {
  let root: string
  let repo: string
  let stored: string | null
  let secrets: Map<string, string>

  const makeRepo = (dir: string, name = 'gestionnaire-idees'): void => {
    mkdirSync(join(dir, 'src', 'main'), { recursive: true })
    writeFileSync(join(dir, 'src', 'main', 'bootstrap.ts'), '')
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name }))
  }

  const guard = (overrides: Partial<RepoGuardDeps> = {}): RepoGuard =>
    new RepoGuard({
      isPackaged: false,
      appPath: repo,
      // git simulé : chaque dossier qui contient package.json est la racine de son propre dépôt.
      git: async (cwd) => ({ code: 0, output: cwd }),
      storedRepo: () => stored,
      storeRepo: (path) => {
        stored = path
      },
      secrets: {
        get: (name) => secrets.get(name) ?? null,
        getOrCreateRandomKey: (name) => {
          if (!secrets.has(name)) secrets.set(name, 'k'.repeat(64))
          return secrets.get(name) ?? ''
        }
      },
      ...overrides
    })

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gi-repo-guard-'))
    repo = join(root, 'brainstormer')
    makeRepo(repo)
    stored = null
    secrets = new Map()
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('should_be_unavailable_and_refuse_designation_when_the_app_is_packaged', async () => {
    const g = guard({ isPackaged: true })
    expect(g.current()).toMatchObject({ available: false, active: false, reason: 'PACKAGED_APP' })
    await expect(g.designate(repo)).rejects.toMatchObject({ code: 'PACKAGED_APP' })
    expect(g.hmacKey()).toBeNull()
  })

  it('should_activate_and_create_the_key_when_the_folder_is_the_running_brainstormer_repository', async () => {
    const state = await guard().designate(repo)
    expect(state).toMatchObject({ available: true, active: true, reason: null })
    expect(stored).not.toBeNull()
    expect(secrets.has(HMAC_SECRET)).toBe(true)
  })

  it('should_refuse_when_the_folder_is_not_the_brainstormer_repository', async () => {
    const other = join(root, 'other')
    makeRepo(other, 'another-app')
    await expect(guard().designate(other)).rejects.toMatchObject({ code: 'NOT_BRAINSTORMER_REPO' })
    expect(stored).toBeNull()
  })

  it('should_refuse_when_the_folder_is_not_the_root_of_a_git_repository', async () => {
    const g = guard({ git: async () => ({ code: 128, output: 'fatal: not a git repository' }) })
    await expect(g.designate(repo)).rejects.toMatchObject({ code: 'NOT_BRAINSTORMER_REPO' })
  })

  it('should_refuse_when_the_app_does_not_run_from_this_repository', async () => {
    const copy = join(root, 'copy')
    makeRepo(copy)
    await expect(guard().designate(copy)).rejects.toMatchObject({ code: 'NOT_RUNNING_FROM_REPO' })
  })

  it('should_pause_the_probe_when_the_designated_repository_has_moved', async () => {
    const g = guard()
    await g.designate(repo)
    rmSync(repo, { recursive: true, force: true })
    expect(await g.check()).toMatchObject({ active: false, reason: 'REPO_MOVED' })
    expect(g.hmacKey()).toBeNull()
  })

  it('should_resume_when_the_check_passes_again_at_startup', async () => {
    await guard().designate(repo)
    const restarted = guard()
    expect(restarted.current().active).toBe(false)
    expect(await restarted.check()).toMatchObject({ active: true, reason: null })
    expect(restarted.hmacKey()).toBe('k'.repeat(64))
  })
})
