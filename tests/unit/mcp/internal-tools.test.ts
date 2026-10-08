import { describe, expect, it, vi } from 'vitest'
import { createToolHandler } from '../../../src/main/application/mcp/toolHandler'
import { WRITE_REFUSED_PREFIX } from '../../../src/shared/mcp/hook'
import { MCP_PUBLIC_TOOL_NAMES, MCP_TOOL_NAMES } from '../../../src/shared/mcp/tools'

type HandlerArgs = Parameters<typeof createToolHandler>

describe('outil interne du hook avant écriture (spec 014 R5)', () => {
  const before = vi.fn(() => ({ text: 'suivi' }))
  const handle = createToolHandler(...([{}, {}, {}, {}, {}, {}, undefined, { before }] as unknown as HandlerArgs))
  const input = { tool: 'Write', file_path: 'C:\\p\\a.ts', tool_use_id: 'toolu_1' }

  it('should_never_offer_the_internal_tool_to_claude', () => {
    expect(MCP_TOOL_NAMES).toContain('ecriture_avant')
    expect(MCP_PUBLIC_TOOL_NAMES).not.toContain('ecriture_avant')
    expect(MCP_PUBLIC_TOOL_NAMES).toContain('permission_demander')
  })

  it('should_refuse_the_hook_outside_a_conversation_of_the_app', () => {
    expect(() => handle('ecriture_avant', input, { neuronId: null })).toThrow(
      expect.objectContaining({ code: 'NON_MODIFIABLE' })
    )
    expect(before).not.toHaveBeenCalled()
  })

  it('should_pass_the_write_to_the_deliverable_tracker_for_the_calling_conversation', () => {
    const neuronId = '00000000-0000-4000-8000-0000000000c1'
    expect(handle('ecriture_avant', input, { neuronId })).toEqual({ text: 'suivi' })
    expect(before).toHaveBeenCalledWith(neuronId, input)
  })

  it('should_refuse_a_write_rejected_by_the_analyst_guard_without_tracking_it', () => {
    const tracked = vi.fn(() => ({ text: 'suivi' }))
    const guard = vi.fn((_neuron: string, path: string) => (path.includes('node_modules') ? 'Écriture refusée.' : null))
    const guarded = createToolHandler(
      ...([
        {},
        {},
        {},
        {},
        {},
        {},
        undefined,
        { before: tracked },
        undefined,
        undefined,
        guard
      ] as unknown as HandlerArgs)
    )
    const neuronId = '00000000-0000-4000-8000-0000000000c2'
    expect(guarded('ecriture_avant', { ...input, file_path: 'C:/p/node_modules/x.js' }, { neuronId })).toEqual({
      text: `${WRITE_REFUSED_PREFIX}Écriture refusée.`
    })
    expect(tracked).not.toHaveBeenCalled()
    expect(guarded('ecriture_avant', input, { neuronId })).toEqual({ text: 'suivi' })
  })
})
