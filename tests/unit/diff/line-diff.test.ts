import { describe, expect, it } from 'vitest'
import { lineDiff, type DiffLine } from '../../../src/shared/diff/lineDiff'

const render = (lines: readonly DiffLine[]): string =>
  lines.map((line) => `${line.kind === 'added' ? '+' : line.kind === 'removed' ? '-' : ' '}${line.text}`).join('\n')

describe('différence ligne à ligne (spec 013 R6)', () => {
  it('should_mark_every_line_as_added_when_the_file_is_created', () => {
    expect(lineDiff(null, 'a\nb')).toEqual({
      kind: 'lines',
      lines: [
        { kind: 'added', text: 'a' },
        { kind: 'added', text: 'b' }
      ],
      added: 2,
      removed: 0
    })
  })

  it('should_return_only_same_lines_when_nothing_changed', () => {
    const diff = lineDiff('a\nb\nc', 'a\nb\nc')
    expect(diff).toMatchObject({ kind: 'lines', added: 0, removed: 0 })
  })

  it('should_find_a_minimal_edit_when_a_line_is_replaced_and_one_is_inserted', () => {
    const diff = lineDiff('a\nb\nc\nd', 'a\nB\nc\nx\nd')
    if (diff.kind !== 'lines') throw new Error('résumé inattendu')
    expect(render(diff.lines)).toBe(' a\n-b\n+B\n c\n+x\n d')
    expect([diff.added, diff.removed]).toEqual([2, 1])
  })

  it('should_rebuild_both_texts_from_the_diff_when_contents_are_arbitrary', () => {
    const before = 'un\ndeux\ntrois\nquatre\ncinq\nsix'
    const after = 'zéro\ndeux\ntrois bis\nquatre\nsix\nsept'
    const diff = lineDiff(before, after)
    if (diff.kind !== 'lines') throw new Error('résumé inattendu')
    const side = (kind: 'added' | 'removed'): string =>
      diff.lines
        .filter((line) => line.kind !== kind)
        .map((line) => line.text)
        .join('\n')
    expect(side('added')).toBe(before)
    expect(side('removed')).toBe(after)
  })

  it('should_ignore_windows_line_endings_when_only_they_differ', () => {
    expect(lineDiff('a\r\nb', 'a\nb')).toMatchObject({ added: 0, removed: 0 })
  })

  it('should_summarise_when_there_are_too_many_changes', () => {
    expect(lineDiff('a\nb\nc', 'x\ny\nz', 2)).toEqual({ kind: 'summary', beforeLines: 3, afterLines: 3 })
  })
})
