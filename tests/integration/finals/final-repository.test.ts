import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FinalRepository } from '../../../src/main/infrastructure/db/repositories/FinalRepository'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

describe('dépôt des actions finales (spec 013 data-model)', () => {
  let t: NeuronHarness
  let repository: FinalRepository
  let genesis: string
  let action: string

  beforeEach(async () => {
    t = createNeuronHarness()
    repository = new FinalRepository(t.handle.db)
    genesis = (await t.neurons.create({ text: 'Site vitrine' })).id
    action = (await t.neurons.create({ text: 'Page contact' })).id
  })
  afterEach(() => t.dispose())

  const propose = (deliverable = 'src/pages/Contact.tsx'): void =>
    repository.propose({
      neuronId: action,
      genesisId: genesis,
      deliverable,
      reason: 'Atomique',
      origin: 'claude',
      proposedAt: '2026-10-05T10:00:00.000Z'
    })

  it('should_start_a_fresh_proposal_over_an_archived_one_and_keep_its_place', () => {
    propose()
    repository.setState(action, 'prete', '2026-10-05T10:01:00.000Z')
    repository.setOffset(action, 30, -20)
    repository.setArchived(action, '2026-10-05T10:02:00.000Z')
    expect(repository.active(action)).toBeUndefined()
    propose('Autre livrable')
    expect(repository.active(action)).toMatchObject({
      state: 'proposee',
      deliverable: 'Autre livrable',
      acceptedAt: null,
      offsetX: 30,
      offsetY: -20
    })
    expect(repository.list().map((row) => row.neuronId)).toEqual([action])
  })

  it('should_refuse_a_second_open_execution_in_the_same_genesis', () => {
    propose()
    const start = (id: string): void =>
      repository.startExecution({ id, neuronId: action, genesisId: genesis, startedAt: 'x', correction: null })
    start('e1')
    expect(() => start('e2')).toThrow()
    expect(repository.openOfGenesis(genesis)?.id).toBe('e1')
    repository.endExecution('e1', 'y', 'terminee')
    start('e2')
    expect(repository.openOf(action)?.id).toBe('e2')
    expect(repository.executionsOf(action).map((row) => [row.id, row.outcome])).toEqual([
      ['e2', null],
      ['e1', 'terminee']
    ])
    expect(repository.openExecutions().map((row) => row.id)).toEqual(['e2'])
  })

  it('should_count_writes_and_keep_the_events_in_order', () => {
    propose()
    repository.startExecution({ id: 'e1', neuronId: action, genesisId: genesis, startedAt: 'x', correction: 'Renomme' })
    repository.countWrite('e1')
    repository.countWrite('e1')
    repository.addEvent({ executionId: 'e1', at: 'a', kind: 'ecriture', path: 'a.ts', detail: null })
    repository.addEvent({ executionId: 'e1', at: 'b', kind: 'refus', path: '.env', detail: 'secrets' })
    expect(repository.execution('e1')).toMatchObject({ filesWritten: 2, correction: 'Renomme' })
    expect(repository.eventsOf('e1').map((event) => event.kind)).toEqual(['ecriture', 'refus'])
  })

  it('should_keep_the_content_before_the_first_write_when_a_file_is_written_again', () => {
    propose()
    repository.insertFile({
      id: 'f1',
      neuronId: action,
      path: 'src/A.ts',
      pathKey: 'src/a.ts',
      beforeContent: 'ancien',
      afterContent: 'v1',
      afterHash: 'h1',
      updatedAt: 'x'
    })
    repository.updateFile('f1', { afterContent: 'v2', afterHash: 'h2', updatedAt: 'y' })
    expect(repository.file(action, 'src/a.ts')).toMatchObject({ beforeContent: 'ancien', afterContent: 'v2' })
    expect(() =>
      repository.insertFile({
        id: 'f2',
        neuronId: action,
        path: 'SRC/a.ts',
        pathKey: 'src/a.ts',
        beforeContent: null,
        afterContent: 'v',
        afterHash: 'h',
        updatedAt: 'z'
      })
    ).toThrow()
    expect(repository.files(action)).toHaveLength(1)
  })
})
