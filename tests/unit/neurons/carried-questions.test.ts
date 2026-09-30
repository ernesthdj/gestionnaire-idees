import { describe, expect, it } from 'vitest'
import { carriedQuestions, dimensionOf } from '../../../src/main/application/neurons/GrowthContextBuilder'

describe('questions reprises du document (T064)', () => {
  it('should_keep_a_short_question_as_its_own_label_without_question_mark', () => {
    expect(dimensionOf('Quel budget ?')).toBe('Quel budget')
  })

  it('should_cut_a_long_question_on_a_word_within_40_characters', () => {
    const label = dimensionOf('Quel est ton budget, en temps et en argent, pour tester ce workflow ?')
    expect(label.length).toBeLessThanOrEqual(40)
    expect(label).toBe('Quel est ton budget, en temps et en…')
  })

  it('should_carry_the_open_questions_of_a_reflection_summary', () => {
    const carried = carriedQuestions({
      type: 'reflection_summary',
      overview: null,
      nextStep: null,
      keyPoints: [],
      decisions: [],
      pros: [],
      cons: [],
      openQuestions: [{ text: 'Quel serveur de galerie ?' }]
    })
    expect(carried).toEqual([
      {
        question: 'Quel serveur de galerie ?',
        quickReplies: [],
        dimension: 'Quel serveur de galerie',
        answerKind: 'answer'
      }
    ])
  })

  it('should_carry_only_the_unfinished_points_to_find_of_an_action_plan', () => {
    const node = {
      parentId: null,
      type: 'task' as const,
      question: null,
      branchLabel: null,
      activeBranch: true,
      amountCents: null,
      dueDate: null,
      toSchedule: false
    }
    const carried = carriedQuestions({
      type: 'action_plan',
      nodes: [
        { ...node, id: 'a', title: 'Prix du trépied', status: 'ready', investigation: true },
        { ...node, id: 'b', title: 'Marque', status: 'done', investigation: true },
        { ...node, id: 'c', title: 'Commander', status: 'ready', investigation: false }
      ],
      dependencies: []
    })
    expect(carried.map((extension) => extension.question)).toEqual(['Qu’as-tu trouvé pour « Prix du trépied » ?'])
  })
})
