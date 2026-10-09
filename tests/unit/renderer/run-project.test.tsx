import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { RunScriptsView, RunView } from '../../../src/shared/run/run'
import { RunButton } from '../../../src/renderer/src/run/RunButton'
import { RunPanel } from '../../../src/renderer/src/run/RunPanel'
import { stripAnsi, useRuns } from '../../../src/renderer/src/run/runStore'
import { expectNoAxeViolations } from '../../support/axe'
import { installFakeApi } from './support/fakeApi'

const G = '00000000-0000-4000-8000-000000000025'
const R = '00000000-0000-4000-8000-0000000000f1'

const scripts = (extra: Partial<RunScriptsView> = {}): RunScriptsView => ({
  trusted: true,
  hasPackage: true,
  scripts: [
    { name: 'dev', command: 'vite' },
    { name: 'build', command: 'vite build' }
  ],
  favorite: 'dev',
  ...extra
})
const run = (extra: Partial<RunView> = {}): RunView => ({
  runId: R,
  genesisId: G,
  project: 'projet-fictif',
  script: 'dev',
  state: 'running',
  exitCode: null,
  startedAt: '2026-10-10T10:00:00Z',
  output: '',
  ...extra
})

function renderButton(handlers: Parameters<typeof installFakeApi>[0]) {
  const api = installFakeApi(handlers)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    api,
    ...render(
      <QueryClientProvider client={client}>
        <RunButton genesisId={G} />
        <RunPanel />
      </QueryClientProvider>
    )
  }
}

describe('lancer un projet (spec 025)', () => {
  beforeEach(() => useRuns.setState({ runs: [], activeId: null, open: false }))

  it('should_launch_the_favorite_script_and_show_its_output_until_stopped', async () => {
    const user = userEvent.setup()
    const { api, container } = renderButton({
      'run:scripts': () => scripts(),
      'run:start': () => {
        useRuns.getState().upsert(run())
        return run()
      },
      'run:stop': () => ({ ok: true })
    })
    await user.click(await screen.findByRole('button', { name: 'Lancer le script dev' }))
    expect(api.invoke).toHaveBeenCalledWith('run:start', { genesisId: G, script: 'dev' })
    act(() => useRuns.getState().append({ runId: R, chunk: '\x1b[32m  VITE prêt\x1b[0m sur http://localhost:5173\n' }))
    const log = await screen.findByRole('log', { name: 'Sortie de projet-fictif · dev' })
    expect(log.textContent).toContain('VITE prêt sur http://localhost:5173')
    expect(log.textContent).not.toContain('\x1b')
    await expectNoAxeViolations(container)
    await user.click(screen.getByRole('button', { name: 'Arrêter le script dev' }))
    expect(api.invoke).toHaveBeenCalledWith('run:stop', { runId: R })
    act(() => useRuns.getState().upsert(run({ state: 'stopped' })))
    expect(await screen.findByText(/— arrêté/)).toBeDefined()
    expect(screen.getByRole('button', { name: 'Relancer' })).toBeDefined()
  })

  it('should_change_the_favorite_script', async () => {
    const user = userEvent.setup()
    const { api } = renderButton({
      'run:scripts': () => scripts(),
      'run:setFavorite': () => scripts({ favorite: 'build' })
    })
    await user.selectOptions(await screen.findByLabelText('Script favori'), 'build')
    await waitFor(() => expect(api.invoke).toHaveBeenCalledWith('run:setFavorite', { genesisId: G, script: 'build' }))
    expect(await screen.findByRole('button', { name: 'Lancer le script build' })).toBeDefined()
  })

  it('should_explain_and_confirm_before_trusting_a_project', async () => {
    const user = userEvent.setup()
    let trusted = false
    const { api, container } = renderButton({
      'run:scripts': () => scripts({ trusted }),
      'project:trust': () => {
        trusted = true
        return scripts()
      }
    })
    await user.click(await screen.findByRole('button', { name: '🔒 Lancer…' }))
    const dialog = screen.getByRole('dialog', { name: 'Faire confiance à ce projet' })
    expect(dialog.textContent).toMatch(/hooks git/)
    await expectNoAxeViolations(container)
    expect(api.invoke).not.toHaveBeenCalledWith('project:trust', expect.anything())
    await user.click(screen.getByRole('button', { name: 'Faire confiance' }))
    await waitFor(() =>
      expect(api.invoke).toHaveBeenCalledWith('project:trust', { genesisId: G, trusted: true, confirm: true })
    )
    expect(await screen.findByRole('button', { name: 'Lancer le script dev' })).toBeDefined()
  })

  it('should_show_nothing_without_a_package_json_and_strip_terminal_colors', async () => {
    renderButton({ 'run:scripts': () => scripts({ hasPackage: false, scripts: [], favorite: null }) })
    await waitFor(() => expect(screen.queryByRole('button', { name: /Lancer/ })).toBeNull())
    expect(stripAnsi('\x1b[1m\x1b[36mok\x1b[39m\x1b[22m')).toBe('ok')
  })
})
