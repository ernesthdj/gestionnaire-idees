import { describe, expect, it, vi } from 'vitest'
import type { NeuronService } from '../../../src/main/application/neurons/NeuronService'
import { toFtsQuery } from '../../../src/main/infrastructure/db/repositories/NeuronRepository'
import { createNeuronRoutes } from '../../../src/main/ipc/neuronHandlers'
import { createDispatcher } from '../../../src/main/ipc/registry'

function dispatcherWith(service: Partial<NeuronService>) {
  return createDispatcher(createNeuronRoutes(service as NeuronService))
}

describe('canaux neuron:*', () => {
  it('should_reject_empty_or_oversized_text_when_creating', async () => {
    const dispatch = dispatcherWith({ create: vi.fn() })
    await expect(dispatch('neuron:create', { text: '   ' })).resolves.toMatchObject({ error: { code: 'VALIDATION' } })
    await expect(dispatch('neuron:create', { text: 'x'.repeat(2001) })).resolves.toMatchObject({
      error: { code: 'VALIDATION' }
    })
  })

  it('should_reject_unknown_category_and_malformed_id_when_updating', async () => {
    const dispatch = dispatcherWith({ update: vi.fn() })
    await expect(
      dispatch('neuron:update', { id: '00000000-0000-4000-8000-000000000000', categorySlug: 'poeme' })
    ).resolves.toMatchObject({ error: { code: 'VALIDATION' } })
    await expect(dispatch('neuron:update', { id: '../../etc', title: 'x' })).resolves.toMatchObject({
      error: { code: 'VALIDATION' }
    })
  })

  it('should_pass_only_defined_filters_when_listing', async () => {
    const list = vi.fn().mockReturnValue({ items: [], nextCursor: null })
    await dispatcherWith({ list })('neuron:list', { search: 'écran' })
    expect(list).toHaveBeenCalledWith({ search: 'écran' })
  })
})

describe('toFtsQuery', () => {
  it('should_neutralize_fts_operators_and_quotes_from_user_input', () => {
    expect(toFtsQuery('écran" OR * NEAR(x')).toBe('"écran"* "OR"* "NEAR"* "x"*')
  })

  it('should_return_null_when_input_has_no_word', () => {
    expect(toFtsQuery('*** "" ()')).toBeNull()
  })
})
