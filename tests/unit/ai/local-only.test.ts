import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { DEFAULT_ROUTING, resolveEngine } from '../../../src/main/domain/ai/routing'
import { createGatewayHarness } from '../../support/gateway'

const Persons = z.object({ persons: z.array(z.string()), places: z.array(z.string()) })

describe('anonymisation strictement locale', () => {
  it('should_route_anonymization_locally_even_when_configuration_says_claude', () => {
    expect(resolveEngine('anonymiser', { ...DEFAULT_ROUTING, anonymiser: 'claude' })).toBe('ollama')
  })

  it('should_never_fall_back_to_claude_for_anonymization_when_ollama_is_down', async () => {
    const h = createGatewayHarness({ config: () => ({ routing: DEFAULT_ROUTING, allowClaudeFallback: true }) })
    h.ollama.setAvailable(false)
    const result = await h.gateway.run({ kind: 'anonymiser', input: 'Marc', schema: Persons, noQueue: true })
    expect(result).toMatchObject({ ok: false, error: { code: 'AI_UNAVAILABLE' } })
    expect(h.claude.requests).toHaveLength(0)
  })

  it('should_never_run_degraded_on_claude_for_anonymization', async () => {
    const h = createGatewayHarness()
    h.ollama.setAvailable(false)
    const result = await h.gateway.run({ kind: 'anonymiser', input: 'Marc', schema: Persons, allowDegraded: true })
    expect(result.ok).toBe(false)
    expect(h.claude.requests).toHaveLength(0)
  })
})
