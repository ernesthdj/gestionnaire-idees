import { describe, expect, it } from 'vitest'
import { MCP_INSTRUCTIONS, MCP_TOOLS } from '../../../src/shared/mcp/tools'

describe('consignes du pont MCP (spec 023 D27, spec 032 D11)', () => {
  it('should_tell_claude_that_a_linked_project_works_in_files_with_a_document_header', () => {
    expect(MCP_INSTRUCTIONS).toContain('le travail se fait dans la vue Workflow')
    expect(MCP_INSTRUCTIONS).toContain('**Parent** : <document> · **Maturité** : insuffisant | suffisant | complet')
    expect(MCP_INSTRUCTIONS).toContain('pas avec `maturite_evaluer`')
    expect(MCP_TOOLS.maturite_evaluer.description).toContain('**Maturité**')
    expect(MCP_TOOLS.structure_dessiner.description).toContain('`tache`, `decision` refusés')
  })
})
