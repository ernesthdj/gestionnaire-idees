import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { HatchedRepository } from '../../../src/main/infrastructure/db/repositories/HatchedRepository'
import {
  neurons,
  planDependencies,
  planNodes,
  reflectionSummaries
} from '../../../src/main/infrastructure/db/schemaNeurons'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

/** Document éclos de l'ancien moteur, gardé en archive (spec 010) : lu pour la partie « document » d'un widget. */
describe('document d’une idée éclose de l’ancien moteur (spec 003 US5, archive)', () => {
  let t: NeuronHarness
  let hatched: HatchedRepository
  beforeEach(() => {
    t = createNeuronHarness()
    hatched = new HatchedRepository(t.handle.db)
  })
  afterEach(() => t.dispose())

  const root = (id: string): void => {
    t.handle.db
      .insert(neurons)
      .values({ id, rootId: id, kind: 'root', title: id, origin: 'user', state: 'hatched' })
      .run()
  }

  it('should_read_a_plan_with_its_condition_branches_and_dependency', () => {
    root('plan')
    const node = (id: string, values: Omit<typeof planNodes.$inferInsert, 'id' | 'rootId' | 'synthesisId'>): void => {
      t.handle.db
        .insert(planNodes)
        .values({ id, rootId: 'plan', synthesisId: 's1', ...values })
        .run()
    }
    node('c1', { type: 'condition', title: 'J’ai le budget ?', status: 'ready' })
    node('t1', { type: 'task', title: 'Commander maintenant', parentId: 'c1', branchLabel: 'Oui', status: 'blocked' })
    node('t2', { type: 'task', title: 'Installer et tester', status: 'blocked' })
    node('old', { type: 'task', title: 'Ancien plan', status: 'ready', isCurrent: false })
    t.handle.db
      .insert(planDependencies)
      .values({ id: 'd1', fromNodeId: 't1', toNodeId: 't2', kind: 'on_trigger', triggerLabel: 'mission payée' })
      .run()

    const result = hatched.result('plan')
    if (result?.type !== 'action_plan') throw new Error('plan attendu')
    expect(result.nodes.map((entry) => [entry.type, entry.title, entry.branchLabel])).toEqual([
      ['condition', 'J’ai le budget ?', null],
      ['task', 'Commander maintenant', 'Oui'],
      ['task', 'Installer et tester', null]
    ])
    expect(result.dependencies.map((entry) => [entry.kind, entry.triggerLabel])).toEqual([
      ['on_trigger', 'mission payée']
    ])
  })

  it('should_read_a_reflection_with_the_titles_of_its_source_sub_neurons', () => {
    root('idee')
    t.handle.db
      .insert(neurons)
      .values({
        id: 'sub',
        rootId: 'idee',
        parentId: 'idee',
        depth: 1,
        kind: 'answer',
        title: 'budget : 250 €',
        origin: 'user'
      })
      .run()
    t.handle.db
      .insert(reflectionSummaries)
      .values({
        id: 'r1',
        rootId: 'idee',
        synthesisId: 's1',
        keyPointsJson: JSON.stringify([{ text: 'Essayer en petit', sourceIds: ['sub', 'disparu'] }]),
        decisionsJson: '[]',
        prosJson: '[]',
        consJson: '[]',
        openQuestionsJson: JSON.stringify([{ text: 'Quel budget ?' }])
      })
      .run()

    const result = hatched.result('idee')
    if (result?.type !== 'reflection_summary') throw new Error('synthèse attendue')
    expect(result.keyPoints).toEqual([
      { headline: null, text: 'Essayer en petit', sources: [{ id: 'sub', title: 'budget : 250 €' }] }
    ])
    expect(result.openQuestions).toEqual([{ text: 'Quel budget ?' }])
  })

  it('should_return_nothing_when_the_idea_has_not_hatched', async () => {
    const created = await t.neurons.create({ text: 'Idée brute' })
    expect(hatched.result(created.id)).toBeNull()
  })
})
