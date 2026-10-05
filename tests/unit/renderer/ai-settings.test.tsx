import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AiSettingsPage } from '../../../src/renderer/src/pages/settings/ai/AiSettingsPage'
import type { AiConfigView, AiStatusView } from '../../../src/shared/ipc/ai'
import { installFakeApi } from './support/fakeApi'

const status: AiStatusView = {
  ollama: { up: true, model: 'qwen3.5:9b', guidance: [] },
  claude: { ready: true }
}
const config: AiConfigView = {
  claudeModel: 'claude-opus-5-5',
  elementModel: 'claude-sonnet-5-5',
  widgetModel: 'claude-sonnet-5-5',
  localModel: 'qwen3.5:9b',
  allowClaudeFallback: false
}

describe('Réglages › IA (spec 010)', () => {
  it('should_show_claude_code_and_the_models_per_use_without_any_api_key_or_budget', async () => {
    const api = installFakeApi({
      'ai:status': () => status,
      'ai:getConfig': () => config,
      'ai:setConfig': (patch) => ({ ...config, ...(patch as object) })
    })
    render(<AiSettingsPage />)
    expect(await screen.findByText('● Prêt')).toBeTruthy()
    expect(screen.queryByText(/Clé API/)).toBeNull()
    expect(screen.queryByText(/Budget mensuel/)).toBeNull()
    expect((screen.getByLabelText(/Genesis/) as HTMLSelectElement).value).toBe('claude-opus-5-5')
    expect((screen.getByLabelText(/Éléments de projet/) as HTMLSelectElement).value).toBe('claude-sonnet-5-5')
    await userEvent.selectOptions(screen.getByLabelText(/Éléments de projet/), 'claude-haiku-4-5')
    expect(api.invoke).toHaveBeenCalledWith('ai:setConfig', { elementModel: 'claude-haiku-4-5' })
  })

  it('should_explain_when_claude_code_is_missing', async () => {
    installFakeApi({
      'ai:status': () => ({
        ...status,
        claude: { ready: false, reason: 'Claude Code est introuvable sur cette machine' }
      }),
      'ai:getConfig': () => config
    })
    render(<AiSettingsPage />)
    expect(await screen.findByText(/Indisponible — Claude Code est introuvable/)).toBeTruthy()
  })
})
