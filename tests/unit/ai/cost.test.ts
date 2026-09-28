import { describe, expect, it } from 'vitest'
import { DEFAULT_PRICING, costMillicents, estimateMaxMillicents, pricingFor } from '../../../src/main/domain/ai/cost'

const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }

describe('costMillicents', () => {
  it('should_price_opus_5_input_and_output_when_converting_to_euro_millicents', () => {
    // 1 M tokens d'entrée (5 $) + 100 k de sortie (2,5 $) = 7,5 $ ; × 0,92 = 6,90 € = 690 000 millicentimes.
    const cost = costMillicents(
      { ...usage, inputTokens: 1_000_000, outputTokens: 100_000 },
      DEFAULT_PRICING['claude-opus-5'],
      0.92
    )
    expect(cost).toBe(690_000)
  })

  it('should_bill_cache_reads_at_ten_percent_and_writes_at_125_percent_of_input', () => {
    const pricing = DEFAULT_PRICING['claude-opus-5']
    const read = costMillicents({ ...usage, cacheReadTokens: 1_000_000 }, pricing, 1)
    const write = costMillicents({ ...usage, cacheWriteTokens: 1_000_000 }, pricing, 1)
    const input = costMillicents({ ...usage, inputTokens: 1_000_000 }, pricing, 1)
    expect(read).toBe(Math.round(input * 0.1))
    expect(write).toBe(Math.round(input * 1.25))
  })

  it('should_cost_nothing_when_model_is_local', () => {
    expect(costMillicents({ ...usage, inputTokens: 5000, outputTokens: 5000 }, undefined, 0.92)).toBe(0)
  })

  it('should_return_integer_millicents_when_amounts_are_fractional', () => {
    const cost = costMillicents(
      { ...usage, inputTokens: 1234, outputTokens: 567 },
      DEFAULT_PRICING['claude-sonnet-5'],
      0.92
    )
    expect(Number.isInteger(cost)).toBe(true)
  })
})

describe('estimateMaxMillicents', () => {
  it('should_bound_cost_with_max_output_tokens_when_estimating_before_call', () => {
    const estimate = estimateMaxMillicents(
      { inputTokens: 8000, maxOutputTokens: 4000 },
      DEFAULT_PRICING['claude-opus-5'],
      1
    )
    expect(estimate).toBe(
      costMillicents({ ...usage, inputTokens: 8000, outputTokens: 4000 }, DEFAULT_PRICING['claude-opus-5'], 1)
    )
  })
})

describe('pricingFor', () => {
  it('should_use_configured_model_price_when_response_comes_from_unknown_fallback_model', () => {
    expect(pricingFor('claude-futur-9', 'claude-opus-5')).toBe(DEFAULT_PRICING['claude-opus-5'])
  })

  it('should_price_opus_4_8_when_server_fallback_served_the_request', () => {
    expect(pricingFor('claude-opus-4-8', 'claude-opus-5')).toBeDefined()
  })
})
