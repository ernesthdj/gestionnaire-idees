import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CanvasService } from '../../../src/main/application/canvas/CanvasService'
import { PlanService } from '../../../src/main/application/plan/PlanService'
import { BlockRepository } from '../../../src/main/infrastructure/db/repositories/BlockRepository'
import { NeuronRepository } from '../../../src/main/infrastructure/db/repositories/NeuronRepository'
import { PlanRepository } from '../../../src/main/infrastructure/db/repositories/PlanRepository'
import { createCanvasRoutes } from '../../../src/main/ipc/canvasHandlers'
import { createNeuronRoutes } from '../../../src/main/ipc/neuronHandlers'
import { createPlanRoutes } from '../../../src/main/ipc/planHandlers'
import { createDispatcher } from '../../../src/main/ipc/registry'
import type { IdeasCanvasView } from '../../../src/shared/ipc/canvas'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

describe('plan d’attaque côté interface (spec 011 US1, canaux)', () => {
  let t: NeuronHarness
  let plan: PlanService
  let dispatch: ReturnType<typeof createDispatcher>
  let genesis: string

  beforeEach(async () => {
    t = createNeuronHarness()
    const repository = new PlanRepository(t.handle.db)
    plan = new PlanService({ repository })
    const canvas = new CanvasService({
      neurons: new NeuronRepository(t.handle.db),
      blocks: new BlockRepository(t.handle.db),
      io: { links: () => [] },
      plan: repository
    })
    dispatch = createDispatcher([
      ...createCanvasRoutes(canvas),
      ...createPlanRoutes(plan),
      ...createNeuronRoutes(t.neurons, plan)
    ])
    genesis = (await t.neurons.create({ text: 'Ouvrir un studio photo' })).id
  })
  afterEach(() => t.dispose())

  const view = async (): Promise<IdeasCanvasView> => {
    const result = await dispatch('canvas:get', {})
    if (!result.success) throw new Error(result.error.code)
    return result.data as IdeasCanvasView
  }

  const propose = () =>
    plan.propose({
      parentId: genesis,
      steps: [
        { key: 'budget', title: 'Valider le budget', why: 'Tout en dépend' },
        { key: 'lieu', title: 'Choisir le lieu', why: 'Après le budget', waitsFor: ['budget'] }
      ]
    })

  it('should_show_the_ghosts_with_their_dependencies_as_ghost_ids', async () => {
    const { proposalId } = propose()
    const [proposal] = (await view()).proposals
    expect(proposal).toMatchObject({ id: proposalId, parentId: genesis })
    const [budget, lieu] = proposal?.items ?? []
    expect([budget?.rank, budget?.title, lieu?.rank, lieu?.waitsFor]).toEqual([1, 'Valider le budget', 2, [budget?.id]])
    expect((await view()).steps).toEqual([])
  })

  it('should_show_the_born_steps_and_the_locked_genesis_after_the_decision', async () => {
    const { proposalId } = propose()
    const items = (await view()).proposals[0]?.items.map((item) => item.id) ?? []
    const decided = await dispatch('plan:decide', { proposalId, accept: items, reject: [] })
    expect(decided.success).toBe(true)
    const after = await view()
    expect(after.proposals).toEqual([])
    expect(after.ideas.find((idea) => idea.id === genesis)).toMatchObject({ locked: true, lockProposed: false })
    expect(after.steps.map((step) => [step.rank, step.title, step.depth, step.status, step.parentId])).toEqual([
      [1, 'Valider le budget', 1, 'a_faire', genesis],
      [2, 'Choisir le lieu', 1, 'a_faire', genesis]
    ])
    expect(after.steps[1]?.waitsFor).toEqual([after.steps[0]?.id])
  })

  it('should_file_a_born_step_in_the_view_shown_and_its_substeps_in_the_same', async () => {
    let shown: 'workflow' | 'progression' | 'architecture' | null = 'progression'
    const viewed = new PlanService({ repository: new PlanRepository(t.handle.db), structureView: () => shown })
    const { proposalId } = propose()
    const items = (await view()).proposals[0]?.items.map((item) => item.id) ?? []
    viewed.decide({ proposalId, accept: items, reject: [] })
    const [budget] = (await view()).steps
    expect(budget?.view).toBe('progression')
    // Une sous-étape garde la vue de son parent, même si la carte a changé de vue entre-temps.
    shown = 'workflow'
    const sub = viewed.propose({ parentId: budget?.id ?? '', steps: [{ key: 'devis', title: 'Devis', why: 'Prix' }] })
    const subItems = (await view()).proposals.find((p) => p.id === sub.proposalId)?.items.map((item) => item.id) ?? []
    viewed.decide({ proposalId: sub.proposalId, accept: subItems, reject: [] })
    expect((await view()).steps.find((step) => step.title === 'Devis')?.view).toBe('progression')
  })

  it('should_refuse_a_step_in_the_workflow_view_and_point_to_the_task_file', async () => {
    let shown: 'workflow' | 'progression' | null = 'progression'
    const viewed = new PlanService({ repository: new PlanRepository(t.handle.db), structureView: () => shown })
    const { proposalId } = propose()
    const items = (await view()).proposals[0]?.items.map((item) => item.id) ?? []
    shown = 'workflow'
    const refused = { code: 'VALIDATION', message: expect.stringContaining('fichier de tâches') }
    expect(() => viewed.decide({ proposalId, accept: items, reject: [] })).toThrow(expect.objectContaining(refused))
    expect(() => viewed.propose({ parentId: genesis, steps: [{ key: 'devis', title: 'Devis', why: 'Prix' }] })).toThrow(
      expect.objectContaining(refused)
    )
    // Écarter une proposition reste possible ; les étapes déjà nées hors Workflow se découpent encore.
    expect(viewed.decide({ proposalId, accept: [], reject: items }).born).toEqual([])
    expect((await view()).steps).toEqual([])
  })

  it('should_remove_several_steps_with_their_substeps_in_a_single_batch', async () => {
    const { proposalId } = propose()
    const items = (await view()).proposals[0]?.items.map((item) => item.id) ?? []
    await dispatch('plan:decide', { proposalId, accept: items, reject: [] })
    const [budget, lieu] = (await view()).steps
    const sub = plan.propose({ parentId: budget?.id ?? '', steps: [{ key: 'devis', title: 'Devis', why: 'Prix' }] })
    const subItems = (await view()).proposals.find((p) => p.id === sub.proposalId)?.items.map((item) => item.id) ?? []
    plan.decide({ proposalId: sub.proposalId, accept: subItems, reject: [] })
    expect((await view()).steps).toHaveLength(3)
    const removed = await dispatch('plan:removeSteps', { stepIds: [budget?.id, lieu?.id] })
    expect(removed).toMatchObject({ success: true, data: { batchId: expect.any(String) } })
    expect((await view()).steps).toEqual([])
    expect((await dispatch('plan:removeSteps', { stepIds: [] })).success).toBe(false)
    expect((await dispatch('plan:removeSteps', { stepIds: [genesis] })).success).toBe(false)
  })

  it('should_leave_a_step_without_view_when_the_genesis_has_none', async () => {
    const { proposalId } = propose()
    const items = (await view()).proposals[0]?.items.map((item) => item.id) ?? []
    await dispatch('plan:decide', { proposalId, accept: items, reject: [] })
    expect((await view()).steps[0]).not.toHaveProperty('view')
  })

  it('should_keep_the_fold_of_a_step_and_of_the_genesis_when_set', async () => {
    const { proposalId } = propose()
    const items = (await view()).proposals[0]?.items.map((item) => item.id) ?? []
    await dispatch('plan:decide', { proposalId, accept: items, reject: [] })
    const [first] = (await view()).steps
    expect(first?.collapsed).toBeUndefined()
    expect((await dispatch('plan:setCollapsed', { neuronId: first?.id, collapsed: true })).success).toBe(true)
    expect((await dispatch('plan:setCollapsed', { neuronId: genesis, collapsed: true })).success).toBe(true)
    const folded = await view()
    expect(folded.steps.find((step) => step.id === first?.id)?.collapsed).toBe(true)
    expect(folded.ideas.find((idea) => idea.id === genesis)?.planCollapsed).toBe(true)
    await dispatch('plan:setCollapsed', { neuronId: genesis, collapsed: false })
    expect((await view()).ideas.find((idea) => idea.id === genesis)?.planCollapsed).toBeUndefined()
  })

  it('should_refuse_to_fold_an_unknown_node_or_a_bad_payload', async () => {
    const unknown = await dispatch('plan:setCollapsed', {
      neuronId: '5b1f0c1e-9a4b-4c3d-8e2f-0a1b2c3d4e5f',
      collapsed: true
    })
    expect(unknown).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } })
    const bad = await dispatch('plan:setCollapsed', { neuronId: genesis, collapsed: 'oui' })
    expect(bad.success).toBe(false)
  })

  it('should_refuse_a_step_both_accepted_and_refused', async () => {
    const { proposalId } = propose()
    const [first] = (await view()).proposals[0]?.items ?? []
    const result = await dispatch('plan:decide', { proposalId, accept: [first?.id], reject: [first?.id] })
    expect(result).toMatchObject({ success: false, error: { code: 'VALIDATION' } })
  })

  it('should_remove_a_step_through_neuron_remove', async () => {
    const { proposalId } = propose()
    const items = (await view()).proposals[0]?.items.map((item) => item.id) ?? []
    await dispatch('plan:decide', { proposalId, accept: items, reject: [] })
    const [budget] = (await view()).steps
    expect((await dispatch('neuron:remove', { rootId: budget?.id })).success).toBe(true)
    expect((await view()).steps.map((step) => [step.rank, step.title])).toEqual([[1, 'Choisir le lieu']])
    expect((await view()).ideas.some((idea) => idea.id === genesis)).toBe(true)
  })

  it('should_refuse_to_remove_a_step_together_with_ideas', async () => {
    const { proposalId } = propose()
    const items = (await view()).proposals[0]?.items.map((item) => item.id) ?? []
    await dispatch('plan:decide', { proposalId, accept: items, reject: [] })
    const [budget] = (await view()).steps
    expect(await dispatch('neuron:removeMany', { rootIds: [genesis, budget?.id] })).toMatchObject({
      success: false,
      error: { code: 'INVALID_STATE' }
    })
    expect((await view()).ideas.some((idea) => idea.id === genesis)).toBe(true)
    expect(await dispatch('neuron:removeMany', { rootIds: [] })).toMatchObject({ success: false })
  })

  it('should_remember_where_a_step_was_dragged_and_refuse_to_move_a_genesis', async () => {
    const { proposalId } = propose()
    const items = (await view()).proposals[0]?.items.map((item) => item.id) ?? []
    await dispatch('plan:decide', { proposalId, accept: items, reject: [] })
    const [budget] = (await view()).steps
    expect((await dispatch('plan:move', { stepId: budget?.id, x: 80, y: -40 })).success).toBe(true)
    expect((await view()).steps[0]?.offset).toEqual({ x: 80, y: -40 })
    expect(await dispatch('plan:move', { stepId: genesis, x: 0, y: 0 })).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' }
    })
  })

  it('should_hide_the_plan_of_an_archived_genesis', async () => {
    const { proposalId } = propose()
    const items = (await view()).proposals[0]?.items.map((item) => item.id) ?? []
    await dispatch('plan:decide', { proposalId, accept: items, reject: [] })
    await t.neurons.archive(genesis)
    expect((await view()).steps).toEqual([])
  })
})
