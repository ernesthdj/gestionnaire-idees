import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { UpdatePanel } from '../../../src/renderer/src/analyste/UpdatePanel'
import type { UpdateView } from '../../../src/shared/ipc/analyste'
import { expectNoAxeViolations } from '../../support/axe'
import { installFakeApi } from './support/fakeApi'

const PROPOSAL = '7b1f0c1e-9a4b-4c3d-8e2f-0a1b2c3d4e5f'
const UPDATE = '8b1f0c1e-9a4b-4c3d-8e2f-0a1b2c3d4e5f'

const view = (patch: Partial<UpdateView> = {}): UpdateView => ({
  id: UPDATE,
  proposalId: PROPOSAL,
  branch: 'analyste/8b1f0c1e-corriger-a',
  folder: 'C:/depot-fictif/.analyste/worktrees/8b1f0c1e',
  status: 'ready',
  checks: {
    typecheck: { status: 'ok' },
    lint: { status: 'ok' },
    prettier: { status: 'ok' },
    test: { status: 'ok' }
  },
  depsChanged: false,
  conversationNeuronId: null,
  createdAt: 1,
  ...patch
})

const wrap = (node: React.ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {node}
  </QueryClientProvider>
)

describe('volet de mise à jour de l’Analyste (spec 019 T035)', () => {
  it('should_show_checks_and_keep_only_after_confirmation_when_all_are_green', async () => {
    const keep = vi.fn(() => view({ status: 'kept' }))
    const attempt = vi.fn(() => ({ command: 'npm run essai', folder: view().folder }))
    installFakeApi({
      'analyste:update:get': () => view(),
      'analyste:update:keep': keep,
      'analyste:update:try': attempt
    })
    const { container } = render(wrap(<UpdatePanel proposalId={PROPOSAL} />))
    expect(await screen.findByText(/Tests : réussie/)).toBeTruthy()
    await expectNoAxeViolations(container)
    await userEvent.click(screen.getByRole('button', { name: 'Essayer' }))
    expect(await screen.findByText('npm run essai')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Garder…' }))
    expect(keep).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Garder' }))
    expect(keep).toHaveBeenCalledWith({ updateId: UPDATE, confirm: true })
  })

  it('should_block_keep_on_a_failed_check_and_explain_dependencies_to_install_by_hand', async () => {
    installFakeApi({
      'analyste:update:get': () =>
        view({
          status: 'to_fix',
          depsChanged: true,
          checks: {
            typecheck: { status: 'fail', tail: 'Erreur fictive.' },
            lint: { status: 'pending' },
            prettier: { status: 'pending' },
            test: { status: 'pending' }
          }
        })
    })
    render(wrap(<UpdatePanel proposalId={PROPOSAL} />))
    expect(await screen.findByText('Erreur fictive.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Garder…' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/L’app n’installe rien elle-même/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Relancer les vérifications' })).toBeTruthy()
  })
})
