import { describe, expect, it } from 'vitest'
import {
  addedFileDiff,
  parseBranches,
  parseConfigNames,
  parseDiff,
  parseLog,
  parseProgress,
  parseStatus
} from '../../../src/main/domain/git/parse'

const H = 'a'.repeat(40)
const N = '\0'

describe('analyse des sorties de git (spec 021 T005)', () => {
  it('should_read_branch_upstream_divergence_and_both_sides_of_each_file', () => {
    const output = [
      `# branch.oid ${H}`,
      '# branch.head main',
      '# branch.upstream origin/main',
      '# branch.ab +2 -1',
      '1 M. N... 100644 100644 100644 x y src/préparé.ts',
      '1 .M N... 100644 100644 100644 x y dossier avec espace/f.ts',
      '1 MM N... 100644 100644 100644 x y les deux.ts',
      '2 R. N... 100644 100644 100644 x y R100 nouveau nom.ts',
      'ancien nom.ts',
      'u UU N... 100644 100644 100644 100644 a b c conflit.ts',
      '? non suivi é.txt',
      ''
    ].join(N)
    const status = parseStatus(output)
    expect(status).toMatchObject({ branch: 'main', detached: false, unborn: false, head: H, ahead: 2, behind: 1 })
    expect(status.upstream).toEqual({ remote: 'origin', branch: 'main' })
    expect(status.entries).toEqual([
      { path: 'src/préparé.ts', status: 'M', staged: true },
      { path: 'dossier avec espace/f.ts', status: 'M', staged: false },
      { path: 'les deux.ts', status: 'M', staged: true },
      { path: 'les deux.ts', status: 'M', staged: false },
      { path: 'nouveau nom.ts', status: 'R', staged: true, origPath: 'ancien nom.ts' },
      { path: 'conflit.ts', status: 'U', staged: false },
      { path: 'non suivi é.txt', status: '?', staged: false }
    ])
  })

  it('should_recognize_detached_head_unborn_branch_and_bound_the_list', () => {
    expect(parseStatus(['# branch.oid (initial)', '# branch.head main', ''].join(N))).toMatchObject({
      unborn: true,
      head: null,
      branch: 'main'
    })
    expect(parseStatus([`# branch.oid ${H}`, '# branch.head (detached)', ''].join(N))).toMatchObject({
      detached: true,
      branch: null
    })
    const many = Array.from({ length: 30 }, (_, index) => `? f${index}.txt`).join(N)
    const bounded = parseStatus(many, 10)
    expect(bounded.entries).toHaveLength(10)
    expect(bounded.total).toBe(30)
    expect(parseStatus('n’importe quoi')).toMatchObject({ entries: [], branch: null })
  })

  it('should_read_log_records_with_merge_parents_and_ignore_garbage', () => {
    const P = 'b'.repeat(40)
    const output = [
      [H, `${P} ${'c'.repeat(40)}`, 'Alice Fictive', 'alice@example.invalid', '2026-01-01T09:00:00Z', 'Merge: x'].join(
        '\x1f'
      ),
      ['\n' + P, '', 'Bob', 'bob@example.invalid', '2026-01-01T08:00:00Z', 'feat: a\x1fb'].join('\x1f'),
      'déchet',
      ''
    ].join(N)
    const commits = parseLog(output)
    expect(commits).toHaveLength(2)
    expect(commits[0]?.parents).toHaveLength(2)
    expect(commits[1]).toMatchObject({ hash: P, parents: [], subject: 'feat: a\x1fb' })
  })

  it('should_read_local_and_remote_branches_with_tracking', () => {
    const output = [
      ['refs/heads/main', 'origin/main', 'ahead 1, behind 3', '*'].join('\x1f'),
      ['refs/heads/feature/x', '', '', ' '].join('\x1f'),
      ['refs/remotes/origin/HEAD', '', '', ' '].join('\x1f'),
      ['refs/remotes/origin/main', '', '', ' '].join('\x1f')
    ].join('\n')
    expect(parseBranches(output)).toEqual([
      { name: 'main', remote: false, current: true, upstream: 'origin/main', ahead: 1, behind: 3 },
      { name: 'feature/x', remote: false, current: false, upstream: null, ahead: 0, behind: 0 },
      { name: 'origin/main', remote: true, current: false, upstream: null, ahead: 0, behind: 0 }
    ])
  })

  it('should_number_diff_lines_bound_them_and_summarize_binaries', () => {
    const diff = [
      'diff --git a/x b/x',
      '@@ -1,2 +1,2 @@',
      ' garde',
      '-ancien',
      '+nouveau',
      '\\ No newline at end of file'
    ].join('\n')
    expect(parseDiff('x', diff).hunks[0]?.lines).toEqual([
      { kind: 'ctx', oldNo: 1, newNo: 1, text: 'garde' },
      { kind: 'del', oldNo: 2, text: 'ancien' },
      { kind: 'add', newNo: 2, text: 'nouveau' }
    ])
    expect(parseDiff('x', diff, 2)).toMatchObject({ truncated: true })
    expect(parseDiff('logo.png', 'Binary files a/logo.png and b/logo.png differ')).toEqual({
      path: 'logo.png',
      binary: true,
      truncated: false,
      hunks: []
    })
    expect(addedFileDiff('n.txt', 'un\ndeux\n').hunks[0]?.lines).toHaveLength(2)
  })

  it('should_read_config_keys_and_clone_progress', () => {
    expect(parseConfigNames(`core.bare${N}Filter.X.clean${N}filter.x.clean${N}`)).toEqual([
      'core.bare',
      'filter.x.clean'
    ])
    expect(parseProgress('Receiving objects:   9% (1/10)\rReceiving objects:  45% (5/10)')).toBe(45)
    expect(parseProgress('Resolving deltas')).toBeNull()
  })
})
