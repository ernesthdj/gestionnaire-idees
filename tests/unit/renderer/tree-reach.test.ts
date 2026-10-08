import { describe, expect, it } from 'vitest'
import { treeReach } from '../../../src/renderer/src/canvas/treeReach'
import type { IdeasCanvasView, StepView } from '../../../src/shared/ipc/canvas'
import { canvasView, HATCHED_A_ID } from '../../fixtures/ui/canvas'

const step = (id: string, parentId: string, rank: number, depth = 1): StepView => ({
  id,
  genesisId: HATCHED_A_ID,
  parentId,
  depth,
  rank,
  title: id,
  status: 'a_faire',
  locked: false,
  lockProposed: false,
  waitsFor: [],
  offset: { x: 0, y: 0 }
})

const withSteps = (steps: StepView[], fold = false): IdeasCanvasView => {
  const base = canvasView()
  return {
    ...base,
    ideas: base.ideas.map((idea) => (idea.id === HATCHED_A_ID && fold ? { ...idea, planCollapsed: true } : idea)),
    steps
  }
}

describe('portée de l’arbre d’une idée (spec 022, physique)', () => {
  it('should_be_zero_when_the_idea_has_no_tree', () => {
    expect(treeReach(canvasView(), HATCHED_A_ID)).toBe(0)
    expect(treeReach(canvasView(), 'unknown')).toBe(0)
  })

  it('should_grow_with_the_plan_when_steps_are_added', () => {
    const small = treeReach(withSteps([step('a', HATCHED_A_ID, 1)]), HATCHED_A_ID)
    const large = treeReach(
      withSteps([
        step('a', HATCHED_A_ID, 1),
        step('b', HATCHED_A_ID, 2),
        step('c', HATCHED_A_ID, 3),
        step('a1', 'a', 1, 2)
      ]),
      HATCHED_A_ID
    )
    expect(small).toBeGreaterThan(0)
    expect(large).toBeGreaterThan(small)
  })

  it('should_shrink_to_nothing_when_the_whole_plan_is_folded', () => {
    const steps = [step('a', HATCHED_A_ID, 1), step('b', HATCHED_A_ID, 2)]
    expect(treeReach(withSteps(steps, true), HATCHED_A_ID)).toBe(0)
    expect(treeReach(withSteps(steps), HATCHED_A_ID)).toBeGreaterThan(0)
  })
})
