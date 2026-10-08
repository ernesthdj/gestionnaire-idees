import { describe, expect, it } from 'vitest'
import { covers, coveringElement, normalizeElementPath } from '../../src/shared/structure/covers'

describe('covers', () => {
  it('should_cover_a_file_when_a_path_is_the_file_or_one_of_its_folders', () => {
    expect(covers(['src/canvas'], 'src/canvas/buildGraph.ts')).toBe(true)
    expect(covers(['src/canvas/buildGraph.ts'], 'src/canvas/buildGraph.ts')).toBe(true)
    expect(covers(['src/can'], 'src/canvas/buildGraph.ts')).toBe(false)
    expect(covers([''], 'src/x.ts')).toBe(false)
  })

  it('should_normalize_separators_and_edges_when_a_path_is_written_loosely', () => {
    expect(normalizeElementPath('.\\src\\canvas\\')).toBe('src/canvas')
  })
})

describe('coveringElement', () => {
  const candidates = [
    { id: 'module', depth: 0, paths: ['src'] },
    { id: 'canvas', depth: 1, paths: ['src/canvas'] },
    { id: 'wide', depth: 1, paths: ['src/renderer'] },
    { id: 'precise', depth: 1, paths: ['src/renderer/src/canvas'] }
  ]

  it('should_pick_the_deepest_then_most_precise_element_when_several_cover_a_file', () => {
    expect(coveringElement(candidates, 'src/canvas/x.ts')).toBe('canvas')
    expect(coveringElement(candidates, 'src/renderer/src/canvas/y.ts')).toBe('precise')
    expect(coveringElement(candidates, 'src/main/z.ts')).toBe('module')
  })

  it('should_return_null_when_no_element_covers_the_file', () => {
    expect(coveringElement(candidates, 'docs/README.md')).toBeNull()
  })
})
