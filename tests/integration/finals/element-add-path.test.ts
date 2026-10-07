import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ElementRepository } from '../../../src/main/infrastructure/db/repositories/ElementRepository'
import { neurons } from '../../../src/main/infrastructure/db/schemaNeurons'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

describe('chemins d’un élément enrichis par les fichiers écrits', () => {
  let t: NeuronHarness
  let repository: ElementRepository
  let element: string

  beforeEach(async () => {
    t = createNeuronHarness()
    repository = new ElementRepository(t.handle.db)
    const genesis = (await t.neurons.create({ text: 'Projet' })).id
    element = (await t.neurons.create({ text: 'Élément' })).id
    t.handle.db
      .update(neurons)
      .set({ kind: 'element', genesisId: genesis, pathsJson: JSON.stringify(['src/main']) })
      .where(eq(neurons.id, element))
      .run()
  })
  afterEach(() => t.dispose())

  const paths = (): unknown =>
    JSON.parse(t.handle.db.select().from(neurons).where(eq(neurons.id, element)).get()?.pathsJson ?? '[]')

  it('should_append_a_new_path_once_and_skip_the_ones_already_covered', () => {
    expect(repository.addPath(element, 'docs/guide.md')).toBe(true)
    expect(repository.addPath(element, 'docs/guide.md')).toBe(false)
    expect(repository.addPath(element, 'src/main/a.ts')).toBe(false)
    expect(paths()).toEqual(['src/main', 'docs/guide.md'])
  })

  it('should_ignore_a_neuron_that_is_not_an_element', async () => {
    const idea = (await t.neurons.create({ text: 'Idée' })).id
    expect(repository.addPath(idea, 'a.md')).toBe(false)
  })
})
