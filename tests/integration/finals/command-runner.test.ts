import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveNpm, runCommand } from '../../../src/main/infrastructure/finals/CommandRunner'

describe('lancement d’un script approuvé (spec 013 R9)', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gi-cmd-'))
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('should_return_the_exit_code_and_the_output_of_both_streams', async () => {
    const result = await runCommand({
      command: process.execPath,
      args: ['-e', 'console.log("sortie"); console.error("\\u001b[31merreur\\u001b[0m"); process.exit(3)'],
      cwd: dir
    })
    expect(result).toMatchObject({ exitCode: 3, timedOut: false })
    expect(result.output).toContain('sortie')
    expect(result.output).toContain('erreur')
    expect(result.output).not.toContain('\u001b')
  })

  it('should_stop_a_command_that_exceeds_its_delay', async () => {
    const result = await runCommand({
      command: process.execPath,
      args: ['-e', 'setInterval(() => {}, 1000)'],
      cwd: dir,
      timeoutMs: 300
    })
    expect(result).toMatchObject({ exitCode: null, timedOut: true })
  }, 15_000)

  it('should_never_interpret_shell_characters_in_arguments', async () => {
    const result = await runCommand({
      command: process.execPath,
      args: ['-e', 'console.log(process.argv[1])', 'a && echo PIEGE'],
      cwd: dir
    })
    expect(result.output.trim()).toBe('a && echo PIEGE')
  })

  it('should_report_a_missing_program_without_throwing', async () => {
    const result = await runCommand({ command: join(dir, 'absent.exe'), args: [], cwd: dir })
    expect(result.exitCode).toBeNull()
    expect(result.output).toContain('Lancement impossible')
  })

  it('should_run_an_npm_script_through_node_and_npm_cli_without_a_shell', async () => {
    const npm = resolveNpm()
    if (npm === null) return
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'essai', scripts: { hello: 'node -e "console.log(42)"' } })
    )
    const result = await runCommand({ command: npm.node, args: [npm.cli, 'run', 'hello'], cwd: dir })
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('42')
  }, 30_000)

  it('should_find_nothing_in_an_empty_path', () => {
    expect(resolveNpm('')).toBeNull()
  })
})
