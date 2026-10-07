import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  CLONE_TIMEOUTS_MS,
  CloneService,
  MemoryCloneRegistry,
  PRODUCTION_TRANSPORTS,
  classifyCloneFailure,
  cloneArgs,
  cloneEnv,
  parseCloneProgress,
  type CloneServiceDeps
} from '../../../src/main/application/reprise/CloneService'
import type { GitProcessRequest, GitProcessResult } from '../../../src/main/infrastructure/projects/GitProcess'

const HEAD = 'a'.repeat(40)
const URL = 'https://github.com/exemple/projet.git'
const ok = (stdout = ''): GitProcessResult => ({ code: 0, stdout, stderr: '', spawnFailed: false })
const failed = (stderr: string): GitProcessResult => ({ code: 128, stdout: '', stderr, spawnFailed: false })
const targetOf = (request: GitProcessRequest): string => request.args[request.args.length - 1] ?? ''
const isClone = (request: GitProcessRequest): boolean => request.args.includes('clone')

describe('service de clone, processus simulé (spec 020 T027 / spec 021 T028)', () => {
  let base: string
  let requests: GitProcessRequest[]

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'gi-clone-sim-'))
    requests = []
  })
  afterEach(() => rmSync(base, { recursive: true, force: true }))

  /** `onClone` simule git : crée (ou non) la cible, puis renvoie un résultat. */
  const service = (
    onClone: (request: GitProcessRequest) => Promise<GitProcessResult> | GitProcessResult,
    overrides: Partial<CloneServiceDeps> = {}
  ): CloneService =>
    new CloneService({
      git: () => join(base, 'git.exe'),
      launch: async (request) => {
        requests.push(request)
        return isClone(request) ? onClone(request) : ok(`${HEAD}\n`)
      },
      emptyHooksDir: join(base, 'profil', 'git-empty-hooks'),
      quarantineRoot: join(base, 'profil', 'skill-quarantine'),
      baseEnv: { PATH: 'x' },
      newId: () => 'clone-1',
      ...overrides
    })

  const partialClone = (request: GitProcessRequest): void => {
    mkdirSync(targetOf(request), { recursive: true })
    writeFileSync(join(targetOf(request), 'moitie.pack'), 'x')
  }

  it('should_build_fixed_arguments_with_double_dash_before_the_address_when_cloning', async () => {
    const result = await service((request) => {
      partialClone(request)
      return ok()
    }).clone({ url: 'https://quelquun:jeton-fictif@github.com/exemple/projet.git', profile: 'superficiel' })

    expect(result).toMatchObject({ ok: true, commit: HEAD, display: 'https://github.com/exemple/projet.git' })
    const [clone, head] = requests
    if (clone === undefined || head === undefined) throw new Error('deux appels attendus')
    const hooks = join(base, 'profil', 'git-empty-hooks')
    const target = join(base, 'profil', 'skill-quarantine', 'clone-1')
    expect(clone.program).toBe(join(base, 'git.exe'))
    expect(clone.args).toEqual([
      ...['-c', `core.hooksPath=${hooks}`, '-c', 'core.fsmonitor=false', '-c', 'core.quotepath=off'],
      ...['-c', 'color.ui=never', '-c', 'core.pager=cat', '-c', 'core.editor=false', '-c', 'protocol.allow=never'],
      ...['-c', 'protocol.https.allow=always', '-c', 'protocol.ssh.allow=always'],
      ...['clone', '--no-recurse-submodules', '--progress', '--depth', '1', '--single-branch'],
      ...['--', 'https://quelquun:jeton-fictif@github.com/exemple/projet.git', target]
    ])
    expect(clone.cwd).toBe(join(base, 'profil', 'skill-quarantine'))
    expect(clone.env).toMatchObject({ GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C', GIT_ALLOW_PROTOCOL: 'https:ssh' })
    expect(head.args.slice(-4)).toEqual(['-C', target, 'rev-parse', 'HEAD'])
    expect(readdirSync(hooks)).toEqual([])
  })

  it('should_use_the_partial_filter_or_nothing_when_the_profile_is_historique', () => {
    const input = { hooksDir: 'h', transports: PRODUCTION_TRANSPORTS, url: URL, target: 't' }
    expect(cloneArgs({ ...input, profile: 'historique', full: false })).toContain('--filter=blob:none')
    const full = cloneArgs({ ...input, profile: 'historique', full: true })
    expect(full).not.toContain('--filter=blob:none')
    expect(full).not.toContain('--depth')
    expect(full.slice(-3)).toEqual(['--', URL, 't'])
  })

  it('should_keep_production_values_when_nothing_is_injected', () => {
    expect(PRODUCTION_TRANSPORTS).toEqual(['https', 'ssh'])
    expect(CLONE_TIMEOUTS_MS).toEqual({ superficiel: 300_000, historique: 1_800_000 })
    expect(
      () =>
        new CloneService({
          git: () => null,
          launch: async () => ok(),
          emptyHooksDir: 'h',
          quarantineRoot: 'q',
          transports: ['ext;x']
        })
    ).toThrow()
  })

  it('should_drop_inherited_git_variables_but_keep_machine_config_when_building_the_environment', () => {
    const env = cloneEnv(
      {
        PATH: 'p',
        GIT_DIR: 'piege',
        git_work_tree: 'piege',
        GIT_ALLOW_PROTOCOL: 'ext',
        GIT_CONFIG_PARAMETERS: "'core.hookspath'='x'",
        GIT_ASKPASS: 'invite',
        GIT_SSH_COMMAND: 'ssh -i cle',
        GIT_CONFIG_GLOBAL: 'cfg',
        lc_all: 'fr_FR',
        VIDE: undefined
      },
      ['https', 'ssh']
    )
    expect(env).toEqual({
      PATH: 'p',
      GIT_SSH_COMMAND: 'ssh -i cle',
      GIT_CONFIG_GLOBAL: 'cfg',
      GIT_TERMINAL_PROMPT: '0',
      LC_ALL: 'C',
      GIT_LFS_SKIP_SMUDGE: '1',
      GIT_ALLOW_PROTOCOL: 'https:ssh'
    })
  })

  it('should_refuse_without_launching_when_the_address_is_hostile', async () => {
    for (const url of ['ext::sh -c calc', '--upload-pack=calc', 'file:///C:/x', 'ssh://git@github.com/a/b']) {
      expect(await service(() => ok()).clone({ url, profile: 'superficiel' })).toEqual({
        ok: false,
        code: 'URL_REFUSED'
      })
    }
    expect(requests).toEqual([])
  })

  it('should_report_git_missing_when_git_is_absent_or_cannot_start', async () => {
    expect(await service(() => ok(), { git: () => null }).clone({ url: URL, profile: 'superficiel' })).toMatchObject({
      ok: false,
      code: 'GIT_MISSING'
    })
    expect(requests).toEqual([])
    const spawnFailure = await service(() => ({ code: null, stdout: '', stderr: '', spawnFailed: true })).clone({
      url: URL,
      profile: 'superficiel'
    })
    expect(spawnFailure).toMatchObject({ ok: false, code: 'GIT_MISSING' })
  })

  it('should_classify_failures_and_remove_the_created_folder_when_git_fails', async () => {
    const cases: [string, string][] = [
      ["remote: Repository not found.\nfatal: repository 'https://github.com/x/y.git/' not found", 'NOT_FOUND'],
      ["fatal: could not read Username for 'https://github.com': terminal prompts disabled", 'AUTH_FAILED'],
      ['git@github.com: Permission denied (publickey).', 'AUTH_FAILED'],
      ["fatal: unable to access 'https://x/': The requested URL returned error: 403", 'AUTH_FAILED'],
      ["fatal: unable to access 'https://x/': Could not resolve host: x", 'NETWORK'],
      ['fatal: the remote end hung up unexpectedly\nfatal: early EOF', 'NETWORK'],
      ['fatal: write error: No space left on device', 'DISK_FULL'],
      ["error: invalid path 'aux.js'\nfatal: unable to checkout working tree", 'INVALID_PATH'],
      ["fatal: transport 'ext' not allowed", 'URL_REFUSED'],
      ['fatal: quelque chose d’inattendu', 'FAILED']
    ]
    for (const [stderr, code] of cases) {
      expect(classifyCloneFailure(stderr), stderr).toBe(code)
      requests = []
      const target = join(base, `cible-${code}-${requests.length}`)
      rmSync(target, { recursive: true, force: true })
      const result = await service((request) => {
        partialClone(request)
        return failed(stderr)
      }).clone({ url: URL, profile: 'historique', target })
      expect(result, stderr).toEqual({ ok: false, code, display: URL })
      expect(existsSync(target), stderr).toBe(false)
    }
    expect(existsSync(base)).toBe(true)
  })

  it('should_never_return_git_output_when_it_contains_the_address_with_credentials', async () => {
    const result = await service((request) => {
      partialClone(request)
      return failed("fatal: unable to access 'https://quelquun:jeton-fictif@github.com/x/': SSL certificate problem")
    }).clone({ url: 'https://quelquun:jeton-fictif@github.com/x/y.git', profile: 'superficiel' })
    expect(result).toEqual({ ok: false, code: 'NETWORK', display: 'https://github.com/x/y.git' })
    expect(JSON.stringify(result)).not.toContain('jeton')
  })

  it('should_stop_git_and_remove_only_the_created_folder_when_mentalyas_cancels', async () => {
    const parent = join(base, 'parent')
    mkdirSync(parent)
    writeFileSync(join(parent, 'voisin.txt'), 'à garder')
    const controller = new AbortController()
    let sawAbort = false
    const running = service(
      (request) =>
        new Promise<GitProcessResult>((resolve) => {
          partialClone(request)
          request.signal.addEventListener('abort', () => {
            sawAbort = true
            resolve({ code: null, stdout: '', stderr: '', spawnFailed: false })
          })
          setTimeout(() => controller.abort(), 10)
        })
    ).clone({ url: URL, profile: 'historique', target: join(parent, 'projet'), signal: controller.signal })

    expect(await running).toEqual({ ok: false, code: 'CANCELLED', display: URL })
    expect(sawAbort).toBe(true)
    expect(existsSync(join(parent, 'projet'))).toBe(false)
    expect(readdirSync(parent)).toEqual(['voisin.txt'])
  })

  it('should_not_launch_when_the_signal_is_already_aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    expect(
      await service(() => ok()).clone({ url: URL, profile: 'superficiel', signal: controller.signal })
    ).toMatchObject({
      code: 'CANCELLED'
    })
    expect(requests).toEqual([])
  })

  it('should_stop_and_clean_up_when_the_delay_expires', async () => {
    const result = await service(
      (request) =>
        new Promise<GitProcessResult>((resolve) => {
          partialClone(request)
          request.signal.addEventListener('abort', () =>
            resolve({ code: null, stdout: '', stderr: '', spawnFailed: false })
          )
        }),
      { timeoutsMs: { superficiel: 20 } }
    ).clone({ url: URL, profile: 'superficiel' })
    expect(result).toMatchObject({ ok: false, code: 'TIMEOUT' })
    expect(readdirSync(join(base, 'profil', 'skill-quarantine'))).toEqual([])
  })

  it('should_refuse_a_second_clone_when_one_is_running', async () => {
    let release: () => void = () => undefined
    const clones = service(
      (request) =>
        new Promise<GitProcessResult>((resolve) => {
          partialClone(request)
          release = () => resolve(ok())
        }),
      {
        newId: (() => {
          let n = 0
          return () => `clone-${++n}`
        })()
      }
    )
    const first = clones.clone({ url: URL, profile: 'superficiel' })
    expect(clones.busy).toBe(true)
    expect(await clones.clone({ url: URL, profile: 'historique', target: join(base, 'autre') })).toMatchObject({
      ok: false,
      code: 'BUSY'
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    release()
    expect(await first).toMatchObject({ ok: true })
    expect(clones.busy).toBe(false)
  })

  it('should_refuse_a_target_when_it_is_relative_a_root_or_without_parent', async () => {
    const clones = service(() => ok())
    for (const target of [undefined, 'relatif/projet', join(base, 'absent', 'projet'), join(base, '..').slice(0, 3)]) {
      expect(
        await clones.clone({ url: URL, profile: 'historique', ...(target === undefined ? {} : { target }) }),
        String(target)
      ).toMatchObject({
        ok: false,
        code: 'TARGET_REFUSED'
      })
    }
    expect(requests).toEqual([])
  })

  it('should_refuse_to_clone_when_the_empty_hooks_folder_is_not_empty', async () => {
    mkdirSync(join(base, 'profil', 'git-empty-hooks'), { recursive: true })
    writeFileSync(join(base, 'profil', 'git-empty-hooks', 'post-checkout'), '#!/bin/sh\n')
    expect(await service(() => ok()).clone({ url: URL, profile: 'superficiel' })).toMatchObject({
      ok: false,
      code: 'FAILED'
    })
    expect(requests).toEqual([])
  })

  it('should_refuse_and_delete_a_shallow_clone_when_it_exceeds_the_limits', async () => {
    const result = await service(
      (request) => {
        mkdirSync(join(targetOf(request), 'skills'), { recursive: true })
        for (const name of ['a', 'b', 'c']) writeFileSync(join(targetOf(request), 'skills', name), 'x')
        return ok()
      },
      { shallowLimits: { bytes: 1_000, files: 2 } }
    ).clone({ url: URL, profile: 'superficiel' })
    expect(result).toMatchObject({ ok: false, code: 'TOO_LARGE' })
    expect(readdirSync(join(base, 'profil', 'skill-quarantine'))).toEqual([])
  })

  it('should_register_the_target_before_launching_and_forget_it_after', async () => {
    const registry = new MemoryCloneRegistry()
    let registeredDuringClone: unknown = null
    await service(
      (request) => {
        registeredDuringClone = registry.list()
        partialClone(request)
        return ok()
      },
      { registry }
    ).clone({ url: URL, profile: 'superficiel' })
    expect(registeredDuringClone).toEqual([
      { id: 'clone-1', target: join(base, 'profil', 'skill-quarantine', 'clone-1') }
    ])
    expect(registry.list()).toEqual([])
  })

  it('should_remove_orphan_quarantines_and_registered_targets_when_the_app_starts', async () => {
    const quarantine = join(base, 'profil', 'skill-quarantine')
    mkdirSync(join(quarantine, 'ancien-1', '.git'), { recursive: true })
    writeFileSync(join(quarantine, 'ancien-1', 'SKILL.md'), 'x')
    mkdirSync(join(quarantine, 'ancien-2'))
    const interrupted = join(base, 'projets', 'clone-interrompu')
    mkdirSync(interrupted, { recursive: true })
    writeFileSync(join(base, 'projets', 'voisin.txt'), 'à garder')
    const registry = new MemoryCloneRegistry()
    registry.add({ id: 'r1', target: interrupted })
    registry.add({ id: 'r2', target: 'relatif' })
    registry.add({ id: 'r3', target: quarantine })

    const report = await service(() => ok(), { registry }).cleanupOrphans()
    expect(report).toEqual({ removed: 3, leftovers: [] })
    expect(readdirSync(quarantine)).toEqual([])
    expect(readdirSync(join(base, 'projets'))).toEqual(['voisin.txt'])
    expect(registry.list()).toEqual([])
  })

  it('should_parse_progress_lines_when_git_reports_them', () => {
    expect(parseCloneProgress("Cloning into 'projet'...\n")).toEqual({ phase: 'connexion' })
    expect(
      parseCloneProgress('Receiving objects:  10% (1/10)\rReceiving objects:  42% (420/1000), 1.50 MiB | 2.00 MiB/s\r')
    ).toEqual({
      phase: 'reception',
      percent: 42,
      receivedBytes: 1_572_864
    })
    expect(parseCloneProgress('Resolving deltas: 100% (5/5), done.\n')).toEqual({ phase: 'resolution', percent: 100 })
    expect(parseCloneProgress('Updating files:  30% (3/10)\r')).toEqual({ phase: 'extraction', percent: 30 })
    expect(parseCloneProgress('warning: rien\n')).toBeNull()
  })
})
