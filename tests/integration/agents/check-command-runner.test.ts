import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveCheck, runCheckCommand } from '../../../src/main/infrastructure/process/CheckCommandRunner'

describe('commandes de vérification lancées sans shell (L2-pipeline-optimal D2, T002)', { timeout: 60_000 }, () => {
  let dir = ''
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gi-check-run-'))
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('should_pass_when_the_program_exits_with_zero', async () => {
    expect(await runCheckCommand(dir, 'node -e "process.exit(0)"')).toMatchObject({ ok: true, exitCode: 0, tail: '' })
  })

  it('should_run_npm_through_node_without_a_shell', async () => {
    expect(await runCheckCommand(dir, 'npm --version')).toMatchObject({ ok: true, exitCode: 0 })
  })

  it('should_keep_the_end_of_the_output_when_the_command_fails', async () => {
    const run = await runCheckCommand(dir, 'node -e "console.error(String.fromCharCode(75, 79)), process.exit(3)"')
    expect(run).toMatchObject({ ok: false, exitCode: 3 })
    expect(run.tail).toContain('KO')
  })

  it('should_go_through_node_for_npm_and_refuse_a_path_or_an_unknown_program', () => {
    const npm = resolveCheck('npm test')
    expect('file' in npm && npm.file.toLowerCase().endsWith(process.platform === 'win32' ? 'node.exe' : 'node')).toBe(
      true
    )
    expect('args' in npm && npm.args.at(-1)).toBe('test')
    expect(resolveCheck('./scripts/check.exe')).toMatchObject({ error: expect.stringContaining('sans chemin') })
    expect(resolveCheck('programme-qui-n-existe-pas')).toMatchObject({ error: expect.stringContaining('introuvable') })
    expect(resolveCheck('npm test && curl x')).toMatchObject({ error: expect.stringContaining('shell') })
  })

  it('should_stop_a_command_that_takes_too_long', async () => {
    const run = await runCheckCommand(dir, 'node -e "setInterval(Number, 1000)"', undefined, 300)
    expect(run).toMatchObject({ ok: false, exitCode: null })
    expect(run.tail).toContain('délai dépassé')
  })
})
