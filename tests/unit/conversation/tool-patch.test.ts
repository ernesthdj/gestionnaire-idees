import { describe, expect, it } from 'vitest'
import { TOOL_PATCH_MAX_LINES, readToolPatch, toolPatchOf } from '../../../src/main/domain/conversation/toolPatch'
import { parseStreamLine } from '../../../src/main/domain/conversation/streamEvents'

const edit = {
  filePath: 'C:\\p\\a.ts',
  oldString: 'ligne 2',
  newString: 'ligne deux',
  structuredPatch: [
    { oldStart: 1, oldLines: 3, newStart: 1, newLines: 3, lines: [' ligne 1', '-ligne 2', '+ligne deux'] }
  ]
}

describe('modification d’un outil sur un fichier (spec 014 D9)', () => {
  it('should_keep_the_cli_hunks_when_an_edit_or_a_rewrite_changes_a_file', () => {
    expect(toolPatchOf(edit)).toEqual({
      hunks: [{ oldStart: 1, newStart: 1, lines: [' ligne 1', '-ligne 2', '+ligne deux'] }],
      created: false,
      truncated: false
    })
  })

  it('should_show_every_line_as_added_when_a_write_creates_a_file', () => {
    const created = toolPatchOf({ type: 'create', filePath: 'b.txt', content: 'un\r\ndeux\n', structuredPatch: [] })
    expect(created).toEqual({
      hunks: [{ oldStart: 0, newStart: 1, lines: ['+un', '+deux'] }],
      created: true,
      truncated: false
    })
  })

  it('should_return_nothing_when_the_result_is_a_read_or_unexpected', () => {
    expect(toolPatchOf({ type: 'text', file: { filePath: 'a.ts', content: 'x' } })).toBeNull()
    expect(toolPatchOf({ structuredPatch: [{ oldStart: 'x', lines: [] }] })).toBeNull()
    expect(toolPatchOf('texte')).toBeNull()
  })

  it('should_cut_the_change_when_it_is_too_long', () => {
    const lines = Array.from({ length: TOOL_PATCH_MAX_LINES + 10 }, (_, i) => `+${i}`)
    const patch = toolPatchOf({ type: 'create', content: lines.map((l) => l.slice(1)).join('\n') })
    expect(patch?.truncated).toBe(true)
    expect(patch?.hunks[0]?.lines).toHaveLength(TOOL_PATCH_MAX_LINES)
  })

  it('should_read_back_a_stored_change_and_ignore_a_broken_one', () => {
    const patch = toolPatchOf(edit)
    expect(readToolPatch(JSON.stringify(patch))).toEqual(patch)
    expect(readToolPatch('{pas du json')).toBeNull()
    expect(readToolPatch(JSON.stringify({ hunks: 'x' }))).toBeNull()
    expect(readToolPatch(null)).toBeNull()
  })

  it('should_attach_the_change_to_its_result_when_the_message_has_one_result', () => {
    const line = (results: unknown[]): string =>
      JSON.stringify({ type: 'user', message: { content: results }, tool_use_result: edit })
    const [one] = parseStreamLine(line([{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }]))
    expect(one).toMatchObject({ kind: 'toolResult', id: 't1', patch: { created: false } })
    const two = parseStreamLine(
      line([
        { type: 'tool_result', tool_use_id: 't1', content: 'ok' },
        { type: 'tool_result', tool_use_id: 't2', content: 'ok' }
      ])
    )
    expect(two.every((event) => !('patch' in event))).toBe(true)
    const [failed] = parseStreamLine(line([{ type: 'tool_result', tool_use_id: 't1', is_error: true, content: 'non' }]))
    expect(failed !== undefined && 'patch' in failed).toBe(false)
  })
})
