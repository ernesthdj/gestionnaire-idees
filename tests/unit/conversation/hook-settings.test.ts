import { describe, expect, it } from 'vitest'
import { bashQuote, hookSettings } from '../../../src/main/domain/conversation/hookSettings'
import { parseHookInput } from '../../../src/shared/mcp/hook'

const NEURON = '00000000-0000-4000-8000-0000000000c1'

describe('hook avant écriture (spec 014 R5)', () => {
  it('should_escape_what_bash_would_interpret_inside_double_quotes', () => {
    expect(bashQuote('C:/Program Files/app')).toBe('"C:/Program Files/app"')
    expect(bashQuote('a"b$c`d\\e')).toBe('"a\\"b\\$c\\`d\\\\e"')
  })

  it('should_launch_the_relay_in_hook_mode_on_write_tools_with_node_mode_for_this_command_only', () => {
    const settings = JSON.parse(
      hookSettings({
        electronPath: 'C:\\Program Files\\Brainstormer\\electron.exe',
        relayPath: 'C:\\app\\out\\main\\mcp-relay.js',
        profileDir: 'C:\\Users\\x\\AppData\\Roaming\\gestionnaire-idees',
        neuronId: NEURON
      })
    ) as { hooks: { PreToolUse: { matcher: string; hooks: { type: string; command: string }[] }[] } }
    const [entry] = settings.hooks.PreToolUse
    expect(entry?.matcher).toBe('Write|Edit|MultiEdit|NotebookEdit')
    expect(entry?.hooks[0]?.command).toBe(
      'GI_PROFILE_DIR="C:/Users/x/AppData/Roaming/gestionnaire-idees" ELECTRON_RUN_AS_NODE=1 ' +
        `"C:/Program Files/Brainstormer/electron.exe" "C:/app/out/main/mcp-relay.js" --hook ${NEURON}`
    )
  })

  it('should_refuse_a_neuron_id_that_is_not_a_uuid', () => {
    expect(() =>
      hookSettings({ electronPath: 'e', relayPath: 'r', profileDir: 'p', neuronId: '1; rm -rf ~' })
    ).toThrow()
  })

  it('should_read_the_tool_its_file_and_its_id_from_the_hook_input', () => {
    const input = (toolName: string, toolInput: Record<string, unknown>, extra: Record<string, unknown> = {}): string =>
      JSON.stringify({
        hook_event_name: 'PreToolUse',
        tool_name: toolName,
        tool_input: toolInput,
        tool_use_id: 'toolu_1',
        ...extra
      })
    expect(parseHookInput(input('Write', { file_path: 'C:\\p\\a.ts', content: 'x' }))).toEqual({
      tool: 'Write',
      file_path: 'C:\\p\\a.ts',
      tool_use_id: 'toolu_1'
    })
    expect(parseHookInput(input('NotebookEdit', { notebook_path: 'C:\\p\\n.ipynb' }))?.file_path).toBe('C:\\p\\n.ipynb')
    expect(parseHookInput(input('Bash', { command: 'ls' }))).toBeNull()
    expect(parseHookInput(input('Write', { file_path: 'C:\\p\\a.ts' }, { tool_use_id: undefined }))).toBeNull()
    expect(parseHookInput('pas du json')).toBeNull()
  })
})
