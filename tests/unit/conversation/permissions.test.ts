import { describe, expect, it } from 'vitest'
import { describeRequest, projectKey, ruleFor, ruleMatches } from '../../../src/main/domain/conversation/permissions'

describe('règles « Toujours pour ce projet » (spec 014 R3)', () => {
  it('should_cover_every_write_of_the_tool_when_the_rule_comes_from_a_write', () => {
    const rule = ruleFor('Edit', { file_path: 'C:/p/a.ts', old_string: 'a', new_string: 'b' })
    expect(rule).toEqual({ tool: 'Edit', pattern: null })
    expect(ruleMatches(rule, 'Edit', { file_path: 'C:/p/autre.ts' })).toBe(true)
    expect(ruleMatches(rule, 'Write', { file_path: 'C:/p/autre.ts' })).toBe(false)
  })

  it('should_cover_only_the_exact_command_when_the_rule_comes_from_a_command', () => {
    const rule = ruleFor('Bash', { command: '  npm test ' })
    expect(rule).toEqual({ tool: 'Bash', pattern: 'npm test' })
    expect(ruleMatches(rule, 'Bash', { command: 'npm test' })).toBe(true)
    expect(ruleMatches(rule, 'Bash', { command: 'npm test && curl x' })).toBe(false)
    expect(ruleMatches(rule, 'Bash', { command: 'npm install' })).toBe(false)
    expect(ruleMatches(rule, 'PowerShell', { command: 'npm test' })).toBe(false)
  })

  it('should_never_cover_an_empty_command', () => {
    expect(ruleMatches({ tool: 'Bash', pattern: '' }, 'Bash', { command: '' })).toBe(false)
    expect(ruleMatches({ tool: 'Bash', pattern: null }, 'Bash', { command: 'ls' })).toBe(false)
  })

  it('should_build_the_same_key_for_the_same_folder_whatever_its_spelling', () => {
    expect(projectKey('C:\\Users\\X\\Projet\\')).toBe('c:/users/x/projet')
    expect(projectKey('c:/users/x/projet')).toBe('c:/users/x/projet')
  })
})

describe('demande lisible par mentalyas (spec 014 US1)', () => {
  it('should_show_the_exact_command_and_its_folder', () => {
    expect(describeRequest('Bash', { command: 'git commit -m "x"', cwd: 'C:/p' })).toEqual({
      kind: 'command',
      command: 'git commit -m "x"',
      cwd: 'C:/p'
    })
  })

  it('should_show_the_path_and_a_preview_of_a_write_or_an_edit', () => {
    expect(describeRequest('Write', { file_path: 'C:/p/a.md', content: '# Titre' })).toEqual({
      kind: 'write',
      path: 'C:/p/a.md',
      preview: '# Titre'
    })
    expect(describeRequest('Edit', { file_path: 'C:/p/a.ts', old_string: 'x = 1', new_string: 'x = 2' })).toEqual({
      kind: 'write',
      path: 'C:/p/a.ts',
      preview: '− x = 1\n+ x = 2'
    })
    const long = describeRequest('Write', { file_path: 'a', content: 'y'.repeat(10_000) })
    expect(long.kind === 'write' && long.preview.length).toBe(4001)
  })

  it('should_show_the_raw_input_of_any_other_tool', () => {
    expect(describeRequest('WebFetch', { url: 'https://example.invalid' })).toEqual({
      kind: 'other',
      input: '{"url":"https://example.invalid"}'
    })
  })
})
