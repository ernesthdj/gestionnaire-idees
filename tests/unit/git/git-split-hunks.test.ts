import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { assemble, hasMarkers, newLines, splitHunks, type HunkDecision } from '../../../src/main/domain/git/splitHunks'

/** Référence : `git merge-file` (fusion à trois voies de git), résultat « tout la mienne » (`--ours`). */
function gitMergeOurs(base: string, ours: string, theirs: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'gi-merge-file-'))
  try {
    for (const [name, text] of [
      ['ours', ours],
      ['base', base],
      ['theirs', theirs]
    ] as const) {
      writeFileSync(join(dir, name), text)
    }
    execFileSync('git', ['merge-file', '--ours', 'ours', 'base', 'theirs'], { cwd: dir })
    return readFileSync(join(dir, 'ours'), 'utf8')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const all = (choice: HunkDecision['choice'], count: number): Map<number, HunkDecision> =>
  new Map(Array.from({ length: count }, (_, index) => [index, { choice }] as const))

describe('fusion à trois voies (spec 021 T034)', () => {
  const base = ['a', 'b', 'c', 'd', 'e', ''].join('\n')
  const ours = ['a', 'B mien', 'c', 'd', 'e', ''].join('\n')
  const theirs = ['a', 'B leur', 'c', 'd', 'E leur', ''].join('\n')

  it('should_take_one_sided_changes_and_keep_only_true_conflicts', () => {
    const segments = splitHunks(base, ours, theirs)
    const conflicts = segments.filter((segment) => segment.kind === 'conflict')
    expect(conflicts).toEqual([{ kind: 'conflict', index: 0, base: ['b'], ours: ['B mien'], theirs: ['B leur'] }])
    // Sans décision : marqueurs ; la modification de « e » (leur côté seulement) est déjà prise.
    const preview = assemble(segments, new Map())
    expect(hasMarkers(preview)).toBe(true)
    expect(preview).toContain('E leur')
  })

  it('should_match_git_merge_file_when_everything_is_mine', () => {
    for (const [b, o, t] of [
      [base, ours, theirs],
      ['x\ny\n', 'x\ny mien\nz\n', 'w\nx\ny leur\n'],
      ['un\ndeux\ntrois\n', 'un\ndeux\ntrois\nquatre mien\n', 'un\ndeux\ntrois\nquatre leur\n'],
      ['', 'ajout mien\n', 'ajout leur\n']
    ] as const) {
      const segments = splitHunks(b, o, t)
      const count = segments.filter((segment) => segment.kind === 'conflict').length
      expect(assemble(segments, all('ours', count))).toBe(gitMergeOurs(b, o, t))
    }
  })

  it('should_assemble_theirs_both_and_edited_text', () => {
    const segments = splitHunks(base, ours, theirs)
    expect(assemble(segments, all('theirs', 1))).toBe('a\nB leur\nc\nd\nE leur\n')
    expect(assemble(segments, all('both', 1))).toBe('a\nB mien\nB leur\nc\nd\nE leur\n')
    expect(assemble(segments, new Map([[0, { choice: 'manual', text: 'B fusionné' }]]))).toBe(
      'a\nB fusionné\nc\nd\nE leur\n'
    )
    expect(hasMarkers(assemble(segments, all('ours', 1)))).toBe(false)
  })

  it('should_keep_windows_line_endings_and_spot_new_lines', () => {
    const segments = splitHunks(base.replace(/\n/g, '\r\n'), ours.replace(/\n/g, '\r\n'), theirs.replace(/\n/g, '\r\n'))
    expect(assemble(segments, all('ours', 1), '\r\n')).toBe('a\r\nB mien\r\nc\r\nd\r\nE leur\r\n')
    expect(newLines('B mien\nB leur\nrm -rf /', ['B mien'], ['B leur'])).toEqual([2])
    expect(hasMarkers('code\n=======\nplus')).toBe(true)
    expect(hasMarkers('const x = "======="')).toBe(false)
  })
})
