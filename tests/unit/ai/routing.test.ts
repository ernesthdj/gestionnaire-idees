import { describe, expect, it } from 'vitest'
import { DEFAULT_ROUTING, effortFor, maxTokensFor, resolveEngine } from '../../../src/main/domain/ai/routing'
import { LOCAL_TASK_KINDS, REMOTE_TASK_KINDS } from '../../../src/main/domain/ai/types'

describe('routing', () => {
  it('should_route_simple_tasks_to_local_engine_when_using_defaults', () => {
    for (const kind of LOCAL_TASK_KINDS) expect(resolveEngine(kind, DEFAULT_ROUTING)).toBe('ollama')
  })

  it('should_route_deep_reasoning_to_claude_when_using_defaults', () => {
    for (const kind of REMOTE_TASK_KINDS) expect(resolveEngine(kind, DEFAULT_ROUTING)).toBe('claude')
  })

  it('should_follow_configuration_when_routing_is_overridden', () => {
    expect(resolveEngine('etendre', { ...DEFAULT_ROUTING, etendre: 'ollama' })).toBe('ollama')
  })

  it('should_use_low_effort_for_extension_and_high_for_synthesis_when_asked', () => {
    expect(effortFor('etendre')).toBe('low')
    expect(effortFor('suggerer_liens')).toBe('medium')
    expect(effortFor('synthetiser')).toBe('high')
  })

  it('should_bound_output_tokens_when_task_is_a_classification', () => {
    expect(maxTokensFor('categoriser')).toBeLessThanOrEqual(512)
    expect(maxTokensFor('synthetiser')).toBeGreaterThanOrEqual(8000)
  })
})
