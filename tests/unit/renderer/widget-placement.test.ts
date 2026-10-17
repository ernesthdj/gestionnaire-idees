import { describe, expect, it } from 'vitest'
import { besideAnchor } from '../../../src/renderer/src/canvas/widgetPlacement'

const SIZE = { width: 400, height: 300 }

describe('widget posé à côté de son nœud (spec 026 D11)', () => {
  it('should_place_the_widget_right_of_the_node_when_the_room_is_free', () => {
    const anchor = { x: 100, y: 200, width: 160, height: 100 }
    expect(besideAnchor(anchor, SIZE, [anchor])).toEqual({ x: 100 + 80 + 48 + 200, y: 200 })
  })

  it('should_shift_the_widget_down_then_up_when_a_node_takes_the_place', () => {
    const anchor = { x: 0, y: 0, width: 160, height: 100 }
    const blocker = { x: 328, y: 0, width: 160, height: 100 }
    const placed = besideAnchor(anchor, SIZE, [anchor, blocker])
    expect(placed.x).toBe(328)
    expect(Math.abs(placed.y)).toBeGreaterThanOrEqual(150)
  })

  it('should_fall_back_beside_the_node_when_everything_is_taken', () => {
    const anchor = { x: 0, y: 0, width: 160, height: 100 }
    const wall = { x: 328, y: 0, width: 400, height: 100_000 }
    expect(besideAnchor(anchor, SIZE, [anchor, wall])).toEqual({ x: 328, y: 0 })
  })
})
