import { describe, expect, it } from 'vitest'
import { canonicalJson, fingerprint, pseudonym } from '../../../src/main/domain/analyste/fingerprint'

const KEY = 'a'.repeat(64)

describe('empreintes de la sonde', () => {
  it('should_give_the_same_fingerprint_when_the_input_is_the_same', () => {
    expect(fingerprint(KEY, 'categorize', 'v1', { text: 'Acheter du pain' })).toBe(
      fingerprint(KEY, 'categorize', 'v1', { text: 'Acheter du pain' })
    )
  })

  it('should_ignore_key_order_and_edge_spaces_when_canonicalizing', () => {
    expect(canonicalJson({ b: ' x ', a: [{ d: 1, c: 2 }] })).toBe('{"a":[{"c":2,"d":1}],"b":"x"}')
    expect(fingerprint(KEY, 'k', 'v1', { a: 1, b: 'y' })).toBe(fingerprint(KEY, 'k', 'v1', { b: ' y', a: 1 }))
  })

  it('should_change_the_fingerprint_when_the_input_the_task_or_the_frame_version_changes', () => {
    const base = fingerprint(KEY, 'categorize', 'v1', { text: 'a' })
    expect(fingerprint(KEY, 'categorize', 'v1', { text: 'b' })).not.toBe(base)
    expect(fingerprint(KEY, 'widget', 'v1', { text: 'a' })).not.toBe(base)
    expect(fingerprint(KEY, 'categorize', 'v2', { text: 'a' })).not.toBe(base)
  })

  it('should_change_everything_when_the_key_changes', () => {
    expect(fingerprint('b'.repeat(64), 'k', 'v1', 'oui')).not.toBe(fingerprint(KEY, 'k', 'v1', 'oui'))
    expect(pseudonym('b'.repeat(64), 'n1')).not.toBe(pseudonym(KEY, 'n1'))
  })

  it('should_return_short_hexadecimal_values_when_hashing', () => {
    expect(fingerprint(KEY, 'k', 'v1', {})).toMatch(/^[0-9a-f]{16}$/)
    expect(pseudonym(KEY, 'neuron-1')).toMatch(/^[0-9a-f]{12}$/)
    expect(pseudonym(KEY, 'neuron-1')).toBe(pseudonym(KEY, 'neuron-1'))
  })
})
