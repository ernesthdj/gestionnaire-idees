import { describe, expect, it, vi } from 'vitest'
import type { WidgetIoService } from '../../../src/main/application/widgets/WidgetIoService'
import { createWidgetIoRoutes } from '../../../src/main/ipc/widgetIoHandlers'
import { createDispatcher } from '../../../src/main/ipc/registry'

const BLOCK = '00000000-0000-4000-8000-0000000000b1'
const ELEMENT = '00000000-0000-4000-8000-0000000000e1'
const KEY = 'wf:00000000-0000-4000-8000-0000000000a1:ttask:fab-cd'

describe('canal widgetIo:connect (spec 023 D24)', () => {
  it('should_accept_an_element_by_id_and_a_workflow_node_by_its_key_and_nothing_else', async () => {
    const connect = vi.fn(() => ({ blockId: BLOCK, inputs: [], approved: false }))
    const dispatch = createDispatcher(createWidgetIoRoutes({ connect } as unknown as WidgetIoService))
    expect(
      (await dispatch('widgetIo:connect', { blockId: BLOCK, sourceKind: 'element', sourceId: ELEMENT })).success
    ).toBe(true)
    expect(
      (await dispatch('widgetIo:connect', { blockId: BLOCK, sourceKind: 'workflow', sourceId: KEY })).success
    ).toBe(true)
    expect(connect).toHaveBeenCalledTimes(2)
    for (const bad of [
      { blockId: BLOCK, sourceKind: 'workflow', sourceId: ELEMENT },
      { blockId: BLOCK, sourceKind: 'workflow', sourceId: '../../etc/passwd' },
      { blockId: BLOCK, sourceKind: 'element', sourceId: KEY },
      { blockId: BLOCK, sourceKind: 'step', sourceId: ELEMENT }
    ]) {
      expect((await dispatch('widgetIo:connect', bad)).success).toBe(false)
    }
    expect(connect).toHaveBeenCalledTimes(2)
  })
})
