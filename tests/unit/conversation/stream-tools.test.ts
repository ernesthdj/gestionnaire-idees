import { describe, expect, it } from 'vitest'
import { parseStreamLine, toolTitle } from '../../../src/main/domain/conversation/streamEvents'

const line = (value: unknown): string => JSON.stringify(value)

describe('outils natifs et leur résultat dans le flux (spec 014 R4)', () => {
  it('should_report_the_id_and_the_input_of_a_tool_use', () => {
    const message = {
      type: 'assistant',
      message: { content: [{ type: 'tool_use', id: 'toolu_1', name: 'Bash', input: { command: 'npm test' } }] }
    }
    expect(parseStreamLine(line(message))).toEqual([
      { kind: 'tool', name: 'Bash', id: 'toolu_1', input: { command: 'npm test' } }
    ])
  })

  it('should_report_a_tool_result_as_success_or_error_with_a_short_reason', () => {
    const ok = { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'OK' }] } }
    expect(parseStreamLine(line(ok))).toEqual([{ kind: 'toolResult', id: 'toolu_1', isError: false, text: 'OK' }])
    const failed = {
      type: 'user',
      message: {
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_2',
            is_error: true,
            content: [{ type: 'text', text: 'Exit code 1\n' + 'x'.repeat(1000) }]
          }
        ]
      }
    }
    const [event] = parseStreamLine(line(failed))
    expect(event).toMatchObject({ kind: 'toolResult', id: 'toolu_2', isError: true })
    expect(event?.kind === 'toolResult' && event.text.length).toBe(301)
    expect(event?.kind === 'toolResult' && event.text.startsWith('Exit code 1 x')).toBe(true)
  })

  it('should_report_a_permission_refusal', () => {
    const denied = {
      type: 'system',
      subtype: 'permission_denied',
      tool_name: 'Write',
      tool_use_id: 'toolu_3',
      message: 'Claude requested permissions to write to C:\\p\\a.txt, but you haven’t granted it yet.'
    }
    expect(parseStreamLine(line(denied))).toEqual([
      {
        kind: 'permissionDenied',
        id: 'toolu_3',
        message: 'Claude requested permissions to write to C:\\p\\a.txt, but you haven’t granted it yet.'
      }
    ])
  })

  it('should_name_the_command_or_the_file_a_tool_works_on', () => {
    expect(toolTitle('Bash', { command: 'git commit -m "feat: x"' })).toBe('commande : git commit -m "feat: x"')
    expect(toolTitle('Edit', { file_path: 'C:\\p\\src\\a.ts' })).toBe('fichier modifié : a.ts')
    expect(toolTitle('Read', {})).toBe('fichier lu')
    expect(toolTitle('mcp__brainstormer__fiche_ecrire', {})).toBe('fiche mise à jour')
  })
})
