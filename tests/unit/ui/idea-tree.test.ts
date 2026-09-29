import { describe, expect, it } from 'vitest'
import { ideaTreeLayout, ITEM_SPACING, RING } from '../../../src/renderer/src/canvas/ideaTreeLayout'
import { CHILD_ID, developingTree, ROOT_ID } from '../../fixtures/ui/dive'

const distance = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y)

describe('arbre d’une idée ouverte sur la carte', () => {
  it('should_place_sub_neurons_around_the_idea_and_attach_questions_and_ghosts_to_the_focus', () => {
    const tree = developingTree()
    const layout = ideaTreeLayout(tree, ROOT_ID)
    const neurons = layout.items.filter((placed) => placed.item.type === 'neuron')
    expect(neurons).toHaveLength(tree.neurons.length)
    // Questions et fantômes de l'idée elle-même : accrochés au centre.
    const extras = layout.items.filter((placed) => placed.item.type === 'slot' || placed.item.type === 'ghost')
    expect(extras.length).toBe(
      tree.extensions.filter((extension) => extension.neuronId === ROOT_ID).length +
        tree.suggestions.filter((suggestion) => suggestion.neuronId === ROOT_ID).length
    )
    expect(extras.every((placed) => placed.fromRoot)).toBe(true)
  })

  it('should_put_each_level_on_its_own_ring_further_than_its_parent', () => {
    const layout = ideaTreeLayout(developingTree(), ROOT_ID)
    for (const placed of layout.items) {
      const radius = distance(placed.point, { x: 0, y: 0 })
      expect(radius).toBeGreaterThanOrEqual(RING - 0.1)
      if (!placed.fromRoot) expect(radius).toBeGreaterThan(distance(placed.from, { x: 0, y: 0 }))
    }
    expect(layout.extent).toBeGreaterThan(RING)
  })

  it('should_keep_items_of_the_first_ring_apart', () => {
    const layout = ideaTreeLayout(developingTree(), ROOT_ID)
    const first = layout.items.filter((placed) => placed.fromRoot)
    for (let i = 0; i < first.length; i++) {
      for (let j = i + 1; j < first.length; j++) {
        expect(distance((first[i] as (typeof first)[0]).point, (first[j] as (typeof first)[0]).point)).toBeGreaterThan(
          ITEM_SPACING / 2
        )
      }
    }
  })

  it('should_move_questions_and_the_pending_answer_to_the_focused_sub_neuron', () => {
    const layout = ideaTreeLayout(developingTree(), CHILD_ID, [{ extensionId: 'ext-9', title: 'quand : bientôt' }])
    const child = layout.items.find((placed) => placed.item.id === CHILD_ID)
    const pending = layout.items.find((placed) => placed.item.type === 'pending')
    expect(pending?.from).toEqual(child?.point)
    expect(layout.items.filter((placed) => placed.item.type === 'slot').every((placed) => !placed.fromRoot)).toBe(true)
  })

  it('should_fall_back_to_the_idea_when_the_focused_neuron_no_longer_exists', () => {
    const layout = ideaTreeLayout(developingTree(), 'disparu')
    expect(layout.items.filter((placed) => placed.item.type === 'slot').every((placed) => placed.fromRoot)).toBe(true)
  })

  it('should_be_deterministic', () => {
    expect(ideaTreeLayout(developingTree(), ROOT_ID)).toEqual(ideaTreeLayout(developingTree(), ROOT_ID))
  })
})
