import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { ActionPlanOut, EtendreOut } from '../../../src/shared/ai/neurons'

/** Réponses RÉELLES de qwen3.5:9b (diagnostic du 2026-09-29), rejetées avant la tolérance. */
const LOCAL_ANSWER_WITH_BAD_DATE = {
  kind: 'extensions',
  extensions: [
    {
      question: 'Pourrais-tu choisir un moment précis dans ce mois-ci ?',
      quickReplies: ['Début du mois', 'Milieu du mois', 'Fin du mois'],
      dimension: 'quand',
      answerKind: 'condition'
    }
  ],
  suggestions: [],
  assessment: { level: 'sufficient', covered: ['quand', 'budget'], missing: ["source d'argent"] },
  detectedOpportunity: { title: 'Moment de pose estimé', amountCents: 25000, expectedDate: '2023-11' }
}

const LOCAL_ANSWER_WITH_BRACKETED_REF = {
  kind: 'extensions',
  extensions: [{ question: 'Pour quel usage ?', quickReplies: [], dimension: 'comment' }],
  suggestions: [
    { neuronRef: '[s2]', title: 'Tester l’occasion', content: 'Reconditionné ou occasion pour tenir le budget.' }
  ],
  assessment: { level: 'insufficient', covered: ['quand'], missing: ['comment'] }
}

describe('sorties IA tolérantes', () => {
  it('should_keep_the_questions_and_drop_only_an_incomplete_optional_date', () => {
    const parsed = EtendreOut.safeParse(LOCAL_ANSWER_WITH_BAD_DATE)
    expect(parsed.success).toBe(true)
    expect(parsed.data?.extensions).toHaveLength(1)
    expect(parsed.data?.detectedOpportunity).toEqual({ title: 'Moment de pose estimé', amountCents: 25000 })
  })

  it('should_repair_a_neuron_reference_written_with_brackets', () => {
    const parsed = EtendreOut.safeParse(LOCAL_ANSWER_WITH_BRACKETED_REF)
    expect(parsed.data?.suggestions[0]?.neuronRef).toBe('s2')
  })

  it('should_drop_only_the_faulty_items_of_a_list', () => {
    const parsed = EtendreOut.safeParse({
      ...LOCAL_ANSWER_WITH_BRACKETED_REF,
      extensions: [
        { question: 'Bonne question ?', quickReplies: ['Oui', 'x'.repeat(80)], dimension: 'quoi' },
        { question: '', quickReplies: [], dimension: 'vide' }
      ],
      suggestions: [{ neuronRef: 'neurone-2', title: 'Sans référence valable', content: '…' }],
      assessment: { level: 'insufficient', covered: ['y'.repeat(60), 'quand'], missing: [] }
    })
    expect(parsed.success).toBe(true)
    expect(parsed.data?.extensions.map((extension) => extension.quickReplies)).toEqual([['Oui']])
    expect(parsed.data?.suggestions).toEqual([])
    expect(parsed.data?.assessment.covered).toEqual(['quand'])
  })

  it('should_still_reject_an_answer_whose_structure_is_wrong', () => {
    expect(EtendreOut.safeParse({ kind: 'extensions', extensions: 'aucune' }).success).toBe(false)
    expect(EtendreOut.safeParse({ ...LOCAL_ANSWER_WITH_BAD_DATE, assessment: { level: 'moyen' } }).success).toBe(false)
  })

  it('should_repair_bracketed_source_references_in_a_plan', () => {
    const plan = ActionPlanOut.parse({
      nodes: [{ ref: 't1', type: 'task', title: 'Commander', sourceRefs: ['[s1]', 's2'] }],
      dependencies: [],
      gaps: []
    })
    expect(plan.nodes[0]?.sourceRefs).toEqual(['s1', 's2'])
  })

  it('should_send_the_model_the_same_strict_json_schema', () => {
    const schema = JSON.stringify(z.toJSONSchema(EtendreOut))
    expect(schema).toContain('"pattern":"^s\\\\d{1,3}$"')
    expect(schema).toContain('"maxItems":8')
    expect(schema).toContain('"maxLength":40')
  })
})
