import { describe, expect, it } from 'vitest'
import { ReflectionSummaryOut } from '../../../src/shared/ai/neurons'

const base = {
  keyPoints: [{ text: 'Le budget tient', sourceRefs: ['s1'] }],
  decisions: [],
  pros: [],
  cons: [],
  openQuestions: []
}

describe('fiche éditoriale de la synthèse de réflexion', () => {
  it('should_keep_the_overview_headlines_and_next_step_when_well_formed', () => {
    const parsed = ReflectionSummaryOut.parse({
      ...base,
      overview: 'Tout est prêt.',
      keyPoints: [{ headline: 'Budget tenu', text: 'Les 200 € suffisent.', sourceRefs: ['s1'] }],
      nextStep: 'Mesurer le bureau'
    })
    expect(parsed.overview).toBe('Tout est prêt.')
    expect(parsed.keyPoints[0]?.headline).toBe('Budget tenu')
    expect(parsed.nextStep).toBe('Mesurer le bureau')
  })

  it('should_drop_a_malformed_editorial_field_without_rejecting_the_summary', () => {
    const parsed = ReflectionSummaryOut.parse({
      ...base,
      overview: '',
      keyPoints: [{ headline: 'x'.repeat(61), text: 'Les 200 € suffisent.', sourceRefs: ['s1'] }],
      nextStep: 42
    })
    expect(parsed.overview).toBeUndefined()
    expect(parsed.keyPoints[0]?.headline).toBeUndefined()
    expect(parsed.nextStep).toBeUndefined()
  })

  it('should_still_accept_a_summary_without_editorial_fields', () => {
    expect(ReflectionSummaryOut.parse(base).overview).toBeUndefined()
  })
})
