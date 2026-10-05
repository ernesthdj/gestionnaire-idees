import { describe, expect, it } from 'vitest'
import { isOutsideNature } from '../../../src/main/domain/neurons/nature'

describe('dimensions de référence par nature (US5, analyse U1)', () => {
  it('should_recognize_reference_dimensions_ignoring_case_and_accents', () => {
    expect(isOutsideNature('Quand', 'action')).toBe(false)
    expect(isOutsideNature('source d’argent', 'action')).toBe(false)
    expect(isOutsideNature('criteres', 'reflection')).toBe(false)
    expect(isOutsideNature('pourquoi', 'action')).toBe(true)
    expect(isOutsideNature('couleur', 'reflection')).toBe(true)
  })
})
