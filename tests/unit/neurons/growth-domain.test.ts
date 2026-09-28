import { describe, expect, it } from 'vitest'
import { applyGaugeFloor, filterNewExtensions, normalizeQuestion } from '../../../src/main/domain/neurons/guards'
import { descendantsOf, pathTo, type TreeNode } from '../../../src/main/domain/neurons/tree'

const tree: TreeNode[] = [
  { id: 'r', parentId: null, depth: 0, title: 'Écran' },
  { id: 'a', parentId: 'r', depth: 1, title: 'Budget ?' },
  { id: 'b', parentId: 'a', depth: 2, title: 'Non' },
  { id: 'c', parentId: 'r', depth: 1, title: 'Modèle 27"' },
  { id: 'd', parentId: 'b', depth: 3, title: 'Mission mariage' }
]

describe('tree', () => {
  it('should_return_path_from_root_to_target', () => {
    expect(pathTo(tree, 'd').map((node) => node.id)).toEqual(['r', 'a', 'b', 'd'])
  })

  it('should_return_all_descendants_of_a_node', () => {
    expect(
      descendantsOf(tree, 'a')
        .map((node) => node.id)
        .sort()
    ).toEqual(['b', 'd'])
  })

  it('should_return_empty_path_when_target_is_unknown', () => {
    expect(pathTo(tree, 'zzz')).toEqual([])
  })
})

describe('normalizeQuestion', () => {
  it('should_ignore_case_accents_punctuation_and_spaces', () => {
    expect(normalizeQuestion('  Quel est le PRIX ? ')).toBe(normalizeQuestion('quel est le prix'))
    expect(normalizeQuestion('Échéance ?')).toBe(normalizeQuestion('echeance'))
  })
})

describe('filterNewExtensions (E2)', () => {
  const proposal = (question: string) => ({ question, quickReplies: [], dimension: 'x' })

  it('should_drop_questions_already_asked_answered_or_dismissed', () => {
    const kept = filterNewExtensions([proposal('Quel prix ?'), proposal('Pour quand ?')], ['quel PRIX'])
    expect(kept.map((extension) => extension.question)).toEqual(['Pour quand ?'])
  })

  it('should_drop_duplicates_inside_the_same_reply', () => {
    expect(filterNewExtensions([proposal('Quel prix ?'), proposal('Quel prix')], [])).toHaveLength(1)
  })
})

describe('applyGaugeFloor (E4)', () => {
  it('should_force_insufficient_below_three_answers_whatever_the_ai_says', () => {
    expect(applyGaugeFloor('complete', 2)).toBe('insufficient')
  })

  it('should_keep_ai_level_from_three_answers', () => {
    expect(applyGaugeFloor('sufficient', 3)).toBe('sufficient')
    expect(applyGaugeFloor('insufficient', 7)).toBe('insufficient')
  })
})
