import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CHECKS, checkArgs, resolveNpm } from '../../../src/main/infrastructure/analyste/NpmCli'

describe('lanceur npm des vérifications (spec 019 T031, research R7)', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'npm-cli-'))
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  const installNode = (dir: string): void => {
    const windows = process.platform === 'win32'
    mkdirSync(join(dir, 'node_modules', 'npm', 'bin'), { recursive: true })
    writeFileSync(join(dir, windows ? 'node.exe' : 'node'), '')
    writeFileSync(join(dir, windows ? 'npm.cmd' : 'npm'), '')
    writeFileSync(join(dir, 'node_modules', 'npm', 'bin', 'npm-cli.js'), '')
  }

  it('should_resolve_node_and_npm_cli_only_from_absolute_path_entries', () => {
    const real = join(root, 'nodejs')
    installNode(real)
    // Un dossier relatif (le dossier courant d'un projet piégé) n'est jamais consulté.
    expect(resolveNpm(['.', 'relatif', real].join(delimiter))).toEqual({
      node: join(real, process.platform === 'win32' ? 'node.exe' : 'node'),
      npmCli: join(real, 'node_modules', 'npm', 'bin', 'npm-cli.js')
    })
    expect(resolveNpm(['.', join(root, 'vide')].join(delimiter))).toBeNull()
  })

  it('should_run_only_the_four_closed_scripts_through_npm_cli', () => {
    const program = { node: 'C:/n/node.exe', npmCli: 'C:/n/npm-cli.js' }
    expect(CHECKS.map((check) => checkArgs(program, check))).toEqual([
      ['C:/n/npm-cli.js', 'run', 'typecheck'],
      ['C:/n/npm-cli.js', 'run', 'lint'],
      ['C:/n/npm-cli.js', 'exec', '--', 'prettier', '--check', 'src', 'tests'],
      ['C:/n/npm-cli.js', 'test']
    ])
  })
})
