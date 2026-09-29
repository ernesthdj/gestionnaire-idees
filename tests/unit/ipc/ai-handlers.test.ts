import { rmSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { ProviderError } from '../../../src/main/application/ai/AIProvider'
import { createAiRoutesHarness } from '../../support/aiRoutes'

const KEY = 'sk-ant-api03-fictive0000000000000000000000abcd'

describe('canaux ai:*', () => {
  const harnesses: { dir: string }[] = []
  const make = (...args: Parameters<typeof createAiRoutesHarness>) => {
    const h = createAiRoutesHarness(...args)
    harnesses.push(h)
    return h
  }
  afterEach(() => {
    for (const h of harnesses.splice(0)) rmSync(h.dir, { recursive: true, force: true })
  })

  it('should_store_key_and_return_masked_form_when_key_is_valid', async () => {
    const h = make()
    const result = await h.dispatch('ai:setClaudeKey', { key: KEY })
    expect(result).toEqual({ success: true, data: { configured: true, masked: 'sk-ant-…abcd' } })
    expect(h.secrets.get('claude')).toBe(KEY)
  })

  it('should_reject_key_when_format_is_invalid', async () => {
    const h = make()
    await expect(h.dispatch('ai:setClaudeKey', { key: 'pas-une-cle' })).resolves.toMatchObject({
      success: false,
      error: { code: 'VALIDATION' }
    })
    expect(h.secrets.get('claude')).toBeNull()
  })

  it('should_never_return_key_in_clear_when_reading_status', async () => {
    const h = make()
    await h.dispatch('ai:setClaudeKey', { key: KEY })
    const status = await h.dispatch('ai:status', undefined)
    expect(JSON.stringify(status)).not.toContain(KEY)
    expect(status).toMatchObject({ success: true, data: { claude: { configured: true, maskedKey: 'sk-ant-…abcd' } } })
  })

  it('should_forget_key_when_cleared', async () => {
    const h = make()
    await h.dispatch('ai:setClaudeKey', { key: KEY })
    await h.dispatch('ai:clearClaudeKey', undefined)
    await expect(h.dispatch('ai:status', undefined)).resolves.toMatchObject({
      data: { claude: { configured: false } }
    })
  })

  it('should_report_budget_in_cents_and_state_when_reading_status', async () => {
    const h = make()
    h.setSpent(815_400)
    await expect(h.dispatch('ai:status', undefined)).resolves.toMatchObject({
      data: { budget: { spentCents: 816, capCents: 1000, state: 'alert' } }
    })
  })

  it('should_update_only_allowed_fields_when_setting_config', async () => {
    const h = make()
    await expect(
      h.dispatch('ai:setConfig', { capCents: 2000, claudeModel: 'claude-sonnet-5-5' })
    ).resolves.toMatchObject({
      success: true,
      data: { capCents: 2000, claudeModel: 'claude-sonnet-5-5' }
    })
    await expect(h.dispatch('ai:getConfig', undefined)).resolves.toMatchObject({ data: { maskAmounts: false } })
    await expect(h.dispatch('ai:setConfig', { maskAmounts: true })).resolves.toMatchObject({
      data: { maskAmounts: true }
    })
    await expect(h.dispatch('ai:setConfig', { routing: {} })).resolves.toMatchObject({ error: { code: 'VALIDATION' } })
    await expect(h.dispatch('ai:setConfig', { claudeModel: 'gpt-5' })).resolves.toMatchObject({
      error: { code: 'VALIDATION' }
    })
  })

  it('should_unlock_current_month_when_confirmed', async () => {
    const h = make()
    await h.dispatch('ai:unlockBudget', { confirm: true })
    expect(h.config().unlockedMonth).toBe('2026-09')
    await expect(h.dispatch('ai:unlockBudget', { confirm: false })).resolves.toMatchObject({
      error: { code: 'VALIDATION' }
    })
  })

  it('should_report_latency_when_claude_test_succeeds', async () => {
    const h = make()
    await expect(h.dispatch('ai:test', { engine: 'claude' })).resolves.toMatchObject({
      success: true,
      data: { ok: true, latencyMs: expect.any(Number) }
    })
  })

  it('should_explain_refused_key_when_claude_test_fails_authentication', async () => {
    const h = make()
    h.setClaudePing(async () => {
      throw new ProviderError('AUTH_FAILED', 'Clé API refusée', false)
    })
    await expect(h.dispatch('ai:test', { engine: 'claude' })).resolves.toMatchObject({
      data: { ok: false, reason: expect.stringMatching(/clé/i) }
    })
  })

  it('should_not_expose_config_secrets_when_reading_config', async () => {
    const h = make()
    await h.dispatch('ai:setClaudeKey', { key: KEY })
    const config = await h.dispatch('ai:getConfig', undefined)
    expect(JSON.stringify(config)).not.toContain(KEY)
  })
})
