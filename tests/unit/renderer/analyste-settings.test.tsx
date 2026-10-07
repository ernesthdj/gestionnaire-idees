import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AnalysteSettings } from '../../../src/renderer/src/pages/settings/AnalysteSettings'
import type { AnalysteStatusView } from '../../../src/shared/ipc/analyste'
import { expectNoAxeViolations } from '../../support/axe'
import { FakeIpcError, installFakeApi } from './support/fakeApi'

const INACTIVE: AnalysteStatusView = {
  available: true,
  active: false,
  repoPath: null,
  reason: 'NOT_DESIGNATED',
  observations: 0,
  dropped: 0
}
const ACTIVE: AnalysteStatusView = {
  ...INACTIVE,
  active: true,
  repoPath: 'D:/dev/brainstormer',
  reason: null,
  observations: 2
}
const SETTINGS = { retentionDays: 30, maxEvents: 50_000 }

const renderSettings = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AnalysteSettings />
    </QueryClientProvider>
  )

describe('Réglages › Analyste (spec 019 US1)', () => {
  it('should_explain_and_offer_no_action_when_the_app_is_packaged', async () => {
    installFakeApi({ 'analyste:repo:status': () => ({ ...INACTIVE, available: false, reason: 'PACKAGED_APP' }) })
    const { container } = renderSettings()
    expect(await screen.findByText(/Dans l’app installée, rien n’est collecté/)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    await expectNoAxeViolations(container)
  })

  it('should_designate_the_repository_with_the_native_picker_then_show_the_active_probe', async () => {
    const user = userEvent.setup()
    let status = INACTIVE
    const api = installFakeApi({
      'analyste:repo:status': () => status,
      'analyste:repo:choose': () => {
        status = ACTIVE
        return ACTIVE
      },
      'analyste:settings:get': () => SETTINGS
    })
    const { container } = renderSettings()
    expect(await screen.findByText(/Aucun dépôt désigné/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Désigner le dépôt…' }))
    expect(api.invoke).toHaveBeenCalledWith('analyste:repo:choose', undefined)
    expect(await screen.findByText('Sonde active')).toBeTruthy()
    expect(screen.getByText('D:/dev/brainstormer')).toBeTruthy()
    expect(screen.getByText(/le texte que tu écris/)).toBeTruthy()
    await expectNoAxeViolations(container)
  })

  it('should_show_the_error_instead_of_loading_forever_when_the_status_cannot_be_read', async () => {
    installFakeApi({
      'analyste:repo:status': () => {
        throw new FakeIpcError('VALIDATION')
      }
    })
    renderSettings()
    expect((await screen.findByRole('alert')).textContent).toContain('L’état de l’Analyste est illisible')
  })

  it('should_explain_the_refusal_when_the_folder_is_not_the_brainstormer_repository', async () => {
    const user = userEvent.setup()
    installFakeApi({
      'analyste:repo:status': () => INACTIVE,
      'analyste:repo:choose': () => {
        throw new FakeIpcError('NOT_BRAINSTORMER_REPO')
      },
      'analyste:settings:get': () => SETTINGS
    })
    renderSettings()
    await user.click(await screen.findByRole('button', { name: 'Désigner le dépôt…' }))
    expect(await screen.findByText('NOT_BRAINSTORMER_REPO')).toBeTruthy()
  })

  it('should_ask_for_a_confirmation_before_erasing_the_observations', async () => {
    const user = userEvent.setup()
    const api = installFakeApi({
      'analyste:repo:status': () => ACTIVE,
      'analyste:settings:get': () => SETTINGS,
      'analyste:purge': () => ({ deleted: 2 })
    })
    renderSettings()
    await user.click(await screen.findByRole('button', { name: 'Effacer les observations' }))
    expect(api.invoke).not.toHaveBeenCalledWith('analyste:purge', expect.anything())
    await user.click(screen.getByRole('button', { name: 'Confirmer l’effacement' }))
    expect(api.invoke).toHaveBeenCalledWith('analyste:purge', { confirm: true })
    expect(await screen.findByText('2 observations effacées.')).toBeTruthy()
  })

  it('should_list_observations_with_readable_labels_and_no_content_when_shown', async () => {
    const user = userEvent.setup()
    installFakeApi({
      'analyste:repo:status': () => ACTIVE,
      'analyste:settings:get': () => SETTINGS,
      'analyste:observations': () => ({
        items: [
          {
            id: 2,
            at: 1_760_000_000_000,
            family: 'action',
            event: 'neuron.create',
            screen: null,
            subjectKind: 'neuron',
            subjectRef: 'abcdef012345',
            via: 'clavier',
            channel: null,
            code: null,
            module: null,
            frames: [],
            durationMs: null,
            status: null,
            count: 1
          }
        ],
        next: null,
        totals: { navigation: 0, action: 1, erreur: 0, performance: 0 }
      })
    })
    const { container } = renderSettings()
    await user.click(await screen.findByRole('button', { name: 'Voir les observations' }))
    expect(await screen.findByText('Idée créée')).toBeTruthy()
    expect(screen.getByText('idée · #abcdef · par clavier')).toBeTruthy()
    await expectNoAxeViolations(container)
  })
})
