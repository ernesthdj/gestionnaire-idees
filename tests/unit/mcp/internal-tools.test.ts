import { describe, expect, it, vi } from 'vitest'
import { createToolHandler } from '../../../src/main/application/mcp/toolHandler'
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
})
