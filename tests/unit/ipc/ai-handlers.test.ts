import { describe, expect, it } from 'vitest'
import type { AiConfigView, AiStatusView, AiTestView } from '../../../src/shared/ipc/ai'
import { MAIN_WINDOW_CHANNELS } from '../../../src/shared/ipc/channels'
import { createAiRoutesHarness } from '../../support/aiRoutes'

const data = <T>(result: { success: boolean; data?: unknown }): T => {
  if (!result.success) throw new Error('échec')
  return result.data as T
}

describe('canaux IA (spec 010 : Claude Code, plus de clé API)', () => {
  it('should_report_ollama_and_claude_code_states', async () => {
    const harness = createAiRoutesHarness()
    harness.setClaude({ up: false, reason: 'Claude Code est introuvable sur cette machine' })
    const status = data<AiStatusView>(await harness.dispatch('ai:status', undefined))
    expect(status.ollama).toMatchObject({ up: true, model: 'qwen3.5:9b', guidance: [] })
    expect(status.claude).toEqual({ ready: false, reason: 'Claude Code est introuvable sur cette machine' })
  })

  it('should_expose_the_models_per_use_with_opus_for_genesis_and_sonnet_for_elements_and_widgets', async () => {
    const config = data<AiConfigView>(await createAiRoutesHarness().dispatch('ai:getConfig', undefined))
    expect(config).toEqual({
      claudeModel: 'claude-opus-5-5',
      elementModel: 'claude-sonnet-5-5',
      widgetModel: 'claude-sonnet-5-5',
      localModel: 'qwen3.5:9b',
      allowClaudeFallback: false
    })
  })

  it('should_update_only_allowed_fields_and_refuse_unknown_models', async () => {
    const harness = createAiRoutesHarness()
    const updated = data<AiConfigView>(await harness.dispatch('ai:setConfig', { elementModel: 'claude-haiku-4-5' }))
    expect(updated.elementModel).toBe('claude-haiku-4-5')
    expect((await harness.dispatch('ai:setConfig', { elementModel: 'gpt-5' })).success).toBe(false)
    expect((await harness.dispatch('ai:setConfig', { capCents: 500 })).success).toBe(false)
  })

  it('should_test_claude_code_without_spending_tokens', async () => {
    const harness = createAiRoutesHarness()
    expect(data<AiTestView>(await harness.dispatch('ai:test', { engine: 'claude' })).ok).toBe(true)
    harness.setClaude({ up: false })
    expect(data<AiTestView>(await harness.dispatch('ai:test', { engine: 'claude' }))).toEqual({
      ok: false,
      reason: 'Claude Code introuvable'
    })
  })

  it('should_no_longer_offer_any_api_key_or_budget_channel', () => {
    const channels = MAIN_WINDOW_CHANNELS as readonly string[]
    for (const gone of ['ai:setClaudeKey', 'ai:clearClaudeKey', 'ai:unlockBudget']) expect(channels).not.toContain(gone)
  })
})
