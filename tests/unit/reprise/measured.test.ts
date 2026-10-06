import { describe, expect, it } from 'vitest'
import { covers, fileCalls, measuredLinks, normalizeElementPath } from '../../../src/main/domain/reprise/measured'

const G = 'genesis'

describe('appels mesurés entre éléments de carte (spec 017 US7, FR-033)', () => {
  it('should_aggregate_resolved_calls_between_different_files_with_the_weakest_provenance', () => {
    const paths: Record<string, string> = { a1: 'src/api/a.ts', a2: 'src/api/a.ts', c: 'src/core/c.ts' }
    const calls = fileCalls(
      [
        { fromSymbolId: 'a1', toSymbolId: 'c', count: 2, provenance: 'syntax' },
        { fromSymbolId: 'a2', toSymbolId: 'c', count: 1, provenance: 'uncertain' },
        { fromSymbolId: 'a1', toSymbolId: 'a2', count: 5, provenance: 'syntax' },
        { fromSymbolId: 'a1', toSymbolId: null, count: 4, provenance: 'uncertain' }
      ],
      (id) => paths[id]
    )
    expect(calls).toEqual([{ from: 'src/api/a.ts', to: 'src/core/c.ts', count: 3, provenance: 'uncertain' }])
  })

  it('should_give_a_file_to_the_deepest_element_covering_it_and_ignore_calls_inside_an_element', () => {
    const elements = [
      { id: 'back', parentId: G, paths: ['src/'] },
      { id: 'api', parentId: 'back', paths: ['./src/api'] },
      { id: 'core', parentId: 'back', paths: ['src\\core', 'src/core/c.ts'] }
    ]
    const links = measuredLinks(elements, [
      { from: 'src/api/a.ts', to: 'src/core/c.ts', count: 3, provenance: 'syntax' },
      { from: 'src/api/b.ts', to: 'src/core/d.ts', count: 1, provenance: 'deduced' },
      { from: 'src/api/a.ts', to: 'src/api/b.ts', count: 9, provenance: 'syntax' },
      { from: 'src/main.ts', to: 'src/api/a.ts', count: 1, provenance: 'syntax' },
      { from: 'lib/x.ts', to: 'src/api/a.ts', count: 1, provenance: 'syntax' }
    ])
    expect(links).toEqual([
      { from: 'api', to: 'core', count: 4, provenance: 'deduced' },
      { from: 'back', to: 'api', count: 1, provenance: 'syntax' }
    ])
  })

  it('should_normalize_element_paths_and_never_cover_a_sibling_prefix', () => {
    expect(normalizeElementPath('.\\src\\core\\')).toBe('src/core')
    expect(covers(['src/core'], 'src/core/a.ts')).toBe(true)
    expect(covers(['src/core'], 'src/corelib/a.ts')).toBe(false)
    expect(covers([''], 'a.ts')).toBe(false)
  })
})
