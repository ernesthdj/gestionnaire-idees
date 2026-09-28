import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createFusionRoutes } from '../../../src/main/ipc/fusionHandlers'
import { createDispatcher } from '../../../src/main/ipc/registry'
import type { SynthesisView } from '../../../src/shared/ipc/neurons'
import { readyRoot, reflectionSummary, screenPlan } from '../../support/fusion'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

describe('aperçu de synthèse modifiable (spec 003 T031)', () => {
  let t: NeuronHarness
  let dispatch: ReturnType<typeof createDispatcher>
  beforeEach(() => {
    t = createNeuronHarness()
    dispatch = createDispatcher(createFusionRoutes(t.fusion))
  })
  afterEach(() => t.dispose())

  async function proposedPlan(): Promise<SynthesisView> {
    const tree = await readyRoot(t)
    t.h.claude.enqueue(screenPlan())
    return t.fusion.lock({ rootId: tree.root.id })
  }

  const edit = async (synthesisId: string, patch: Record<string, unknown>) =>
    dispatch('fusion:editProposed', { synthesisId, patch })

  it('should_correct_a_task_title_amount_and_date_and_keep_it_proposed', async () => {
    const synthesis = await proposedPlan()
    const result = await edit(synthesis.id, {
      ref: 't1',
      title: 'Commander l’écran 27"',
      amountCents: 24900,
      dueDate: '2026-10-15'
    })
    expect(result.success).toBe(true)
    const view = (result.success ? result.data : null) as SynthesisView
    expect(view.status).toBe('proposed')
    const task = view.type === 'action_plan' ? view.plan.nodes.find((node) => node.ref === 't1') : undefined
    expect(task).toMatchObject({ title: 'Commander l’écran 27"', amountCents: 24900, dueDate: '2026-10-15' })
    // Rien n'est encore appliqué : l'idée reste en développement.
    expect(t.neurons.getTree(synthesis.rootId).root.state).toBe('developing')
  })

  it('should_clear_an_amount_when_null_is_sent', async () => {
    const tree = await readyRoot(t)
    t.h.claude.enqueue(screenPlan({ amountCents: 25000 }))
    const synthesis = await t.fusion.lock({ rootId: tree.root.id })
    const result = await edit(synthesis.id, { ref: 't1', amountCents: null })
    const view = (result.success ? result.data : null) as SynthesisView
    const task = view.type === 'action_plan' ? view.plan.nodes.find((node) => node.ref === 't1') : undefined
    expect(task?.amountCents).toBeUndefined()
  })

  it('should_correct_the_text_of_a_reflection_point', async () => {
    const tree = await readyRoot(t, 'reflection', ['Reportage', 'Location', 'Discrétion'])
    t.h.claude.enqueue(reflectionSummary)
    const synthesis = await t.fusion.lock({ rootId: tree.root.id })
    const result = await edit(synthesis.id, { ref: 'pros.0', text: 'Plus discret en cérémonie' })
    const view = (result.success ? result.data : null) as SynthesisView
    expect(view.type === 'reflection_summary' ? view.summary.pros[0]?.text : null).toBe('Plus discret en cérémonie')
  })

  it.each([
    [{ ref: 'inconnu', title: 'x' }, 'élément absent'],
    [{ ref: 't1', text: 'texte' }, 'texte sur un plan'],
    [{ ref: 't1' }, 'rien à corriger'],
    [{ ref: 't1', dueDate: '15/10/2026' }, 'date mal formée'],
    [{ ref: 't1', amountCents: -5 }, 'montant négatif']
  ])('should_refuse_%o_(%s)', async (patch, reason) => {
    const synthesis = await proposedPlan()
    expect(await edit(synthesis.id, patch), reason).toMatchObject({ success: false, error: { code: 'VALIDATION' } })
  })

  it('should_refuse_the_correction_and_mark_the_preview_stale_when_the_idea_changed', async () => {
    const synthesis = await proposedPlan()
    t.growth.addBranch({ parentId: synthesis.rootId, title: 'Nouvelle piste' })
    expect(await edit(synthesis.id, { ref: 't1', title: 'Autre' })).toMatchObject({
      success: false,
      error: { code: 'STALE' }
    })
  })

  it('should_give_back_the_open_preview_without_calling_the_ai_and_nothing_once_stale', async () => {
    const synthesis = await proposedPlan()
    const calls = t.h.claude.requests.length
    const reopened = await dispatch('fusion:getProposed', { rootId: synthesis.rootId })
    expect(reopened).toMatchObject({ success: true, data: { id: synthesis.id, status: 'proposed' } })
    expect(t.h.claude.requests.length).toBe(calls)
    t.growth.addBranch({ parentId: synthesis.rootId, title: 'Nouvelle piste' })
    expect(await dispatch('fusion:getProposed', { rootId: synthesis.rootId })).toEqual({ success: true, data: null })
  })
})
