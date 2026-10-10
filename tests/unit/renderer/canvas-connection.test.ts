import { describe, expect, it } from 'vitest'
import { connectionIntent } from '../../../src/renderer/src/canvas/connection'
import type { BlockView, ElementView, StepView } from '../../../src/shared/ipc/canvas'

const view = {
  blocks: [{ id: 'w', kind: 'widget' } as BlockView, { id: 'n', kind: 'note' } as BlockView],
  steps: [{ id: 's' } as StepView],
  elements: [{ id: 'module' } as ElementView]
}

describe('lien tiré sur la carte (spec 015 US1)', () => {
  it('should_connect_a_step_to_a_widget_as_a_plan_step_input', () => {
    expect(connectionIntent(view, 's', 'w')).toEqual({
      kind: 'input',
      blockId: 'w',
      sourceKind: 'plan_step',
      sourceId: 's'
    })
  })

  it('should_keep_connecting_an_idea_to_a_widget_or_linking_two_ideas', () => {
    expect(connectionIntent(view, 'idee', 'w')).toEqual({
      kind: 'input',
      blockId: 'w',
      sourceKind: 'idea',
      sourceId: 'idee'
    })
    expect(connectionIntent(view, 'a', 'b')).toEqual({ kind: 'link', from: 'a', to: 'b' })
  })

  it('should_connect_a_structure_element_or_a_workflow_node_to_a_widget_only', () => {
    const key = 'wf:00000000-0000-4000-8000-0000000000a1:ttask:fab-cd'
    expect(connectionIntent(view, 'module', 'w')).toMatchObject({ kind: 'input', sourceKind: 'element' })
    expect(connectionIntent(view, key, 'w')).toEqual({
      kind: 'input',
      blockId: 'w',
      sourceKind: 'workflow',
      sourceId: key
    })
    expect(connectionIntent(view, 'module', 'idee')).toBeNull()
    expect(connectionIntent(view, key, 'idee')).toBeNull()
  })

  it('should_refuse_a_step_towards_anything_but_a_widget_and_a_node_towards_itself', () => {
    expect(connectionIntent(view, 's', 'idee')).toBeNull()
    expect(connectionIntent(view, 's', 'n')).toBeNull()
    expect(connectionIntent(view, 'w', 'w')).toBeNull()
    expect(connectionIntent(undefined, 'a', 'b')).toBeNull()
  })
})
