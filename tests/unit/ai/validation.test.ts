import { describe, expect, it } from 'vitest'
import { CategoryOut } from '../../../src/shared/ai/schemas'
import { createGatewayHarness } from '../../support/gateway'

describe('AIGateway — validation des sorties', () => {
  it('should_return_data_when_first_reply_is_valid', async () => {
    const h = createGatewayHarness()
    h.ollama.enqueue({ raw: { categorySlug: 'achat', nature: 'action' } })
    const result = await h.gateway.run({ kind: 'categoriser', input: 'acheter une télé', schema: CategoryOut })
    expect(result).toMatchObject({ ok: true, value: { data: { categorySlug: 'achat' }, engine: 'ollama' } })
  })

  it('should_retry_once_with_error_hint_when_first_reply_is_invalid', async () => {
    const h = createGatewayHarness()
    h.ollama.enqueue({ raw: { categorySlug: 'poeme' } }, { raw: { categorySlug: 'photo', nature: 'reflection' } })
    const result = await h.gateway.run({ kind: 'categoriser', input: 'shooting', schema: CategoryOut })
    expect(result.ok).toBe(true)
    expect(h.ollama.requests).toHaveLength(2)
    expect(h.ollama.requests[1]?.user).toMatch(/format/i)
  })

  it('should_fail_with_invalid_output_when_second_reply_is_also_invalid', async () => {
    const h = createGatewayHarness()
    h.ollama.enqueue({ raw: {} }, { raw: { nope: true } })
    const result = await h.gateway.run({ kind: 'categoriser', input: 'x', schema: CategoryOut })
    expect(result).toMatchObject({ ok: false, error: { code: 'AI_INVALID_OUTPUT' } })
    expect(h.ollama.requests).toHaveLength(2)
  })

  it('should_return_refusal_without_retry_when_model_refuses', async () => {
    const h = createGatewayHarness()
    h.claude.enqueue({ raw: null, stopReason: 'refusal' })
    const result = await h.gateway.run({ kind: 'synthetiser', input: 'x', schema: CategoryOut })
    expect(result).toMatchObject({ ok: false, error: { code: 'AI_REFUSAL' } })
    expect(h.claude.requests).toHaveLength(1)
  })

  it('should_log_invalid_status_when_output_is_rejected', async () => {
    const h = createGatewayHarness()
    h.ollama.enqueue({ raw: {} }, { raw: {} })
    await h.gateway.run({ kind: 'categoriser', input: 'x', schema: CategoryOut })
    expect(h.calls.map((call) => call.status)).toEqual(['invalid', 'invalid'])
  })
})
