import { describe, expect, it, vi } from 'vitest'
import { ConfidentialityGuard, LOCAL_ONLY_MESSAGE } from '../../../src/main/application/reprise/ConfidentialityGuard'
import { LOCAL_PROJECT_TITLE, maskLocalProjects } from '../../../src/main/domain/reprise/maskLocal'
import type { IdeasCanvasView } from '../../../src/shared/ipc/canvas'

const LOCAL = '00000000-0000-4000-8000-0000000000a1'
const OPEN = '00000000-0000-4000-8000-0000000000a2'
const ELEMENT = '00000000-0000-4000-8000-0000000000a3'
const STEP = '00000000-0000-4000-8000-0000000000a4'
const OTHER_ELEMENT = '00000000-0000-4000-8000-0000000000a5'

/** Vue minimale : seuls les champs que le masquage lit comptent. */
function view(): IdeasCanvasView {
  const idea = (id: string, title: string) => ({ id, title, content: 'description', sheetSummary: 'fiche' })
  return {
    counts: { raw: 2, developing: 0, hatched: 0 },
    ideas: [idea(LOCAL, 'Boutique Acme'), idea(OPEN, 'Mon idée')],
    categories: [],
    highlighted: null,
    blocks: [],
    io: [{ id: 'io1', blockId: 'b1', sourceKind: 'element', sourceId: ELEMENT }],
    mapLinks: [
      { id: 'l1', from: { kind: 'element', id: ELEMENT }, to: { kind: 'idea', id: OPEN }, label: null },
      { id: 'l2', from: { kind: 'idea', id: LOCAL }, to: { kind: 'idea', id: OPEN }, label: null }
    ],
    elements: [
      { id: ELEMENT, genesisId: LOCAL, title: 'module:billing' },
      { id: OTHER_ELEMENT, genesisId: OPEN, title: 'module:ui' }
    ],
    steps: [{ id: STEP, genesisId: LOCAL, parentId: LOCAL, title: 'Migrer la base' }],
    proposals: [
      { id: 'p1', parentId: STEP, items: [] },
      { id: 'p2', parentId: OPEN, items: [] }
    ],
    documents: [{ id: 'd1', neuronId: LOCAL, genesisId: LOCAL, title: 'Guide de reprise' }],
    deliverables: [{ neuronId: STEP, genesisId: LOCAL }]
  } as unknown as IdeasCanvasView
}

describe('confidentialité d’un projet repris (spec 017 FR-004, R5)', () => {
  const rows = new Map([
    [LOCAL, { rootId: LOCAL, genesisId: null }],
    [OPEN, { rootId: OPEN, genesisId: null }],
    [ELEMENT, { rootId: ELEMENT, genesisId: LOCAL }],
    [STEP, { rootId: LOCAL, genesisId: LOCAL }]
  ])
  const guard = new ConfidentialityGuard({
    neuron: (id) => rows.get(id),
    project: (genesisId) => (genesisId === LOCAL ? { confidentiality: 'local' } : undefined),
    documentNeuron: (documentId) => (documentId === 'd1' ? LOCAL : undefined)
  })

  it('should_refuse_claude_for_the_genesis_its_elements_and_its_steps_when_the_project_is_local', () => {
    expect([LOCAL, ELEMENT, STEP, OPEN, 'inconnu'].map((id) => guard.claudeAllowed(id))).toEqual([
      false,
      false,
      false,
      true,
      true
    ])
    expect(() => guard.assertClaudeAllowed(STEP)).toThrow(expect.objectContaining({ code: 'LOCAL_ONLY' }))
  })

  it('should_refuse_bridge_tools_aimed_at_a_local_project_even_from_an_external_session', () => {
    const handle = vi.fn(() => ({ text: 'ok' }))
    const guarded = guard.guardTools(handle)
    const refused = (tool: Parameters<typeof guarded>[0], args: unknown, neuronId: string | null) =>
      expect(() => guarded(tool, args, { neuronId })).toThrow(expect.objectContaining({ message: LOCAL_ONLY_MESSAGE }))
    refused('noeud_lire', { id: ELEMENT }, null)
    refused('document_lire', { document: 'd1' }, null)
    refused('structure_lire', { projet: LOCAL }, null)
    refused('neurone_contexte', {}, STEP)
    refused('etat', {}, ELEMENT)
    expect(handle).not.toHaveBeenCalled()
    expect(guarded('etat', {}, { neuronId: null })).toEqual({ text: 'ok' })
    expect(guarded('noeud_lire', { id: OTHER_ELEMENT }, { neuronId: OPEN })).toEqual({ text: 'ok' })
  })

  it('should_mask_a_local_project_on_the_map_seen_by_claude', () => {
    const masked = maskLocalProjects(view(), (genesisId) => genesisId === LOCAL)
    expect(masked.ideas.find((idea) => idea.id === LOCAL)).toEqual({
      id: LOCAL,
      title: LOCAL_PROJECT_TITLE,
      content: null
    })
    expect(masked.ideas.find((idea) => idea.id === OPEN)?.title).toBe('Mon idée')
    expect(masked.elements.map((element) => element.id)).toEqual([OTHER_ELEMENT])
    expect(masked.steps).toEqual([])
    expect(masked.proposals.map((proposal) => proposal.id)).toEqual(['p2'])
    expect(masked.documents).toEqual([])
    expect(masked.deliverables).toEqual([])
    expect(masked.mapLinks.map((link) => link.id)).toEqual(['l2'])
    expect(masked.io).toEqual([])
    expect(JSON.stringify(masked)).not.toMatch(/Boutique Acme|billing|Migrer la base|Guide de reprise/)
  })

  it('should_leave_the_map_untouched_without_local_project', () => {
    const original = view()
    expect(maskLocalProjects(original, () => false)).toBe(original)
  })
})
