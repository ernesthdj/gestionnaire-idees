import { describe, expect, it } from 'vitest'
import { BranchName, Hash, RelPath } from '../../../src/shared/git/model'
import { GitCommitInput, GitPathsInput } from '../../../src/shared/ipc/git'

const G = '00000000-0000-4000-8000-000000000021'

describe('schémas git partagés (spec 021 T003)', () => {
  it('should_refuse_hostile_paths_when_a_relative_path_is_expected', () => {
    for (const path of [
      '../dehors.txt',
      'a/../../b',
      'C:/Windows/win.ini',
      '/etc/passwd',
      '\\\\serveur\\x',
      '-rf',
      'a\u0000b',
      ''
    ]) {
      expect(RelPath.safeParse(path).success, JSON.stringify(path)).toBe(false)
    }
    for (const path of ['src/a.ts', 'docs/été.md', 'dossier avec espace/f.txt', '.gitignore']) {
      expect(RelPath.safeParse(path).success, path).toBe(true)
    }
  })

  it('should_refuse_branch_names_that_look_like_options_or_are_reserved', () => {
    for (const name of [
      '-x',
      '--force',
      'analyste/essai',
      'a..b',
      'x.lock',
      'a b',
      'fin/',
      '',
      '.',
      'a/.cache',
      'a//b'
    ]) {
      expect(BranchName.safeParse(name).success, name).toBe(false)
    }
    for (const name of ['main', 'feature/carte-git', 'alice/brainstorm', 'v1.2']) {
      expect(BranchName.safeParse(name).success, name).toBe(true)
    }
  })

  it('should_accept_only_hex_hashes', () => {
    expect(Hash.safeParse('a1b2c3d').success).toBe(true)
    expect(Hash.safeParse('HEAD').success).toBe(false)
    expect(Hash.safeParse('a1b2c3d; rm').success).toBe(false)
  })

  it('should_require_confirmation_and_bounded_inputs_for_writes', () => {
    expect(
      GitCommitInput.safeParse({ genesisId: G, message: 'feat: x', expectedStaged: ['a.ts'], confirm: true }).success
    ).toBe(true)
    expect(GitCommitInput.safeParse({ genesisId: G, message: 'feat: x', expectedStaged: ['a.ts'] }).success).toBe(false)
    expect(GitCommitInput.safeParse({ genesisId: G, message: '   ', expectedStaged: [], confirm: true }).success).toBe(
      false
    )
    expect(GitPathsInput.safeParse({ genesisId: G, paths: [] }).success).toBe(false)
    expect(GitPathsInput.safeParse({ genesisId: G, paths: ['a.ts'], cwd: 'C:/' }).success).toBe(false)
  })
})
