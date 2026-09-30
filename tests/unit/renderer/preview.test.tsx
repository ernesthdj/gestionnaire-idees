import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { DEFAULT_APP_SETTINGS } from '../../../src/shared/ipc/app'
import type { SynthesisView } from '../../../src/shared/ipc/neurons'
import { expectNoAxeViolations } from '../../support/axe'
import { developingTree, ROOT, ROOT_ID } from '../../fixtures/ui/dive'
import { PLAN_ID, planPreview, SUMMARY_ID, summaryPreview } from '../../fixtures/ui/fusion'
import { FakeIpcError } from './support/fakeApi'
import { renderOpenIdea, type Handlers } from './support/openIdea'
import { installReactFlowMocks } from './support/reactFlowMocks'

const TOOLS = [
  {
    title: 'Tableau des dépenses',
    description: 'Additionne les achats prévus et compare au budget.',
    parts: ['tree', 'document'] as const,
    producesResult: true
  },
  {
    title: 'Compte à rebours',
    description: 'Jours restants avant la livraison.',
    parts: [] as const,
    producesResult: false
  }
].map((tool) => ({ ...tool, parts: [...tool.parts] }))

function renderWithPreview(proposed: SynthesisView | null, handlers: Handlers = {}) {
  return renderOpenIdea(developingTree, {
    // Animations réduites : la fusion se joue en fondus courts (tests rapides).
    'app:getSettings': () => ({ ...DEFAULT_APP_SETTINGS, motion: 'reduced' }),
    'fusion:getProposed': () => proposed,
    'fusion:editProposed': () => proposed,
    'fusion:revise': () => proposed,
    'fusion:reject': () => ({ ok: true }),
    'fusion:confirm': () => ({ batchId: 'b1', root: { ...ROOT, state: 'hatched' } }),
    ...handlers
  })
}

const preview = (name: RegExp | string): Promise<HTMLElement> => screen.findByRole('region', { name })

describe('aperçu de synthèse et fusion', () => {
  beforeAll(() => installReactFlowMocks())
  beforeEach(() => useUiStore.setState({ toast: null }))

  it('should_show_the_plan_with_its_branches_dependencies_amounts_and_gaps', async () => {
    renderWithPreview(planPreview())
    const region = await preview('Aperçu du plan d’action')
    expect(within(region).getByText('Commander l’écran')).toBeDefined()
    expect(within(region).getByText(/250,00/)).toBeDefined()
    expect(within(region).getByText('après « Commander l’écran »')).toBeDefined()
    expect(within(region).getByText('Taille exacte du bureau')).toBeDefined()
    expect(within(region).getByText('Rien n’est appliqué avant « Confirmer ». Corrige ce qui ne va pas.')).toBeDefined()
  })

  it('should_send_a_corrected_title_amount_and_date_for_a_task', async () => {
    const user = userEvent.setup()
    const api = renderWithPreview(planPreview())
    const region = await preview('Aperçu du plan d’action')
    await user.click(within(region).getByRole('button', { name: 'Modifier : Commander l’écran' }))
    const amount = within(region).getByLabelText('Montant (€)')
    await user.clear(amount)
    await user.type(amount, '249,90')
    await user.type(within(region).getByLabelText('Date'), '2026-10-15')
    await user.click(within(region).getByRole('button', { name: 'Enregistrer' }))
    expect(api.invoke).toHaveBeenCalledWith('fusion:editProposed', {
      synthesisId: PLAN_ID,
      patch: { ref: 't1', title: 'Commander l’écran', amountCents: 24990, dueDate: '2026-10-15' }
    })
  })

  it('should_refuse_an_amount_that_is_not_in_euros', async () => {
    const user = userEvent.setup()
    const api = renderWithPreview(planPreview())
    const region = await preview('Aperçu du plan d’action')
    await user.click(within(region).getByRole('button', { name: 'Modifier : Commander l’écran' }))
    const amount = within(region).getByLabelText('Montant (€)')
    await user.clear(amount)
    await user.type(amount, 'deux cents')
    await user.click(within(region).getByRole('button', { name: 'Enregistrer' }))
    expect(within(region).getByRole('alert').textContent).toMatch(/montant en euros/)
    expect(api.invoke).not.toHaveBeenCalledWith('fusion:editProposed', expect.anything())
  })

  it('should_correct_a_reflection_point_revise_with_an_instruction_and_reject', async () => {
    const user = userEvent.setup()
    const api = renderWithPreview(summaryPreview())
    const region = await preview('Aperçu de la synthèse')
    await user.click(within(region).getByRole('button', { name: 'Modifier : Plus discret' }))
    const field = within(region).getByLabelText('Texte du point')
    await user.clear(field)
    await user.type(field, 'Plus discret en cérémonie{Enter}')
    expect(api.invoke).toHaveBeenCalledWith('fusion:editProposed', {
      synthesisId: SUMMARY_ID,
      patch: { ref: 'pros.0', text: 'Plus discret en cérémonie' }
    })
    await user.click(within(region).getByRole('button', { name: 'Réviser' }))
    await user.type(within(region).getByLabelText('Consigne pour la révision'), 'Plus court')
    await user.click(within(region).getByRole('button', { name: 'Envoyer' }))
    expect(api.invoke).toHaveBeenCalledWith('fusion:revise', { synthesisId: SUMMARY_ID, instruction: 'Plus court' })
    await user.click(within(region).getByRole('button', { name: 'Refuser' }))
    expect(api.invoke).toHaveBeenCalledWith('fusion:reject', { synthesisId: SUMMARY_ID })
    expect(await screen.findByRole('complementary', { name: 'Questions de l’IA' })).toBeDefined()
  })

  it('should_block_confirmation_and_offer_to_regenerate_when_the_preview_is_stale', async () => {
    const api = renderWithPreview(planPreview())
    const region = await preview('Aperçu du plan d’action')
    act(() => api.emit('synthesis:stale', { rootId: ROOT_ID, synthesisId: PLAN_ID }))
    expect(within(region).getByRole('button', { name: 'Confirmer' })).toHaveProperty('disabled', true)
    expect(within(region).getByRole('button', { name: 'Régénérer l’aperçu' })).toBeDefined()
  })

  it('should_warn_with_what_is_missing_then_lock_anyway_when_the_context_is_insufficient', async () => {
    const user = userEvent.setup()
    let forced = false
    const api = renderWithPreview(null, {
      'fusion:lock': (payload) => {
        if ((payload as { force?: boolean }).force === true) {
          forced = true
          return planPreview({ forced: true })
        }
        throw new FakeIpcError('CONTEXT_INSUFFICIENT', { missing: ['budget', 'quand'] })
      }
    })
    await user.click(await screen.findByRole('button', { name: /^Verrouiller « Deuxième écran » 🔒/ }))
    const warning = await screen.findByRole('alert')
    expect(warning.textContent).toMatch(/risque de ne pas être optimal/)
    expect(warning.textContent).toMatch(/Il manque : budget, quand/)
    await user.click(within(warning).getByRole('button', { name: 'Verrouiller quand même' }))
    expect(api.invoke).toHaveBeenCalledWith('fusion:lock', { rootId: ROOT_ID, force: true })
    expect(forced).toBe(true)
    expect((await preview('Aperçu du plan d’action')).textContent).toMatch(/résultat risque de ne pas être optimal/)
  })

  it('should_confirm_play_the_fusion_on_the_map_and_keep_the_idea_open_with_a_notification', async () => {
    const user = userEvent.setup()
    const api = renderWithPreview(planPreview())
    const region = await preview('Aperçu du plan d’action')
    await user.click(within(region).getByRole('button', { name: 'Confirmer' }))
    expect(api.invoke).toHaveBeenCalledWith('fusion:confirm', { synthesisId: PLAN_ID })
    expect(await screen.findByText('L’idée éclôt…')).toBeDefined()
    await waitFor(() => expect(useUiStore.getState().toast?.text).toBe('« Deuxième écran » a éclos.'))
    expect(useUiStore.getState().toast?.undoBatchId).toBe('b1')
    expect(useUiStore.getState().openRootId).toBe(ROOT_ID)
  })

  it('should_let_the_absorbed_sub_neurons_melt_into_the_idea_before_they_disappear', async () => {
    const user = userEvent.setup()
    let hatched = false
    const absorbed = {
      ...developingTree(),
      root: { ...ROOT, state: 'hatched' as const },
      neurons: [],
      extensions: [],
      suggestions: []
    }
    renderOpenIdea(() => (hatched ? absorbed : developingTree()), {
      'app:getSettings': () => ({ ...DEFAULT_APP_SETTINGS, motion: 'reduced' }),
      'fusion:getProposed': () => planPreview(),
      'fusion:confirm': () => {
        hatched = true
        return { batchId: 'b1', root: { ...ROOT, state: 'hatched' } }
      },
      'hatched:get': () => null
    })
    const region = await preview('Aperçu du plan d’action')
    await user.click(within(region).getByRole('button', { name: 'Confirmer' }))
    await screen.findByText('L’idée éclôt…')
    // La base a déjà absorbé les sous-neurones, mais la carte les garde le temps de les résorber vers l'idée.
    expect(document.querySelectorAll('.react-flow__node.tree-fusing').length).toBeGreaterThan(0)
    await waitFor(() => expect(document.querySelectorAll('.react-flow__node.tree-fusing')).toHaveLength(0))
  })

  it('should_show_no_tool_section_when_claude_proposes_no_tool', async () => {
    renderWithPreview(planPreview())
    const region = await preview('Aperçu du plan d’action')
    expect(within(region).queryByRole('region', { name: 'Outils proposés' })).toBeNull()
  })

  it('should_show_the_proposed_tools_unchecked_with_what_they_read_and_count_the_generations', async () => {
    const user = userEvent.setup()
    const base = planPreview()
    if (base.type !== 'action_plan') throw new Error('plan attendu')
    renderWithPreview({ ...base, plan: { ...base.plan, tools: TOOLS } })
    const tools = await screen.findByRole('region', { name: 'Outils proposés' })
    const budget = within(tools).getByRole('checkbox', { name: /Tableau des dépenses/ })
    const countdown = within(tools).getByRole('checkbox', { name: /Compte à rebours/ })
    expect((budget as HTMLInputElement).checked).toBe(false)
    expect((countdown as HTMLInputElement).checked).toBe(false)
    expect(within(tools).getByText('lit : sous-neurones, document · produit un résultat')).toBeDefined()
    expect(within(tools).getByText('ne lit rien de l’idée')).toBeDefined()
    expect(within(tools).getByRole('status').textContent).toBe('Aucun outil coché : aucune génération.')

    await user.click(budget)
    await user.click(countdown)
    expect(within(tools).getByRole('status').textContent).toBe(
      '2 outils cochés : 2 générations Claude à la confirmation.'
    )
    await user.click(countdown)
    expect(within(tools).getByRole('status').textContent).toBe('1 outil coché : 1 génération Claude à la confirmation.')
  })

  it('should_offer_the_tools_of_a_reflection_too', async () => {
    const base = summaryPreview()
    if (base.type !== 'reflection_summary') throw new Error('synthèse attendue')
    renderWithPreview({ ...base, summary: { ...base.summary, tools: TOOLS.slice(0, 1) } })
    const tools = await screen.findByRole('region', { name: 'Outils proposés' })
    expect(within(tools).getAllByRole('checkbox')).toHaveLength(1)
  })

  it('should_have_no_accessibility_violation_in_the_preview', async () => {
    renderWithPreview(planPreview())
    await preview('Aperçu du plan d’action')
    await expectNoAxeViolations(document.body)
  })
})
