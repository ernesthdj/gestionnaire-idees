import { describe, expect, it } from 'vitest'
import { readScripts, SCRIPT_NAME, tailOutput } from '../../../src/main/domain/finals/commands'

describe('scripts approuvés d’un projet (spec 013 D2 bis)', () => {
  it('should_read_the_scripts_of_a_package_json', () => {
    const scripts = readScripts(
      JSON.stringify({ name: 'site', scripts: { test: 'vitest run', 'build:web': 'vite build' } })
    )
    expect([...(scripts ?? [])]).toEqual([
      ['test', 'vitest run'],
      ['build:web', 'vite build']
    ])
  })

  it('should_return_null_for_an_invalid_json_and_an_empty_list_without_scripts', () => {
    expect(readScripts('{ pas du json')).toBeNull()
    expect(readScripts('[1, 2]')).toBeNull()
    expect(readScripts('{"name":"x"}')?.size).toBe(0)
  })

  it('should_ignore_a_hostile_script_name_or_a_non_text_script', () => {
    const scripts = readScripts(
      JSON.stringify({
        scripts: { 'test & del': 'x', 'a|b': 'y', '': 'z', ok: 'vitest', n: 3, long: 'x'.repeat(2001) }
      })
    )
    expect([...(scripts?.keys() ?? [])]).toEqual(['ok'])
  })

  it.each(['test', 'build:web', 'lint.fix', 'type-check', 'a_b'])('should_accept_the_script_name_%s', (name) => {
    expect(SCRIPT_NAME.test(name)).toBe(true)
  })

  it.each(['test && calc', 'a b', 'x;y', '$(id)', '"q"', 'a'.repeat(41), ''])(
    'should_refuse_the_script_name_%j',
    (name) => {
      expect(SCRIPT_NAME.test(name)).toBe(false)
    }
  )

  it('should_strip_colours_unify_line_ends_and_keep_the_end_of_a_long_output', () => {
    expect(tailOutput('\u001b[32m✓ ok\u001b[0m\r\nfin')).toBe('✓ ok\nfin')
    const long = tailOutput(`${'a'.repeat(30)}FIN`, 10)
    expect(long.endsWith('aaaaaaaFIN')).toBe(true)
    expect(long).toContain('23 caractères plus haut')
  })
})
