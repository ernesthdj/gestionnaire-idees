import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { DiveView } from '../../../src/renderer/src/dive/DiveView'
import { DEFAULT_APP_SETTINGS } from '../../../src/shared/ipc/app'
import type { MainWindowChannel } from '../../../src/shared/ipc/channels'
import type { SynthesisView } from '../../../src/shared/ipc/neurons'
import { expectNoAxeViolations } from '../../support/axe'
import { emptyCanvasView } from '../../fixtures/ui/canvas'
import { developingTree, ROOT, ROOT_ID } from '../../fixtures/ui/dive'
import { PLAN_ID, planPreview, SUMMARY_ID, summaryPreview } from '../../fixtures/ui/fusion'
import { FakeIpcError, installFakeApi } from './support/fakeApi'
import { installReactFlowMocks } from './support/reactFlowMocks'

type Handlers = Partial<Record<MainWindowChannel, (payload: unknown) => unknown>>

function renderWithPreview(proposed: SynthesisView | null, handlers: Handlers = {}) {
  const api = installFakeApi({
    'neuron:getTree': () => developingTree(),
    // Animations réduites : la fusion se joue en fondus courts (tests rapides).
    'app:getSettings': () => ({ ...DEFAULT_APP_SETTINGS, motion: 'reduced' }),
    'canvas:get': () => emptyCanvasView(),
    'fusion:getProposed': () => proposed,
    'fusion:editProposed': () => proposed,
    'fusion:revise': () => proposed,
    'fusion:reject': () => ({ ok: true }),
    'fusion:confirm': () => ({ batchId: 'b1', root: { ...ROOT, state: 'hatched' } }),
    ...handlers
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <DiveView rootId={ROOT_ID} onClose={() => undefined} />
    </QueryClientProvider>
  )
  return api
}

const preview = (name: RegExp | string): Promise<HTMLElement> => screen.findByRole('region', { name })

describe('aperçu de synthèse et fusion', () => {
  beforeAll(() => installReactFlowMocks())
  beforeEach(() => useUiStore.setState({ view: 'ideas', diveRootId: ROOT_ID, hatchedId: null, toast: null }))

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
    await user.click(await screen.findByRole('button', { name: 'Verrouiller 🔒' }))
    const warning = await screen.findByRole('alert')
    expect(warning.textContent).toMatch(/risque de ne pas être optimal/)
    expect(warning.textContent).toMatch(/Il manque : budget, quand/)
    await user.click(within(warning).getByRole('button', { name: 'Verrouiller quand même' }))
    expect(api.invoke).toHaveBeenCalledWith('fusion:lock', { rootId: ROOT_ID, force: true })
    expect(forced).toBe(true)
    expect((await preview('Aperçu du plan d’action')).textContent).toMatch(/résultat risque de ne pas être optimal/)
  })

  it('should_confirm_play_the_fusion_and_come_back_to_the_map_with_a_notification', async () => {
    const user = userEvent.setup()
    const api = renderWithPreview(planPreview())
    const region = await preview('Aperçu du plan d’action')
    await user.click(within(region).getByRole('button', { name: 'Confirmer' }))
    expect(api.invoke).toHaveBeenCalledWith('fusion:confirm', { synthesisId: PLAN_ID })
    expect(await screen.findByText('L’idée éclôt…')).toBeDefined()
    await waitFor(() => expect(useUiStore.getState().hatchedId).toBe(ROOT_ID))
    expect(useUiStore.getState().diveRootId).toBeNull()
    expect(useUiStore.getState().toast?.text).toBe('« Deuxième écran » a éclos.')
  })

  it('should_have_no_accessibility_violation_in_the_preview', async () => {
    renderWithPreview(planPreview())
    await preview('Aperçu du plan d’action')
    await expectNoAxeViolations(document.body)
  })
})
