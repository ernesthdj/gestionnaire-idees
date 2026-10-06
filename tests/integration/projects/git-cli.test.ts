import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveGit } from '../../../src/main/infrastructure/projects/GitCli'

describe('git lancé par son chemin absolu (spec 016 FR-005)', () => {
  let base: string
  const exe = process.platform === 'win32' ? 'git.exe' : 'git'

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'gi-git-'))
  })
  afterEach(() => rmSync(base, { recursive: true, force: true }))

  it('should_find_git_only_in_absolute_path_entries', () => {
    const bin = join(base, 'bin')
    mkdirSync(bin)
    writeFileSync(join(bin, exe), '')
    expect(resolveGit(['relatif', '', `"${bin}"`].join(delimiter))).toBe(join(bin, exe))
    expect(resolveGit(['.', 'relatif'].join(delimiter))).toBeNull()
    expect(resolveGit(join(base, 'absent'))).toBeNull()
  })
})
