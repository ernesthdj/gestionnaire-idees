import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { demoId, seedDemo } from '../../../src/main/infrastructure/db/demo/seedDemo'
import { HatchedRepository } from '../../../src/main/infrastructure/db/repositories/HatchedRepository'
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

  const get = async (rootId: string) => hatched.result(rootId)

  it('should_read_a_full_plan_with_its_condition_branches_dependency_and_trigger', async () => {
    seedDemo(t.handle.db)
    // Idées 61 à 100 : écloses ; la 61e (i = 0) a le plan complet.
    const result = await get(demoId('root', 10))
    expect(result?.type).toBe('action_plan')
    if (result?.type !== 'action_plan') return
    expect(result.nodes.map((node) => [node.type, node.title, node.branchLabel])).toEqual([
      ['condition', 'J’ai le budget ?', null],
      ['task', 'Commander maintenant', 'Oui'],
      ['task', 'Attendre la mission payée', 'Non'],
      ['task', 'Installer et tester', null],
      ['task', 'Commander après la mission', null],
      ['opportunity', 'Revendre l’ancien matériel', null]
    ])
    expect(result.dependencies.map((dependency) => [dependency.kind, dependency.triggerLabel])).toEqual([
      ['after_done', null],
      ['on_trigger', 'mission payée']
    ])
  })

  it('should_read_a_reflection_with_the_titles_of_its_source_sub_neurons', async () => {
    seedDemo(t.handle.db)
    const result = await get(demoId('root', 11))
    expect(result?.type).toBe('reflection_summary')
    if (result?.type !== 'reflection_summary') return
    expect(result.keyPoints).toEqual([
      {
        headline: null,
        text: 'Idée fictive de démonstration',
        sources: [{ id: demoId('sub', 110), title: 'budget : 250 €' }]
      }
    ])
    expect(result.pros[0]?.sources.map((source) => source.title)).toEqual(['budget : 250 €', 'échéance : ce mois-ci'])
    expect(result.openQuestions).toEqual([{ text: 'Quel budget ?' }])
  })

  it('should_return_nothing_when_the_idea_has_not_hatched', async () => {
    const root = await t.neurons.create({ text: 'Idée brute' })
    expect(await get(root.id)).toBeNull()
  })
})
