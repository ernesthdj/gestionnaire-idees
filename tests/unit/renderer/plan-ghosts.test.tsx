import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { IdeasCanvas } from '../../../src/renderer/src/canvas/IdeasCanvas'
import { DEFAULT_APP_SETTINGS } from '../../../src/shared/ipc/app'
import type { IdeasCanvasView, StepView } from '../../../src/shared/ipc/canvas'
import type { MainWindowChannel } from '../../../src/shared/ipc/channels'
import type { FinalState } from '../../../src/shared/ipc/finals'
import { expectNoAxeViolations } from '../../support/axe'
import { canvasView, HATCHED_A_ID } from '../../fixtures/ui/canvas'
import { FakeIpcError, installFakeApi } from './support/fakeApi'
import { installReactFlowMocks } from './support/reactFlowMocks'

const STEP_1 = '00000000-0000-4000-8000-000000000101'
const STEP_2 = '00000000-0000-4000-8000-000000000102'
const PROPOSAL = '00000000-0000-4000-8000-000000000201'
const GHOST_A = '00000000-0000-4000-8000-000000000301'
const GHOST_B = '00000000-0000-4000-8000-000000000302'

function planView(): IdeasCanvasView {
  const base = canvasView()
  return {
    ...base,
    ideas: base.ideas.map((idea) => (idea.id === HATCHED_A_ID ? { ...idea, locked: true } : idea)),
    steps: [
      {
        id: STEP_1,
        genesisId: HATCHED_A_ID,
        parentId: HATCHED_A_ID,
        depth: 1,
        rank: 1,
        title: 'Valider le budget',
        status: 'en_cours',
        locked: false,
        lockProposed: false,
        waitsFor: [],
        offset: { x: 0, y: 0 }
      }
    ],
    proposals: [
      {
        id: PROPOSAL,
        parentId: HATCHED_A_ID,
        items: [
          { id: GHOST_A, title: 'Choisir le lieu', why: 'Après le budget', rank: 1, waitsFor: [] },
          { id: GHOST_B, title: 'Lancer la com', why: 'Quand le lieu est connu', rank: 2, waitsFor: [GHOST_A] }
        ]
      }
    ]
  }
}

function renderCanvas(
  view: IdeasCanvasView = planView(),
  extra: Partial<Record<MainWindowChannel, (payload: unknown) => unknown>> = {}
) {
  const api = installFakeApi({
    'canvas:get': () => view,
    'canvas:savePositions': () => ({ ok: true }),
    'app:getSettings': () => DEFAULT_APP_SETTINGS,
    'plan:decide': () => ({ batchId: 'b1', born: [GHOST_A] }),
    'final:decide': () => ({ state: 'prete', batchId: 'f1' }),
    'final:demote': () => ({ batchId: 'f2' }),
    'history:list': () => ({ items: [], nextCursor: null }),
    'final:execute': () => ({ executionId: 'e1' }),
    'final:stop': () => ({ ok: true }),
    'commands:get': () => ({
      linked: true,
      packageJson: true,
      scripts: [
        { name: 'test', text: 'vitest run', approved: true, changed: false },
        { name: 'build', text: 'vite build', approved: true, changed: true },
        { name: 'dev', text: 'vite', approved: false, changed: false }
      ]
    }),
    'commands:approve': () => ({ ok: true }),
    ...extra
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(
    <QueryClientProvider client={client}>
      <IdeasCanvas />
    </QueryClientProvider>
  )
  return { api, ...result }
}

describe('plan d’attaque sur la carte (spec 011 US1)', () => {
  beforeAll(() => installReactFlowMocks())
  beforeEach(() =>
    useUiStore.setState({ view: 'ideas', chatNeuronId: null, ghostId: null, finalId: null, viewer: null, toast: null })
  )

  it('should_show_steps_with_their_rank_and_ghosts_with_their_future_rank', async () => {
    renderCanvas()
    expect(
      await screen.findByRole('group', { name: 'Étape ① de « Mission mariage » : Valider le budget, en cours' })
    ).toBeDefined()
    expect(screen.getByRole('group', { name: 'Étape proposée ② : Choisir le lieu' })).toBeDefined()
    expect(screen.getByRole('group', { name: 'Étape proposée ③ : Lancer la com' })).toBeDefined()
    expect(screen.getByText('Claude propose 2 étapes')).toBeDefined()
  })

  it('should_accept_one_ghost_with_its_check_button', async () => {
    const user = userEvent.setup()
    const { api } = renderCanvas()
    await user.click(await screen.findByRole('button', { name: 'Valider l’étape « Choisir le lieu »' }))
    expect(api.invoke).toHaveBeenCalledWith('plan:decide', { proposalId: PROPOSAL, accept: [GHOST_A], reject: [] })
    await waitFor(() => expect(useUiStore.getState().toast?.undoBatchId).toBe('b1'))
  })

  it('should_refuse_one_ghost_with_its_cross_button', async () => {
    const user = userEvent.setup()
    const { api } = renderCanvas()
    await user.click(await screen.findByRole('button', { name: 'Refuser l’étape « Lancer la com »' }))
    expect(api.invoke).toHaveBeenCalledWith('plan:decide', { proposalId: PROPOSAL, accept: [], reject: [GHOST_B] })
  })

  it('should_accept_or_refuse_the_whole_layer_at_once', async () => {
    const user = userEvent.setup()
    const { api } = renderCanvas()
    await user.click(await screen.findByRole('button', { name: 'Tout valider' }))
    expect(api.invoke).toHaveBeenCalledWith('plan:decide', {
      proposalId: PROPOSAL,
      accept: [GHOST_A, GHOST_B],
      reject: []
    })
    await user.click(screen.getByRole('button', { name: 'Tout refuser' }))
    expect(api.invoke).toHaveBeenCalledWith('plan:decide', {
      proposalId: PROPOSAL,
      accept: [],
      reject: [GHOST_A, GHOST_B]
    })
  })

  it('should_open_the_conversation_of_a_step_when_it_is_clicked', async () => {
    renderCanvas()
    fireEvent.click(await screen.findByText('Valider le budget'))
    expect(useUiStore.getState().chatNeuronId).toBe(STEP_1)
  })

  it('should_draw_a_line_from_the_genesis_to_its_steps_and_its_ghosts', async () => {
    const { container } = renderCanvas()
    await screen.findByText('Claude propose 2 étapes')
    await waitFor(() => expect(container.querySelector(`[data-testid="rf__edge-plan-line-${STEP_1}"]`)).not.toBeNull())
    expect(container.querySelector(`[data-testid="rf__edge-plan-line-ghost-${GHOST_A}"]`)).not.toBeNull()
  })

  it('should_show_the_detail_of_a_ghost_before_deciding_and_accept_it_from_there', async () => {
    const user = userEvent.setup()
    const { api } = renderCanvas()
    await user.click(await screen.findByText('Lancer la com'))
    const panel = await screen.findByRole('complementary', { name: 'Étape proposée par Claude' })
    expect(panel.textContent).toContain('Quand le lieu est connu')
    expect(panel.textContent).toContain('② Choisir le lieu (proposée)')
    expect(panel.textContent).toContain('Dans le plan de « Mission mariage »')
    expect(useUiStore.getState().chatNeuronId).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Valider cette étape' }))
    expect(api.invoke).toHaveBeenCalledWith('plan:decide', { proposalId: PROPOSAL, accept: [GHOST_B], reject: [] })
  })

  const finalView = (state: FinalState, waitsFor: readonly string[] = []): IdeasCanvasView => {
    const base = planView()
    return {
      ...base,
      proposals: [],
      steps: base.steps.map((step) => ({
        ...step,
        waitsFor,
        final: { state, deliverable: 'src/pages/Contact.tsx', reason: 'Un seul composant', projectLinked: true }
      }))
    }
  }

  it('should_execute_a_ready_action_and_open_its_conversation', async () => {
    const user = userEvent.setup()
    const { api } = renderCanvas(finalView('prete'))
    await user.click(await screen.findByRole('button', { name: 'Exécuter « Valider le budget »' }))
    expect(api.invoke).toHaveBeenCalledWith('final:execute', { neuronId: STEP_1 })
    await waitFor(() => expect(useUiStore.getState().chatNeuronId).toBe(STEP_1))
  })

  it('should_open_the_panel_on_prerequisites_and_execute_anyway_from_there', async () => {
    const user = userEvent.setup()
    const base = finalView('prete', [STEP_2])
    const devis: StepView = {
      id: STEP_2,
      genesisId: HATCHED_A_ID,
      parentId: HATCHED_A_ID,
      depth: 1,
      rank: 2,
      title: 'Devis',
      status: 'a_faire',
      locked: false,
      lockProposed: false,
      waitsFor: [],
      offset: { x: 0, y: 0 }
    }
    const view: IdeasCanvasView = { ...base, steps: [...base.steps, devis] }
    let calls = 0
    const { api } = renderCanvas(view, {
      'final:execute': () => {
        calls += 1
        if (calls === 1) throw new FakeIpcError('PREREQUISITES', { pending: ['Devis'] })
        return { executionId: 'e1' }
      }
    })
    await user.click(await screen.findByRole('button', { name: 'Exécuter « Valider le budget »' }))
    const panel = await screen.findByRole('complementary', { name: 'Action finale' })
    expect(panel.textContent).toContain('Prérequis pas encore faits : « Devis »')
    await user.click(screen.getByRole('button', { name: 'Exécuter quand même' }))
    expect(api.invoke).toHaveBeenCalledWith('final:execute', { neuronId: STEP_1, force: true })
  })

  it('should_offer_to_stop_a_running_action_and_show_its_deliverable_below_it', async () => {
    const user = userEvent.setup()
    const view: IdeasCanvasView = {
      ...finalView('en_cours'),
      deliverables: [
        {
          neuronId: STEP_1,
          genesisId: HATCHED_A_ID,
          files: [
            { path: 'src/pages/Contact.tsx', status: 'cree' },
            { path: 'README.md', status: 'modifie' }
          ],
          runs: [{ script: 'test', ok: false, timedOut: false, at: '2026-10-06T10:00:00.000Z' }],
          executing: true,
          width: 420,
          height: 300,
          offset: { x: 0, y: 0 }
        }
      ]
    }
    const { api } = renderCanvas(view)
    const deliverable = await screen.findByRole('region', { name: 'Livrable de « Valider le budget »' })
    expect(deliverable.textContent).toContain('Livrable · 2 fichiers')
    expect(deliverable.textContent).toContain('Claude écrit…')
    expect(deliverable.textContent).toContain('src/pages/Contact.tsx')
    expect(within(deliverable).getByRole('list', { name: 'Résultats des commandes' }).textContent).toBe('test ✗')
    await user.click(screen.getByRole('button', { name: 'Arrêter l’exécution de « Valider le budget »' }))
    expect(api.invoke).toHaveBeenCalledWith('final:stop', { neuronId: STEP_1 })
  })

  it('should_open_a_deliverable_file_read_only_with_its_differences_and_its_colored_content', async () => {
    const user = userEvent.setup()
    const view: IdeasCanvasView = {
      ...finalView('a_revoir'),
      deliverables: [
        {
          neuronId: STEP_1,
          genesisId: HATCHED_A_ID,
          files: [{ path: 'src/a.ts', status: 'modifie' }],
          runs: [],
          executing: false,
          width: 420,
          height: 300,
          offset: { x: 0, y: 0 }
        }
      ]
    }
    const { api } = renderCanvas(view, {
      'deliverable:file': () => ({
        path: 'src/a.ts',
        status: 'modifie',
        language: 'typescript',
        before: 'const a = 1\n',
        after: 'const a = 2\n',
        current: 'const a = 3\n<script>alert(1)</script>\n',
        missing: false,
        tooBig: false,
        binary: false,
        changedSince: true
      }),
      'deliverable:openInEditor': () => ({ ok: true })
    })
    await user.click(await screen.findByRole('button', { name: 'Lire src/a.ts (modifié)' }))
    expect(api.invoke).toHaveBeenCalledWith('deliverable:file', { neuronId: STEP_1, path: 'src/a.ts' })
    const viewer = await screen.findByRole('complementary', { name: 'Visionneuse de fichier' })
    expect(await within(viewer).findByText('Modifié depuis l’écriture de Claude')).toBeTruthy()
    // La différence part du contenu actuel (retouché) : 2 lignes ajoutées, 1 retirée.
    expect(within(viewer).getByRole('tabpanel').textContent).toContain('+2 · −1')
    // Les lignes de la différence sont colorées elles aussi.
    expect(within(viewer).getByRole('tabpanel').querySelector('.viewer-diff-removed .hljs-keyword')?.textContent).toBe(
      'const'
    )
    await user.click(within(viewer).getByRole('tab', { name: 'Fichier' }))
    const code = within(viewer).getByRole('tabpanel').querySelector('code.hljs')
    expect(code?.querySelector('.hljs-keyword')?.textContent).toBe('const')
    // Le contenu n'est jamais interprété : la balise reste du texte.
    expect(code?.querySelector('script')).toBeNull()
    expect(code?.textContent).toContain('<script>alert(1)</script>')
    await expectNoAxeViolations(viewer)
    // L'éditeur s'ouvre à la première ligne changée du contenu actuel.
    await user.click(within(viewer).getByRole('button', { name: 'Ouvrir dans l’éditeur' }))
    expect(api.invoke).toHaveBeenCalledWith('deliverable:openInEditor', { neuronId: STEP_1, path: 'src/a.ts', line: 1 })
    await user.click(within(viewer).getByRole('button', { name: 'Fermer la visionneuse' }))
    expect(screen.queryByRole('complementary', { name: 'Visionneuse de fichier' })).toBeNull()
  })

  it('should_show_a_proposed_final_action_on_its_step_and_accept_it_with_its_check_button', async () => {
    const user = userEvent.setup()
    const { api } = renderCanvas(finalView('proposee'))
    expect(
      await screen.findByRole('group', {
        name: 'Étape ① de « Mission mariage » : Valider le budget, en cours, action finale proposée'
      })
    ).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'Accepter « Valider le budget » comme action finale' }))
    expect(api.invoke).toHaveBeenCalledWith('final:decide', { neuronId: STEP_1, accept: true })
    await waitFor(() => expect(useUiStore.getState().toast?.undoBatchId).toBe('f1'))
  })

  it('should_read_the_proposal_in_the_panel_before_refusing_it', async () => {
    const user = userEvent.setup()
    const { api } = renderCanvas(finalView('proposee'))
    await user.click(await screen.findByRole('button', { name: 'Lire l’action finale de « Valider le budget »' }))
    const panel = await screen.findByRole('complementary', { name: 'Action finale' })
    expect(panel.textContent).toContain('src/pages/Contact.tsx')
    expect(panel.textContent).toContain('Un seul composant')
    expect(useUiStore.getState().chatNeuronId).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Refuser' }))
    expect(api.invoke).toHaveBeenCalledWith('final:decide', { neuronId: STEP_1, accept: false })
  })

  it('should_mark_an_accepted_final_action_and_let_it_become_an_ordinary_step', async () => {
    const user = userEvent.setup()
    const { api } = renderCanvas(finalView('prete'))
    expect(
      await screen.findByRole('group', {
        name: 'Étape ① de « Mission mariage » : Valider le budget, en cours, action finale · prête'
      })
    ).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'Lire l’action finale de « Valider le budget »' }))
    await user.click(await screen.findByRole('button', { name: 'Redevenir une étape ordinaire' }))
    expect(api.invoke).toHaveBeenCalledWith('final:demote', { neuronId: STEP_1 })
  })

  it('should_let_mentalyas_approve_the_scripts_claude_can_run_from_the_action_panel', async () => {
    const user = userEvent.setup()
    const { api } = renderCanvas(finalView('prete'))
    await user.click(await screen.findByRole('button', { name: 'Lire l’action finale de « Valider le budget »' }))
    const panel = await screen.findByRole('complementary', { name: 'Action finale' })
    expect(await within(panel).findByText('modifié depuis : à réapprouver')).toBeDefined()
    expect(within(panel).getByRole('checkbox', { name: /test/ })).toHaveProperty('checked', true)
    await user.click(within(panel).getByRole('checkbox', { name: /dev/ }))
    await user.click(within(panel).getByRole('checkbox', { name: /test/ }))
    await user.click(within(panel).getByRole('button', { name: 'Enregistrer les commandes autorisées' }))
    expect(api.invoke).toHaveBeenCalledWith('commands:approve', { genesisId: HATCHED_A_ID, scripts: ['build', 'dev'] })
    await expectNoAxeViolations(panel)
  })

  it('should_have_no_accessibility_violation_with_a_proposed_final_action', async () => {
    const { container } = renderCanvas(finalView('proposee'))
    await screen.findByRole('button', { name: 'Lire l’action finale de « Valider le budget »' })
    await expectNoAxeViolations(container)
  })

  it('should_have_no_accessibility_violation', async () => {
    const { container } = renderCanvas()
    await screen.findByText('Claude propose 2 étapes')
    await expectNoAxeViolations(container)
  })
})
