import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AiSettingsPage } from '../../../src/renderer/src/pages/settings/ai/AiSettingsPage'
import type { AiConfigView, AiStatusView } from '../../../src/shared/ipc/ai'
import { expectNoAxeViolations } from '../../support/axe'
import { installFakeApi } from './support/fakeApi'

const status: AiStatusView = {
  ollama: { up: true, model: 'qwen3.5:9b', guidance: [] },
  claude: { ready: true }
}
/** État d'un moteur : la pastille (décorative) et le texte sont dans deux nœuds du même paragraphe. */
const engineState =
  (text: string) =>
  (_content: string, element: Element | null): boolean =>
    element?.tagName === 'P' && element.textContent === text
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
    expect(await screen.findByText(engineState('● Prêt'))).toBeTruthy()
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

describe('Réglages › IA — accessibilité (spec 001 T043)', () => {
  const down = {
    ...status,
    ollama: { up: false, model: 'qwen3.5:9b', reason: 'Ollama ne répond pas', guidance: ['Lance Ollama.'] }
  }

  it('should_have_no_axe_violation_and_name_every_control_distinctly', async () => {
    installFakeApi({ 'ai:status': () => down, 'ai:getConfig': () => config })
    const { container } = render(<AiSettingsPage />)
    await screen.findByText(/Ollama ne répond pas/)
    await expectNoAxeViolations(container)
    // La page vit dans le <main> de l'app : pas de second repère principal.
    expect(container.querySelector('main')).toBeNull()
    expect(screen.getByRole('button', { name: 'Revérifier Claude Code' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Revérifier l’IA locale' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Enregistrer le modèle local' })).toBeTruthy()
    // Nom court, aide en description.
    const genesis = screen.getByRole('combobox', { name: 'Genesis (idées, projets)' })
    expect(document.getElementById(genesis.getAttribute('aria-describedby') ?? '')?.textContent).toMatch(/Cadrage/)
    // L'état ne passe pas que par la couleur, et la pastille n'est pas lue.
    expect(screen.getByText(/Indisponible — Ollama/).querySelector('[aria-hidden="true"]')?.textContent).toBe('● ')
    expect(screen.getByText(/Indisponible — Ollama/).className).toBe('text-idea')
  })

  it('should_reach_every_control_with_the_keyboard_in_reading_order', async () => {
    installFakeApi({ 'ai:status': () => status, 'ai:getConfig': () => config })
    render(<AiSettingsPage />)
    await screen.findByText(engineState('● Prêt'))
    const order: string[] = []
    for (let step = 0; step < 8; step += 1) {
      await userEvent.tab()
      const active = document.activeElement as HTMLElement
      order.push(active.getAttribute('aria-label') ?? active.id.split('-').at(-1) ?? active.tagName)
    }
    expect(order[0]).toBe('Revérifier Claude Code')
    expect(order.slice(1, 4)).toEqual(['claudeModel', 'elementModel', 'widgetModel'])
    expect(order[5]).toBe('Enregistrer le modèle local')
    expect(order[6]).toBe('Revérifier l’IA locale')
    expect((document.activeElement as HTMLInputElement).type).toBe('checkbox')
    // La case se coche à la barre d'espace.
    await userEvent.keyboard(' ')
    expect(document.activeElement?.tagName).toBe('INPUT')
  })

  it('should_keep_the_focus_on_a_button_while_its_check_runs', async () => {
    let finish: (value: unknown) => void = () => undefined
    const api = installFakeApi({
      'ai:status': () => status,
      'ai:getConfig': () => config,
      'ai:test': () => new Promise((resolve) => (finish = resolve))
    })
    render(<AiSettingsPage />)
    const button = await screen.findByRole('button', { name: 'Revérifier Claude Code' })
    button.focus()
    await userEvent.keyboard('{Enter}')
    expect(document.activeElement).toBe(button)
    expect(button.getAttribute('aria-disabled')).toBe('true')
    // Une seconde demande pendant la première est ignorée.
    await userEvent.keyboard('{Enter}')
    expect(api.invoke.mock.calls.filter(([channel]) => channel === 'ai:test')).toHaveLength(1)
    finish({ ok: true })
    expect(await screen.findByText('Claude Code est prête.')).toBeTruthy()
    expect(document.activeElement).toBe(button)
  })
})
