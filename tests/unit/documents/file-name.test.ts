import { describe, expect, it } from 'vitest'
import { documentFileName, FILE_SLUG_MAX } from '../../../src/main/domain/documents/fileName'

const none = new Set<string>()

describe('nom de fichier d’un document (spec 012 FR-002)', () => {
  it('should_turn_the_title_into_a_lowercase_slug_without_accents_nor_punctuation', () => {
    expect(documentFileName('Plan du studio : étape ① « Budget » !', none)).toBe('plan-du-studio-etape-budget.md')
  })

  it('should_bound_the_name_and_never_end_with_a_dash', () => {
    const name = documentFileName(`${'a'.repeat(59)} b c d`, none)
    expect(name.length).toBeLessThanOrEqual(FILE_SLUG_MAX + 3)
    expect(name.endsWith('-.md')).toBe(false)
  })

  it.each(['..', '../../Windows/system32', 'C:\\secret', '/etc/passwd', '   ', '***', '\u0000'])(
    'should_never_produce_a_path_separator_nor_a_dot_dot_for_%j',
    (title) => {
      const name = documentFileName(title, none)
      expect(name).toMatch(/^[a-z0-9][a-z0-9-]*\.md$/)
      expect(name).not.toContain('..')
    }
  )

  it('should_fall_back_to_document_when_nothing_is_left', () => {
    expect(documentFileName('!!!', none)).toBe('document.md')
  })

  it.each(['CON', 'nul', 'Com1', 'LPT9', 'aux', 'prn'])('should_avoid_the_windows_reserved_name_%s', (title) => {
    expect(documentFileName(title, none)).toBe(`${title.toLowerCase()}-doc.md`)
  })

  it('should_add_a_number_when_the_name_is_taken_case_insensitively', () => {
    expect(documentFileName('Budget', new Set(['budget.md']))).toBe('budget-2.md')
    expect(documentFileName('Budget', new Set(['budget.md', 'budget-2.md']))).toBe('budget-3.md')
  })
})
