import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { CategoryOut } from '../../../src/shared/ai/schemas'
import { DEFAULT_ROUTING } from '../../../src/main/domain/ai/routing'
import { createGatewayHarness } from '../../support/gateway'

const Echo = z.object({ answer: z.string() })

describe('AIGateway — routage, file, journal', () => {
  it('should_send_to_claude_only_anonymized_input_when_task_is_remote', async () => {
    const h = createGatewayHarness()
    h.claude.enqueue({ raw: { answer: 'ok' } })
    await h.gateway.run({ kind: 'synthetiser', input: 'Payer 1 247 € à Marc', schema: Echo })
    expect(h.anonymized).toEqual(['Payer 1 247 € à Marc'])
    expect(h.claude.requests[0]?.user).not.toContain('Marc')
  })

  it('should_never_call_anonymizer_when_task_is_local', async () => {
    const h = createGatewayHarness()
    h.ollama.enqueue({ raw: { categorySlug: 'achat', nature: 'action' } })
    await h.gateway.run({ kind: 'categoriser', input: 'secret local', schema: CategoryOut })
    expect(h.anonymized).toEqual([])
  })

  it('should_fail_without_sending_when_anonymization_fails', async () => {
    const h = createGatewayHarness({
      anonymizer: {
        anonymize: async () => {
          throw new Error('échec')
        }
      }
    })
    const result = await h.gateway.run({ kind: 'synthetiser', input: 'x', schema: Echo })
    expect(result).toMatchObject({ ok: false, error: { code: 'ANONYMIZATION_FAILED' } })
    expect(h.claude.requests).toHaveLength(0)
  })

  it('should_queue_local_request_when_ollama_is_down_and_fallback_disabled', async () => {
    const h = createGatewayHarness()
    h.ollama.setAvailable(false)
    const result = await h.gateway.run({ kind: 'categoriser', input: 'x', schema: CategoryOut, requestId: 'r1' })
    expect(result).toMatchObject({ ok: false, error: { code: 'QUEUED' } })
    expect(h.queued).toEqual(['r1'])
    expect(h.claude.requests).toHaveLength(0)
  })

  it('should_use_claude_with_anonymization_when_ollama_is_down_and_fallback_allowed', async () => {
    const h = createGatewayHarness({ config: () => ({ routing: DEFAULT_ROUTING, allowClaudeFallback: true }) })
    h.ollama.setAvailable(false)
    h.claude.enqueue({ raw: { categorySlug: 'achat', nature: 'action' } })
    const result = await h.gateway.run({ kind: 'categoriser', input: 'x', schema: CategoryOut })
    expect(result).toMatchObject({ ok: true, value: { engine: 'claude' } })
    expect(h.anonymized).toHaveLength(1)
  })

  it('should_run_degraded_locally_when_claude_is_down_and_degraded_allowed', async () => {
    const h = createGatewayHarness()
    h.claude.setAvailable(false)
    h.ollama.enqueue({ raw: { answer: 'local' } })
    const result = await h.gateway.run({ kind: 'etendre', input: 'x', schema: Echo, allowDegraded: true })
    expect(result).toMatchObject({ ok: true, value: { engine: 'ollama', degraded: true } })
  })

  it('should_report_unavailable_when_claude_is_down_and_degraded_not_allowed', async () => {
    const h = createGatewayHarness()
    h.claude.setAvailable(false)
    const result = await h.gateway.run({ kind: 'etendre', input: 'x', schema: Echo })
    expect(result).toMatchObject({ ok: false, error: { code: 'AI_UNAVAILABLE', retryable: true } })
  })

  it('should_block_remote_call_when_budget_refuses', async () => {
    const h = createGatewayHarness({
      budget: { check: async () => ({ allowed: false }), record: async () => undefined }
    })
    const result = await h.gateway.run({ kind: 'synthetiser', input: 'x', schema: Echo })
    expect(result).toMatchObject({ ok: false, error: { code: 'BUDGET_EXCEEDED' } })
    expect(h.claude.requests).toHaveLength(0)
  })

  it('should_reuse_previous_result_when_same_request_id_is_replayed', async () => {
    const h = createGatewayHarness()
    h.claude.enqueue({ raw: { answer: 'une fois' } })
    await h.gateway.run({ kind: 'synthetiser', input: 'x', schema: Echo, requestId: 'same' })
    const again = await h.gateway.run({ kind: 'synthetiser', input: 'x', schema: Echo, requestId: 'same' })
    expect(again).toMatchObject({ ok: true, value: { data: { answer: 'une fois' } } })
    expect(h.claude.requests).toHaveLength(1)
  })

  it('should_log_call_metadata_without_content_when_call_succeeds', async () => {
    const h = createGatewayHarness()
    h.claude.enqueue({ raw: { answer: 'ok' } })
    await h.gateway.run({ kind: 'synthetiser', input: 'contenu secret', schema: Echo })
    expect(h.calls).toHaveLength(1)
    expect(JSON.stringify(h.calls[0])).not.toContain('contenu secret')
    expect(h.calls[0]).toMatchObject({ kind: 'synthetiser', engine: 'claude', status: 'ok' })
  })

  it('should_run_local_requests_one_at_a_time_when_called_concurrently', async () => {
    const h = createGatewayHarness()
    let active = 0
    let maxActive = 0
    const original = h.ollama.complete.bind(h.ollama)
    h.ollama.complete = async (request) => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active -= 1
      return original(request)
    }
    h.ollama.enqueue(...Array.from({ length: 4 }, () => ({ raw: { categorySlug: 'achat', nature: 'action' } })))
    await Promise.all(
      Array.from({ length: 4 }, () => h.gateway.run({ kind: 'categoriser', input: 'x', schema: CategoryOut }))
    )
    expect(maxActive).toBe(1)
  })
})
