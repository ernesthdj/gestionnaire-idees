import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AnalystePage } from '../../../src/renderer/src/analyste/AnalystePage'
import type { AnalysisView, ProposalView } from '../../../src/shared/ipc/analyste'
import { expectNoAxeViolations } from '../../support/axe'
import { FakeIpcError, installFakeApi } from './support/fakeApi'

const ID = '5b1f0c1e-9a4b-4c3d-8e2f-0a1b2c3d4e5f'

const DONE: AnalysisView = {
  id: ID,
  trigger: 'manual',
  status: 'done',
  windowFrom: 1_760_000_000_000,
  windowTo: 1_760_600_000_000,
  events: 393,
  proposals: 1,
  errorCode: null,
  startedAt: 1_760_600_000_000,
  finishedAt: 1_760_600_100_000
}

const PROPOSAL: ProposalView = {
  id: 'p1',
  analysisId: ID,
  category: 'ia_vers_code',
  title: 'Remplacer categoriser par une règle',
  finding: 'La même entrée revient sans cesse. <img src=x onerror=alert(1)>',
  proposal: 'Une table de correspondance suffit.',
  gain: 'Moins d’appels à l’IA locale.',
  risk: 'moyen',
  severity: 3,
  confidence: 0.75,
  evidence: {
    observations: [
      { key: 'obs:ia:1', sentence: 'La tâche categoriser a rendu 23 fois la même réponse pour la même entrée.' }
    ],
    code: [{ path: 'src/main/domain/ai/routing.ts', start: 10, end: 20 }]
  },
  files: ['src/main/domain/ai/routing.ts'],
  withoutEvidence: false,
  status: 'new',
  refusalReason: null,
  createdAt: 1_760_600_100_000
}

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AnalystePage />
    </QueryClientProvider>
  )

describe('page Analyste (spec 019 US2)', () => {
  it('should_show_proposals_with_category_severity_and_evidence_sentences_as_plain_text', async () => {
    installFakeApi({
      'analyste:analyses': () => [DONE],
      'analyste:proposals': () => ({ items: [PROPOSAL] })
    })
    const { container } = renderPage()
    expect(await screen.findByRole('heading', { name: 'Remplacer categoriser par une règle' })).toBeTruthy()
    expect(screen.getByText('Tâche IA → code')).toBeTruthy()
    expect(screen.getByText(/Gravité : Élevée/)).toBeTruthy()
    expect(screen.getByText(/La tâche categoriser a rendu 23 fois/)).toBeTruthy()
    expect(screen.getByText('(obs:ia:1)')).toBeTruthy()
    expect(screen.getByText('src/main/domain/ai/routing.ts:10–20')).toBeTruthy()
    expect(screen.getByText(/Dernière analyse : .* 393 observations · 1 proposition gardée/)).toBeTruthy()
    // Texte jamais interprété comme du code de page (FR-026).
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText(/<img src=x onerror=alert\(1\)>/)).toBeTruthy()
    await expectNoAxeViolations(container)
  })

  it('should_offer_to_analyse_anyway_when_there_are_few_new_observations', async () => {
    const user = userEvent.setup()
    const api = installFakeApi({
      'analyste:analyses': () => [],
      'analyste:proposals': () => ({ items: [] }),
      'analyste:analyze': (payload) => {
        if ((payload as { force?: boolean }).force !== true) {
          throw new FakeIpcError('NOT_ENOUGH_DATA', { events: 12, minEvents: 200 })
        }
        return { analysisId: ID }
      }
    })
    const { container } = renderPage()
    expect(await screen.findByText(/Aucune proposition à trier/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Analyser maintenant' }))
    expect((await screen.findByRole('alert')).textContent).toContain('12 pour un seuil de 200')
    await expectNoAxeViolations(container)
    await user.click(screen.getByRole('button', { name: 'Analyser quand même' }))
    expect(api.invoke).toHaveBeenCalledWith('analyste:analyze', { force: true })
    expect(await screen.findByText('Préparation du dossier d’analyse…')).toBeTruthy()
  })

  it('should_follow_progress_then_show_the_result_and_allow_cancelling', async () => {
    const user = userEvent.setup()
    const api = installFakeApi({
      'analyste:analyses': () => [],
      'analyste:proposals': () => ({ items: [] }),
      'analyste:analyze': () => ({ analysisId: ID }),
      'analyste:cancel': () => ({ ok: true })
    })
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Analyser maintenant' }))
    act(() => api.emit('analyste:progress', { analysisId: ID, step: 'claude' }))
    expect(screen.getByText(/Claude lit le dépôt et analyse/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Analyser maintenant' }) as HTMLButtonElement).disabled).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Annuler l’analyse' }))
    expect(api.invoke).toHaveBeenCalledWith('analyste:cancel', { analysisId: ID })
    act(() => api.emit('analyste:progress', { analysisId: ID, step: 'fini', proposals: 2 }))
    expect(screen.getByText('Analyse terminée : 2 propositions gardées.')).toBeTruthy()
  })

  it('should_show_a_clear_error_when_claude_code_is_unavailable_instead_of_waiting_forever', async () => {
    const user = userEvent.setup()
    const api = installFakeApi({
      'analyste:analyses': () => [],
      'analyste:proposals': () => ({ items: [] }),
      'analyste:analyze': () => ({ analysisId: ID })
    })
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Analyser maintenant' }))
    act(() => api.emit('analyste:progress', { analysisId: ID, step: 'echec', errorCode: 'AUTH_FAILED' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Claude Code n’est pas connecté')
    expect((screen.getByRole('button', { name: 'Analyser maintenant' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('should_show_an_error_when_the_proposals_cannot_be_read', async () => {
    installFakeApi({
      'analyste:analyses': () => [],
      'analyste:proposals': () => {
        throw new FakeIpcError('PROBE_INACTIVE')
      }
    })
    renderPage()
    expect((await screen.findByRole('alert')).textContent).toContain('La sonde est inactive')
  })

  it('should_show_status_tabs_and_send_triage_decisions_then_clear_closed_history', async () => {
    const counts = { todo: 1, progress: 0, kept: 1, dismissed: 1 }
    const decide = vi.fn((payload: unknown) => ({ ...PROPOSAL, status: 'refused', ...(payload as object) }))
    const clear = vi.fn(() => ({ deleted: 2 }))
    installFakeApi({
      'analyste:analyses': () => [DONE],
      'analyste:proposals': (payload) =>
        (payload as { tab: string }).tab === 'kept'
          ? { items: [{ ...PROPOSAL, id: 'p2', title: 'Proposition appliquée', status: 'applied' }], counts }
          : { items: [PROPOSAL], counts },
      'analyste:decide': decide,
      'analyste:proposals:clear': clear
    })
    const { container } = renderPage()
    expect(await screen.findByRole('tab', { name: 'À trier (1)' })).toBeTruthy()
    expect(screen.getByText('À trier', { selector: 'span' })).toBeTruthy()
    await expectNoAxeViolations(container)
    await userEvent.click(screen.getByRole('button', { name: 'Refuser…' }))
    await userEvent.click(screen.getByRole('button', { name: 'Pas utile' }))
    expect(decide).toHaveBeenCalledWith({ id: 'p1', decision: 'refuse', reason: 'Pas utile' })
    await userEvent.click(screen.getByRole('button', { name: 'Déjà appliquée' }))
    expect(decide).toHaveBeenLastCalledWith({ id: 'p1', decision: 'applied' })
    await userEvent.click(screen.getByRole('tab', { name: 'Installées (1)' }))
    expect(await screen.findByText('Installée (hors app)')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Vider l’historique…' }))
    expect(clear).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Vider l’historique' }))
    expect(clear).toHaveBeenCalledWith({ confirm: true })
  })
})
