import { describe, expect, it } from 'vitest'
import {
  deliverableNodeId,
  documentNodeId,
  planLayout,
  type PlacedPlanItem
} from '../../../src/renderer/src/canvas/planLayout'
import type { StepView } from '../../../src/shared/ipc/canvas'
import type { DocumentView } from '../../../src/shared/ipc/documents'
import type { DeliverableView } from '../../../src/shared/ipc/finals'

const G = 'genesis'
const center = { x: 0, y: 0 }

const step = (id: string, parentId: string, rank: number, depth = 1): StepView => ({
  id,
  genesisId: G,
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

const document = (id: string, neuronId: string, width = 360, height = 280): DocumentView => ({
  id,
  neuronId,
  genesisId: G,
  title: id,
  fileLabel: `documents/${id}.md`,
  width,
  height,
  origin: 'claude',
  offset: { x: 0, y: 0 }
})

const idOf = (item: PlacedPlanItem): string =>
  item.kind === 'step'
    ? item.step.id
    : item.kind === 'document'
      ? documentNodeId(item.document.id)
      : item.kind === 'deliverable'
        ? deliverableNodeId(item.deliverable.neuronId)
        : item.kind
const positions = (items: readonly PlacedPlanItem[]): Map<string, { x: number; y: number }> =>
  new Map(items.map((item) => [idOf(item), { x: item.x, y: item.y }]))

describe('disposition d’un plan avec ses documents (spec 011 R4, spec 012 R1)', () => {
  it('should_keep_the_historic_step_columns_when_there_is_no_document', () => {
    const plan = planLayout({ genesisId: G, center, steps: [step('a', G, 1), step('a1', 'a', 1, 2)], proposals: [] })
    const at = positions(plan.items)
    expect(at.get('a')?.x).toBe(240)
    expect(at.get('a1')?.x).toBe(520)
  })

  it('should_annex_a_step_document_just_below_the_step_on_the_same_left_edge_and_push_its_siblings_down', () => {
    const plan = planLayout({
      genesisId: G,
      center,
      steps: [step('a', G, 1), step('b', G, 2)],
      proposals: [],
      documents: [document('cdc', 'a', 360, 200)]
    })
    const at = positions(plan.items)
    const a = at.get('a')
    const doc = at.get(documentNodeId('cdc'))
    const b = at.get('b')
    // Juste sous la carte de l'étape (72 px de haut), calé sur son bord gauche.
    expect((doc?.y ?? 0) - 100).toBe((a?.y ?? 0) + 36 + 24)
    expect((doc?.x ?? 0) - 180).toBe((a?.x ?? 0) - 120)
    // L'étape suivante passe sous l'annexe.
    expect((b?.y ?? 0) - 36).toBeGreaterThan((doc?.y ?? 0) + 100)
    expect(plan.edges).toContainEqual(
      expect.objectContaining({ source: 'a', target: documentNodeId('cdc'), annex: true })
    )
  })

  it('should_annex_a_genesis_document_below_the_genesis_without_entering_the_steps_column', () => {
    const plan = planLayout({
      genesisId: G,
      center,
      steps: [step('a', G, 1)],
      proposals: [],
      documents: [document('cdc', G, 360, 200)]
    })
    const at = positions(plan.items)
    const doc = at.get(documentNodeId('cdc'))
    const a = at.get('a')
    expect((doc?.y ?? 0) - 100).toBeGreaterThan(center.y)
    expect((doc?.x ?? 0) + 180).toBeLessThan((a?.x ?? 0) - 120)
  })

  it('should_widen_a_column_to_its_widest_annex_and_push_the_next_column_without_overlap', () => {
    const plan = planLayout({
      genesisId: G,
      center,
      steps: [step('a', G, 1), step('a1', 'a', 1, 2)],
      proposals: [],
      documents: [document('large', 'a', 800, 300)]
    })
    const at = positions(plan.items)
    const large = at.get(documentNodeId('large'))
    const child = at.get('a1')
    expect((child?.x ?? 0) - 100).toBeGreaterThanOrEqual((large?.x ?? 0) + 400)
  })

  it('should_move_a_dragged_step_with_its_whole_branch_and_annexes', () => {
    const base = { genesisId: G, center, proposals: [], documents: [document('d', 'a')] }
    const before = positions(planLayout({ ...base, steps: [step('a', G, 1), step('a1', 'a', 1, 2)] }).items)
    const moved = { ...step('a', G, 1), offset: { x: 50, y: -30 } }
    const after = positions(planLayout({ ...base, steps: [moved, step('a1', 'a', 1, 2)] }).items)
    for (const id of ['a', 'a1', documentNodeId('d')]) {
      expect(after.get(id)).toEqual({ x: (before.get(id)?.x ?? 0) + 50, y: (before.get(id)?.y ?? 0) - 30 })
    }
  })

  it('should_move_a_dragged_document_alone', () => {
    const base = { genesisId: G, center, proposals: [], steps: [step('a', G, 1)] }
    const before = positions(planLayout({ ...base, documents: [document('d', 'a')] }).items)
    const after = positions(
      planLayout({ ...base, documents: [{ ...document('d', 'a'), offset: { x: -400, y: 0 } }] }).items
    )
    expect(after.get(documentNodeId('d'))?.x).toBe((before.get(documentNodeId('d'))?.x ?? 0) - 400)
    expect(after.get('a')).toEqual(before.get('a'))
  })

  it('should_put_the_deliverable_of_an_action_first_below_it_and_its_documents_after', () => {
    const deliverable: DeliverableView = {
      neuronId: 'a',
      genesisId: G,
      files: [],
      runs: [],
      executing: true,
      width: 420,
      height: 300,
      offset: { x: 0, y: 0 }
    }
    const plan = planLayout({
      genesisId: G,
      center,
      steps: [step('a', G, 1)],
      proposals: [],
      documents: [document('cdc', 'a', 360, 200)],
      deliverables: [deliverable]
    })
    const at = positions(plan.items)
    const a = at.get('a')
    const livrable = at.get(deliverableNodeId('a'))
    const doc = at.get(documentNodeId('cdc'))
    expect((livrable?.y ?? 0) - 150).toBe((a?.y ?? 0) + 36 + 24)
    expect((doc?.y ?? 0) - 100).toBe((livrable?.y ?? 0) + 150 + 24)
    expect(plan.edges).toContainEqual(
      expect.objectContaining({ source: 'a', target: deliverableNodeId('a'), annex: true })
    )
  })

  it('should_be_deterministic', () => {
    const input = { genesisId: G, center, steps: [step('a', G, 1)], proposals: [], documents: [document('d', G)] }
    expect(planLayout(input)).toEqual(planLayout(input))
  })
})
