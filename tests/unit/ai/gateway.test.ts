import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { CategoryOut } from '../../../src/shared/ai/schemas'
import { createGatewayHarness } from '../../support/gateway'

const Echo = z.object({ answer: z.string() })

describe('AIGateway — routage, file, journal (spec 010 : catégorisation locale, widgets par Claude)', () => {
  it('should_send_the_widget_request_to_claude_untouched_when_the_task_is_remote', async () => {
    const h = createGatewayHarness()
    h.claude.enqueue({ raw: { answer: 'ok' } })
    await h.gateway.run({ kind: 'widget', input: 'Un compteur pour Marc', schema: Echo })
    expect(h.claude.requests[0]?.user).toContain('Un compteur pour Marc')
    expect(h.ollama.requests).toHaveLength(0)
  })

  it('should_categorize_locally_when_ollama_is_up', async () => {
    const h = createGatewayHarness()
    h.ollama.enqueue({ raw: { categorySlug: 'achat', nature: 'action' } })
    const result = await h.gateway.run({ kind: 'categoriser', input: 'Acheter un 70-200', schema: CategoryOut })
    expect(result).toMatchObject({ ok: true, value: { engine: 'ollama' } })
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

  it('should_fail_without_queueing_when_ollama_is_down_and_the_request_is_a_replay', async () => {
    const h = createGatewayHarness()
    h.ollama.setAvailable(false)
    const result = await h.gateway.run({ kind: 'categoriser', input: 'x', schema: CategoryOut, noQueue: true })
    expect(result).toMatchObject({ ok: false, error: { code: 'AI_UNAVAILABLE' } })
    expect(h.queued).toEqual([])
  })

  it('should_use_claude_when_ollama_is_down_and_fallback_allowed', async () => {
    const h = createGatewayHarness({ config: () => ({ allowClaudeFallback: true }) })
    h.ollama.setAvailable(false)
    h.claude.enqueue({ raw: { categorySlug: 'achat', nature: 'action' } })
    const result = await h.gateway.run({ kind: 'categoriser', input: 'x', schema: CategoryOut })
    expect(result).toMatchObject({ ok: true, value: { engine: 'claude' } })
  })

  it('should_announce_no_engine_when_the_request_is_queued', async () => {
    const h = createGatewayHarness()
    h.ollama.setAvailable(false)
    const announced: string[] = []
    await h.gateway.run({ kind: 'categoriser', input: 'x', schema: CategoryOut, onEngine: (e) => announced.push(e) })
    expect(announced).toEqual([])
  })

  it('should_announce_the_task_model_when_claude_works', async () => {
    const h = createGatewayHarness({
      config: () => ({ allowClaudeFallback: false, claudeModelFor: () => 'claude-sonnet-5-5' })
    })
    h.claude.enqueue({ raw: { answer: 'ok' } })
    const announced: string[] = []
    await h.gateway.run({
      kind: 'widget',
      input: 'x',
      schema: Echo,
      onEngine: (engine, model) => announced.push(`${engine}/${model}`)
    })
    expect(announced).toEqual(['claude/claude-sonnet-5-5'])
    expect(h.claude.requests[0]?.model).toBe('claude-sonnet-5-5')
  })

  it('should_report_unavailable_when_claude_is_down_for_a_widget', async () => {
    const h = createGatewayHarness()
    h.claude.setAvailable(false)
    const result = await h.gateway.run({ kind: 'widget', input: 'x', schema: Echo })
    expect(result).toMatchObject({ ok: false, error: { code: 'AI_UNAVAILABLE', retryable: true } })
    expect(h.ollama.requests).toHaveLength(0)
  })

  it('should_append_the_verbatim_text_after_the_request', async () => {
    const h = createGatewayHarness()
    h.claude.enqueue({ raw: { answer: 'ok' } })
    await h.gateway.run({ kind: 'widget', input: 'Ajoute un bouton', schema: Echo, verbatim: '=== html ===\n<p></p>' })
    const user = h.claude.requests[0]?.user ?? ''
    expect(user.indexOf('Ajoute un bouton')).toBeLessThan(user.indexOf('=== html ==='))
  })

  it('should_reuse_previous_result_when_same_request_id_is_replayed', async () => {
    const h = createGatewayHarness()
    h.claude.enqueue({ raw: { answer: 'une fois' } })
    await h.gateway.run({ kind: 'widget', input: 'x', schema: Echo, requestId: 'same' })
    const again = await h.gateway.run({ kind: 'widget', input: 'x', schema: Echo, requestId: 'same' })
    expect(again).toMatchObject({ ok: true, value: { data: { answer: 'une fois' } } })
    expect(h.claude.requests).toHaveLength(1)
  })

  it('should_log_call_metadata_without_content_when_call_succeeds', async () => {
    const h = createGatewayHarness()
    h.claude.enqueue({ raw: { answer: 'ok' } })
    await h.gateway.run({ kind: 'widget', input: 'contenu secret', schema: Echo })
    expect(h.calls).toHaveLength(1)
    expect(JSON.stringify(h.calls[0])).not.toContain('contenu secret')
    expect(h.calls[0]).toMatchObject({ kind: 'widget', engine: 'claude', status: 'ok', costMillicents: 0 })
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

  it('should_send_the_imported_examples_with_the_task', async () => {
    const h = createGatewayHarness({
      context: async () => ({ profile: '', rules: '', examples: [{ polarity: 'positive', input: 'Marc', output: {} }] })
    })
    h.ollama.enqueue({ raw: { categorySlug: 'achat', nature: 'action' } })
    await h.gateway.run({ kind: 'categoriser', input: 'x', schema: CategoryOut })
    expect(h.ollama.requests[0]?.system.map((block) => block.text).join(' ')).toContain('Marc')
  })
})
