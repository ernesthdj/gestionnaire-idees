import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  CloneService,
  PRODUCTION_TRANSPORTS,
  type CloneServiceDeps
} from '../../../src/main/application/reprise/CloneService'
import { checkGitUrl } from '../../../src/shared/reprise/gitUrl'
import { resolveGit } from '../../../src/main/infrastructure/projects/GitCli'
import { launchGit } from '../../../src/main/infrastructure/projects/GitProcess'

const GIT = resolveGit()

describe('lanceur git annulable (spec 020 T027)', () => {
  it('should_stop_a_running_process_and_return_null_when_the_signal_aborts', async () => {
    const controller = new AbortController()
    const started = Date.now()
    const running = launchGit({
      program: process.execPath,
      args: ['-e', 'process.stderr.write("Receiving objects:  5%\\r"); setTimeout(() => {}, 30000)'],
      cwd: tmpdir(),
      env: Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined)),
      signal: controller.signal,
      onStderr: () => controller.abort()
    })
    const result = await running
    expect(result).toMatchObject({ code: null, spawnFailed: false })
    expect(result.stderr).toContain('Receiving objects')
    expect(Date.now() - started).toBeLessThan(10_000)
  })

  it('should_report_a_spawn_failure_when_the_program_does_not_exist', async () => {
    const result = await launchGit({
      program: join(tmpdir(), 'absent-gi', 'git.exe'),
      args: [],
      cwd: tmpdir(),
      env: {},
      signal: new AbortController().signal
    })
    expect(result).toMatchObject({ code: null, spawnFailed: true })
  })
})
const slash = (path: string): string => path.replace(/\\/g, '/')

/**
 * Clone réel (spec 020 T027 / spec 021 T028) sur un dépôt local créé par le test. Le transport `file` étant refusé en
 * production, le test l'autorise par injection et contourne le contrôle d'adresse (`checkUrl`) — un test vérifie que
 * la valeur de production le refuse bien.
 */
describe.skipIf(GIT === null)('clone réel sur un dépôt local (spec 020 T027)', () => {
  let base: string
  let source: string
  let env: Record<string, string>
  let marker: string
  const git = (cwd: string, ...args: string[]): string =>
    execFileSync(GIT ?? 'git', args, { cwd, env, encoding: 'utf8', windowsHide: true }).trim()

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'gi-clone-'))
    // Configuration isolée du poste ; un modèle de dépôt PIÉGÉ : tout clone recevrait un hook `post-checkout`.
    const template = join(base, 'modele')
    mkdirSync(join(template, 'hooks'), { recursive: true })
    marker = join(base, 'hook-execute.txt')
    const hook = join(template, 'hooks', 'post-checkout')
    writeFileSync(hook, `#!/bin/sh\necho piege > "${slash(marker)}"\n`)
    chmodSync(hook, 0o755)
    const globalConfig = join(base, 'gitconfig')
    writeFileSync(globalConfig, `[init]\n\ttemplateDir = ${slash(template)}\n\tdefaultBranch = main\n`)
    env = Object.fromEntries(
      Object.entries({ ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: globalConfig }).filter(
        (entry): entry is [string, string] => entry[1] !== undefined
      )
    )

    source = join(base, 'source')
    mkdirSync(source)
    git(source, 'init', '-q')
    for (const [index, name] of ['a.txt', 'b.txt'].entries()) {
      writeFileSync(join(source, name), `contenu fictif ${index}\n`)
      git(source, 'add', '--', name)
      git(
        source,
        '-c',
        'user.name=Test',
        '-c',
        'user.email=nobody',
        '-c',
        'commit.gpgsign=false',
        'commit',
        '-q',
        '-m',
        `c${index}`
      )
    }
    rmSync(marker, { force: true })
  })
  afterEach(() => rmSync(base, { recursive: true, force: true }))

  const service = (overrides: Partial<CloneServiceDeps> = {}): CloneService =>
    new CloneService({
      git: () => GIT,
      launch: launchGit,
      emptyHooksDir: join(base, 'profil', 'git-empty-hooks'),
      quarantineRoot: join(base, 'profil', 'skill-quarantine'),
      baseEnv: env,
      checkUrl: (url) => ({ ok: true, url, display: 'depot-de-test', host: 'local', hadCredentials: false }),
      transports: ['file'],
      ...overrides
    })

  it('should_clone_one_commit_into_the_quarantine_when_the_profile_is_superficiel', async () => {
    const result = await service().clone({ url: pathToFileURL(source).href, profile: 'superficiel' })
    expect(result).toMatchObject({ ok: true, commit: git(source, 'rev-parse', 'HEAD'), display: 'depot-de-test' })
    if (!result.ok) throw new Error(result.code)
    expect(slash(result.dir).startsWith(slash(join(base, 'profil', 'skill-quarantine')))).toBe(true)
    expect(git(result.dir, 'rev-list', '--count', 'HEAD')).toBe('1')
    expect(existsSync(join(result.dir, 'b.txt'))).toBe(true)
  })

  it('should_clone_a_partial_history_into_the_chosen_folder_when_the_profile_is_historique', async () => {
    const target = join(base, 'choisi', 'projet')
    mkdirSync(join(base, 'choisi'))
    const phases: string[] = []
    const result = await service().clone({
      url: pathToFileURL(source).href,
      profile: 'historique',
      target,
      onProgress: (progress) => phases.push(progress.phase)
    })
    expect(result).toMatchObject({ ok: true, dir: target, commit: git(source, 'rev-parse', 'HEAD') })
    expect(git(target, 'rev-list', '--count', 'HEAD')).toBe('2')
    expect(git(target, 'config', '--get', 'remote.origin.partialclonefilter')).toBe('blob:none')
    expect(phases[0]).toBe('connexion')
  })

  it('should_never_run_a_hook_when_the_machine_template_contains_one', async () => {
    // Témoin : sans le service, le modèle piégé fait bien exécuter le hook.
    git(base, 'clone', '-q', '--', pathToFileURL(source).href, join(base, 'temoin'))
    expect(existsSync(marker)).toBe(true)
    rmSync(marker)

    const result = await service().clone({ url: pathToFileURL(source).href, profile: 'superficiel' })
    expect(result.ok).toBe(true)
    expect(existsSync(marker)).toBe(false)
  })

  it('should_refuse_the_file_transport_when_production_transports_are_used', async () => {
    const result = await service({ transports: PRODUCTION_TRANSPORTS }).clone({
      url: pathToFileURL(source).href,
      profile: 'superficiel'
    })
    expect(result).toMatchObject({ ok: false, code: 'URL_REFUSED' })
    expect(readdirSync(join(base, 'profil', 'skill-quarantine'))).toEqual([])
  })

  it('should_refuse_a_local_address_before_launching_git_when_the_production_check_is_used', async () => {
    const result = await service({ checkUrl: checkGitUrl }).clone({
      url: pathToFileURL(source).href,
      profile: 'superficiel'
    })
    expect(result).toEqual({ ok: false, code: 'URL_REFUSED' })
    expect(existsSync(join(base, 'profil'))).toBe(false)
  })

  it('should_report_not_found_and_leave_nothing_when_the_repository_is_missing', async () => {
    const target = join(base, 'cible')
    const result = await service().clone({
      url: pathToFileURL(join(base, 'absent')).href,
      profile: 'historique',
      target
    })
    expect(result).toMatchObject({ ok: false, code: 'NOT_FOUND' })
    expect(existsSync(target)).toBe(false)
    expect(existsSync(base)).toBe(true)
  })

  it('should_keep_an_existing_folder_untouched_when_the_target_already_exists', async () => {
    const target = join(base, 'existant')
    mkdirSync(target)
    writeFileSync(join(target, 'precieux.txt'), 'à garder')
    const result = await service().clone({ url: pathToFileURL(source).href, profile: 'historique', target })
    expect(result).toMatchObject({ ok: false, code: 'TARGET_EXISTS' })
    expect(existsSync(join(target, 'precieux.txt'))).toBe(true)
  })
})
