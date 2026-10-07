import { describe, expect, it } from 'vitest'
import { contentOf, isDocFile } from '../../../src/main/domain/reprise/content'

const FILES = [
  'README.md',
  'docs/guide.md',
  'docs/notes/plan.MDX',
  'docs/schema.png.txt',
  'src/main/app.ts',
  'src/main/README.md',
  'config/app.json',
  'config/ci.yaml'
]

describe('contenu d’un élément de carte (spec 017 D18)', () => {
  it('should_recognize_documentation_extensions_whatever_their_case', () => {
    expect(isDocFile('docs/notes/plan.MDX')).toBe(true)
    expect(isDocFile('a/b.rst')).toBe(true)
    expect(isDocFile('src/app.ts')).toBe(false)
    expect(isDocFile('.md')).toBe(false)
    expect(isDocFile('LICENSE')).toBe(false)
  })

  it('should_be_doc_when_every_covered_file_is_documentation', () => {
    expect(contentOf(['docs'], FILES)).toEqual({ kind: 'doc', code: 0, doc: 3 })
  })

  it('should_be_code_with_its_doc_count_when_a_single_code_file_is_covered', () => {
    expect(contentOf(['src/main'], FILES)).toEqual({ kind: 'code', code: 1, doc: 1 })
  })

  it('should_count_configuration_as_code_when_classifying', () => {
    expect(contentOf(['config'], FILES)).toEqual({ kind: 'code', code: 2, doc: 0 })
  })

  it('should_return_null_when_the_paths_cover_no_file', () => {
    expect(contentOf([], FILES)).toBeNull()
    expect(contentOf(['src/renderer'], FILES)).toBeNull()
  })

  it('should_match_a_single_file_path_exactly_when_given', () => {
    expect(contentOf(['README.md'], FILES)).toEqual({ kind: 'doc', code: 0, doc: 1 })
  })
})
