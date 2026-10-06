import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CanvasService } from '../../../src/main/application/canvas/CanvasService'
import { FinalService } from '../../../src/main/application/finals/FinalService'
import { PlanService } from '../../../src/main/application/plan/PlanService'
import { BlockRepository } from '../../../src/main/infrastructure/db/repositories/BlockRepository'
import { FinalRepository } from '../../../src/main/infrastructure/db/repositories/FinalRepository'
import { NeuronRepository } from '../../../src/main/infrastructure/db/repositories/NeuronRepository'
import { PlanRepository } from '../../../src/main/infrastructure/db/repositories/PlanRepository'
import { createCanvasRoutes } from '../../../src/main/ipc/canvasHandlers'
import { createFinalRoutes } from '../../../src/main/ipc/finalHandlers'
import { createDispatcher } from '../../../src/main/ipc/registry'
import type { IdeasCanvasView } from '../../../src/shared/ipc/canvas'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

describe('actions finales côté interface (spec 013 US1, canaux)', () => {
  let t: NeuronHarness
  let finals: FinalService
  let dispatch: ReturnType<typeof createDispatcher>
  let step: string

  beforeEach(async () => {
    t = createNeuronHarness()
    const plan = new PlanRepository(t.handle.db)
    const repository = new FinalRepository(t.handle.db)
    finals = new FinalService({ repository, plan })
    const canvas = new CanvasService({
      neurons: new NeuronRepository(t.handle.db),
      blocks: new BlockRepository(t.handle.db),
      io: { links: () => [] },
      plan,
      finals: {
        list: () => repository.list(),
        files: (neuronId) => repository.files(neuronId),
        projectLinked: () => false
      }
    })
    dispatch = createDispatcher([
      ...createCanvasRoutes(canvas),
      ...createFinalRoutes(finals, { execute: async () => ({ executionId: 'e1' }), stop: () => undefined })
    ])
    const genesis = (await t.neurons.create({ text: 'Site vitrine' })).id
    const service = new PlanService({ repository: plan })
    const { proposalId } = service.propose({
      parentId: genesis,
      steps: [{ key: 'c', title: 'Page contact', why: 'x' }]
    })
    ;[step = ''] = service.decide({
      proposalId,
      accept: plan.proposal(proposalId)?.items.map((item) => item.id) ?? [],
      reject: []
    }).born
    finals.propose({ neuronId: step, deliverable: 'src/pages/Contact.tsx', reason: 'Atomique', origin: 'claude' })
  })
  afterEach(() => t.dispose())

  const view = async (): Promise<IdeasCanvasView> => {
    const result = await dispatch('canvas:get', {})
    if (!result.success) throw new Error(result.error.code)
    return result.data as IdeasCanvasView
  }

  it('should_show_the_proposal_on_its_step_then_the_accepted_action', async () => {
    expect((await view()).steps[0]?.final).toEqual({
      state: 'proposee',
      deliverable: 'src/pages/Contact.tsx',
      reason: 'Atomique',
      projectLinked: false
    })
    expect(await dispatch('final:decide', { neuronId: step, accept: true })).toMatchObject({
      success: true,
      data: { state: 'prete' }
    })
    expect((await view()).steps[0]?.final?.state).toBe('prete')
  })

  it('should_hide_a_refused_proposal_and_a_demoted_action', async () => {
    await dispatch('final:decide', { neuronId: step, accept: false })
    expect((await view()).steps[0]?.final).toBeUndefined()
    finals.propose({ neuronId: step, deliverable: 'x', reason: 'y', origin: 'claude' })
    await dispatch('final:decide', { neuronId: step, accept: true })
    expect((await dispatch('final:demote', { neuronId: step })).success).toBe(true)
    expect((await view()).steps[0]?.final).toBeUndefined()
  })

  it.each([
    ['final:decide', { neuronId: 'pas-un-uuid', accept: true }],
    ['final:decide', { neuronId: '00000000-0000-4000-8000-000000000000', accept: 'oui' }],
    ['final:demote', { neuronId: '00000000-0000-4000-8000-000000000000', chemin: 'C:/' }],
    ['final:execute', { neuronId: '00000000-0000-4000-8000-000000000000', commande: 'npm i' }],
    ['final:execute', { neuronId: '00000000-0000-4000-8000-000000000000', force: 'oui' }],
    ['final:stop', { neuronId: 'x' }],
    ['deliverable:resize', { neuronId: '00000000-0000-4000-8000-000000000000', width: 100, height: 300 }],
    ['deliverable:move', { neuronId: '00000000-0000-4000-8000-000000000000', x: 1e9, y: 0 }]
  ])('should_refuse_the_malformed_payload_of_%s', async (channel, payload) => {
    expect(await dispatch(channel, payload)).toMatchObject({ success: false, error: { code: 'VALIDATION' } })
  })
})
