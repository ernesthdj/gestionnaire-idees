import { describe, expect, it } from 'vitest'
import { effortFor, engineFor, maxTokensFor } from '../../../src/main/domain/ai/routing'

describe('routing (spec 010)', () => {
  it('should_keep_categorization_local_and_send_widgets_to_claude', () => {
    expect(engineFor('categoriser')).toBe('ollama')
    expect(engineFor('widget')).toBe('claude')
  })

  it('should_use_low_effort_for_categorization_and_medium_for_widgets', () => {
    expect(effortFor('categoriser')).toBe('low')
    expect(effortFor('widget')).toBe('medium')
  })

  it('should_bound_output_tokens_when_task_is_a_classification', () => {
    expect(maxTokensFor('categoriser')).toBeLessThanOrEqual(512)
    expect(maxTokensFor('widget')).toBeGreaterThanOrEqual(8000)
  })
})
