import { describe, expect, it } from 'vitest'
import { budgetPercent, formatEuros, parseEurosToCents } from '../../../src/renderer/src/pages/settings/ai/format'

describe('format des réglages IA', () => {
  it.each([
    ['10', 1000],
    ['12,50', 1250],
    [' 7.5 ', 750],
    ['0', 0]
  ])('should_parse_%s_euros_into_cents', (input, cents) => {
    expect(parseEurosToCents(input)).toBe(cents)
  })

  it.each(['', 'abc', '-3', '12,345', '5000'])('should_reject_invalid_or_excessive_amount_%s', (input) => {
    expect(parseEurosToCents(input)).toBeNull()
  })

  it('should_bound_budget_percent_between_0_and_100', () => {
    expect(budgetPercent(816, 1000)).toBe(82)
    expect(budgetPercent(2000, 1000)).toBe(100)
    expect(budgetPercent(0, 0)).toBe(100)
  })

  it('should_format_cents_as_euros', () => {
    expect(formatEuros(1250)).toMatch(/12,50/)
  })
})
