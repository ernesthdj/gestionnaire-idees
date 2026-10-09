import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { GitRunner } from '../../../src/main/infrastructure/git/GitRunner'
import { resolveProgram, runProcess } from '../../../src/main/infrastructure/process/ProcessRunner'
import { buildScenario, git } from '../../support/gitRepos'

describe('exécuteur de processus et de git (spec 021 T008)', () => {
  const root = mkdtempSync(join(tmpdir(), 'gi-git-runner-'))
  afterAll(() => rmSync(root, { recursive: true, force: true }))
  const runner = new GitRunner({ emptyHooksDir: join(root, 'profil', 'git-empty-hooks') })
  const node = process.execPath

  it('should_pass_stdin_bound_the_output_and_report_truncation', async () => {
    const echo = await runProcess({
      program: node,
      args: ['-e', 'process.stdin.pipe(process.stdout)'],
      cwd: root,
      env: process.env as Record<string, string>,
      stdin: 'message par stdin',
      timeoutMs: 10_000
    })
    expect(echo).toMatchObject({ code: 0, stdout: 'message par stdin', truncated: false })
    const big = await runProcess({
      program: node,
      args: ['-e', 'process.stdout.write("x".repeat(100000))'],
      cwd: root,
      env: process.env as Record<string, string>,
      timeoutMs: 10_000,
      maxOutput: 1_000
    })
    expect(big.stdout).toHaveLength(1_000)
    expect(big.truncated).toBe(true)
  })

  it('should_stop_on_timeout_and_on_abort', async () => {
    const slow = {
      program: node,
      args: ['-e', 'setTimeout(() => {}, 20000)'],
      cwd: root,
      env: process.env as Record<string, string>
    }
    expect(await runProcess({ ...slow, timeoutMs: 200 })).toMatchObject({ code: null, timedOut: true })
    const controller = new AbortController()
    const pending = runProcess({ ...slow, timeoutMs: 20_000, signal: controller.signal })
    controller.abort()
    expect(await pending).toMatchObject({ code: null, timedOut: false })
  })

  it('should_ignore_a_program_planted_in_a_relative_path_dir', () => {
    const trap = join(root, 'piege')
    mkdirSync(trap, { recursive: true })
    writeFileSync(join(trap, process.platform === 'win32' ? 'git.exe' : 'git'), 'piège')
    expect(resolveProgram('git', ['piege', '.', ''].join(process.platform === 'win32' ? ';' : ':'))).toBeNull()
  })

  it('should_never_run_hooks_of_an_untrusted_repo_and_run_them_when_trusted', async () => {
    const repo = buildScenario(join(root, 'hook'), 'hook-temoin')
    writeFileSync(join(repo, 'a.txt'), 'a')
    git(repo, ['add', '--', 'a.txt'])
    const untrusted = await runner.run(repo, ['commit', '-F', '-'], { trusted: false, stdin: 'feat: a' })
    expect(untrusted.code).toBe(0)
    expect(existsSync(join(repo, 'hook-a-tourne.txt'))).toBe(false)
    writeFileSync(join(repo, 'b.txt'), 'b')
    git(repo, ['add', '--', 'b.txt'])
    const trusted = await runner.run(repo, ['commit', '-F', '-'], { trusted: true, stdin: 'feat: b' })
    expect(trusted.code).toBe(0)
    expect(existsSync(join(repo, 'hook-a-tourne.txt'))).toBe(true)
    // Message lu sur stdin, tel quel.
    expect(git(repo, ['log', '-1', '--format=%s']).trim()).toBe('feat: b')
  })

  it('should_cut_hooks_on_a_pr_branch_even_when_trusted', async () => {
    const repo = buildScenario(join(root, 'hook-pr'), 'hook-temoin')
    writeFileSync(join(repo, 'c.txt'), 'c')
    git(repo, ['add', '--', 'c.txt'])
    await runner.run(repo, ['commit', '-F', '-'], { trusted: true, onPrBranch: true, stdin: 'feat: c' })
    expect(existsSync(join(repo, 'hook-a-tourne.txt'))).toBe(false)
  })

  it('should_refuse_a_forbidden_command_before_launching_anything', async () => {
    await expect(runner.run(root, ['reset', '--hard'], { trusted: true })).rejects.toThrow()
  })
})
