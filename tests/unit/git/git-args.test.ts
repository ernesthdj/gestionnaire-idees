import { describe, expect, it } from 'vitest'
import * as args from '../../../src/main/domain/git/args'
import { BranchName, Hash, RelPath } from '../../../src/shared/git/model'

const HOSTILE_PATHS = ['--force', '-A', '.', '--no-verify', '+main', ':main', 'src/a.ts', 'dossier avec espace/f']
const HOSTILE_NAMES = ['--force', '-f', 'reset', '+main', ':x', 'main']

describe('constructeurs d’arguments git (spec 021 T004, SC-002)', () => {
  it('should_put_every_path_after_the_double_dash_whatever_it_looks_like', () => {
    for (const build of [
      (p: readonly string[]) => args.stageArgs(p),
      (p: readonly string[]) => args.unstageArgs(p, false),
      (p: readonly string[]) => args.unstageArgs(p, true),
      (p: readonly string[]) => args.diffArgs(p[0] ?? '', true)
    ]) {
      const built = build(HOSTILE_PATHS)
      const separator = built.indexOf('--')
      expect(separator).toBeGreaterThan(0)
      // Après `--`, git les lit comme des chemins : l'option n'existe plus.
      expect(() => args.assertSafeArgs(built)).not.toThrow()
    }
  })

  it('should_never_build_a_forbidden_argument_from_any_input_that_passed_the_shared_schemas', () => {
    const builders: (() => string[])[] = [
      args.statusArgs,
      () => args.logArgs(-5),
      () => args.logArgs(1e9),
      args.branchesArgs,
      args.commitArgs,
      args.revertAbortArgs,
      args.localConfigNamesArgs,
      args.headArgs,
      args.gitDirArgs
    ]
    for (const name of HOSTILE_NAMES.filter((value) => BranchName.safeParse(value).success)) {
      builders.push(
        () => args.createBranchArgs(name),
        () => args.switchBranchArgs(name),
        () => args.checkRefFormatArgs(name)
      )
    }
    for (const hash of ['a1b2c3d', 'HEAD', '--all'].filter((value) => Hash.safeParse(value).success)) {
      builders.push(
        () => args.revertArgs(hash),
        () => args.parentsArgs(hash)
      )
    }
    for (const path of HOSTILE_PATHS.filter((value) => RelPath.safeParse(value).success)) {
      builders.push(
        () => args.diffArgs(path, false),
        () => args.stageArgs([path])
      )
    }
    for (const build of builders) expect(() => args.assertSafeArgs(build())).not.toThrow()
    // Les schémas ont déjà écarté les noms et chemins qui ressemblent à des options.
    expect(HOSTILE_NAMES.filter((value) => BranchName.safeParse(value).success)).toEqual(['reset', 'main'])
  })

  it('should_refuse_forbidden_commands_and_options_when_they_are_assembled_by_mistake', () => {
    for (const bad of [
      ['push', '--force', 'origin', 'main'],
      ['push', '-f'],
      ['push', 'origin', '+main'],
      ['push', 'origin', ':main'],
      ['push', '--mirror'],
      ['push', '--tags'],
      ['commit', '--no-verify', '-F', '-'],
      ['commit', '-n'],
      ['commit', '--amend'],
      ['commit', '-a'],
      ['add', '-A'],
      ['add', '.'],
      ['rebase', 'main'],
      ['reset', '--hard'],
      ['clean', '-fd'],
      ['gc', '--prune=now'],
      ['branch', '--delete', 'x']
    ]) {
      expect(() => args.assertSafeArgs(bad), bad.join(' ')).toThrow()
    }
  })

  it('should_cut_hooks_when_untrusted_or_on_a_pr_branch_and_keep_them_when_trusted', () => {
    const dir = 'C:/profil/git-empty-hooks'
    const has = (prefix: readonly string[]): boolean => prefix.includes(`core.hooksPath=${dir}`)
    expect(has(args.gitPrefix({ trusted: false, onPrBranch: false, emptyHooksDir: dir }))).toBe(true)
    expect(has(args.gitPrefix({ trusted: true, onPrBranch: true, emptyHooksDir: dir }))).toBe(true)
    expect(has(args.gitPrefix({ trusted: true, onPrBranch: false, emptyHooksDir: dir }))).toBe(false)
    const prefix = args.gitPrefix({ trusted: true, onPrBranch: false, emptyHooksDir: dir })
    for (const setting of ['core.fsmonitor=false', 'core.pager=cat', 'protocol.allow=never', 'core.editor=false']) {
      expect(prefix).toContain(setting)
    }
    expect(() => args.assertSafeArgs([...prefix, ...args.statusArgs()])).not.toThrow()
  })

  it('should_bound_the_log_limit_and_read_the_message_from_stdin', () => {
    expect(args.logArgs(-5)).toContain('-n1')
    expect(args.logArgs(1e9)).toContain('-n5000')
    expect(args.commitArgs()).toEqual(['commit', '-F', '-', '--cleanup=strip'])
  })
})
