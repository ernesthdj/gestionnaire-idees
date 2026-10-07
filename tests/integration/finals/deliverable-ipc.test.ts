import { describe, expect, it, vi } from 'vitest'
import { createFinalRoutes } from '../../../src/main/ipc/finalHandlers'
import { createDispatcher } from '../../../src/main/ipc/registry'

const ID = '00000000-0000-4000-8000-000000000000'

describe('canaux de revue du livrable (spec 013 US3)', () => {
  const review = {
    get: vi.fn(() => ({ neuronId: ID, state: 'a_revoir' as const, accepted: false, files: [], executions: [] })),
    accept: vi.fn(() => ({ batchId: 'b1' })),
    correct: vi.fn(async () => ({ executionId: 'e1' })),
    revert: vi.fn(() => ({ restored: ['a.md'], skipped: [] }))
  }
  const dispatch = createDispatcher(
    createFinalRoutes(
      { decide: vi.fn(), demote: vi.fn(), move: vi.fn(), resize: vi.fn() },
      { execute: vi.fn(), stop: vi.fn() },
      undefined,
      undefined,
      review
    )
  )

  it('should_route_the_four_channels_to_the_review_service', async () => {
    expect(await dispatch('deliverable:get', { neuronId: ID })).toMatchObject({ success: true, data: { neuronId: ID } })
    expect(await dispatch('deliverable:accept', { neuronId: ID })).toMatchObject({
      success: true,
      data: { batchId: 'b1' }
    })
    expect(await dispatch('deliverable:correct', { neuronId: ID, message: '  Corrige  ' })).toMatchObject({
      success: true,
      data: { executionId: 'e1' }
    })
    expect(review.correct).toHaveBeenCalledWith(ID, 'Corrige')
    expect(await dispatch('deliverable:revert', { neuronId: ID })).toMatchObject({
      success: true,
      data: { restored: ['a.md'] }
    })
  })

  it.each([
    ['deliverable:get', { neuronId: 'x' }],
    ['deliverable:accept', { neuronId: ID, force: true }],
    ['deliverable:correct', { neuronId: ID, message: '' }],
    ['deliverable:correct', { neuronId: ID, message: 'x'.repeat(4001) }],
    ['deliverable:correct', { neuronId: ID, message: 'ok', commande: 'rm -rf' }],
    ['deliverable:revert', { neuronId: ID, chemin: 'C:/' }]
  ])('should_refuse_the_malformed_payload_of_%s', async (channel, payload) => {
    expect(await dispatch(channel, payload)).toMatchObject({ success: false, error: { code: 'VALIDATION' } })
  })
})
