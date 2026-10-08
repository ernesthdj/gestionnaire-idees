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

describe('disposition d’un plan en sens alterné (spec 022 D11, R4 ; spec 011 R4, spec 012 R1)', () => {
  const steps = [step('a', G, 1), step('b', G, 2), step('a1', 'a', 1, 2), step('a1x', 'a1', 1, 3)]

  it('should_stack_steps_under_the_genesis_then_alternate_row_and_column_when_going_down', () => {
    const at = positions(planLayout({ genesisId: G, center, steps, proposals: [] }).items)
    const p = (id: string): { x: number; y: number } => at.get(id) ?? { x: NaN, y: NaN }
    expect(p('a').x).toBe(center.x)
    expect(p('a').y).toBeGreaterThan(center.y)
    expect(p('b').x).toBe(center.x)
    expect(p('a1').y).toBe(p('a').y)
    expect(p('a1').x).toBeGreaterThan(p('a').x)
    // Niveau 3 : en colonne sous son parent, et il pousse « b » plus bas.
    expect(p('a1x').x).toBe(p('a1').x)
    expect(p('a1x').y).toBeGreaterThan(p('a1').y)
    expect(p('b').y).toBeGreaterThan(p('a1x').y)
  })

  it('should_place_annexes_after_the_steps_of_their_node_and_link_them', () => {
    const plan = planLayout({ genesisId: G, center, steps, proposals: [], documents: [document('d', 'a')] })
    const at = positions(plan.items)
    const doc = at.get(documentNodeId('d'))
    expect(doc?.y).toBe(at.get('a')?.y)
    expect(doc?.x).toBeGreaterThan(at.get('a1')?.x ?? 0)
    expect(plan.edges).toContainEqual(
      expect.objectContaining({ source: 'a', target: documentNodeId('d'), annex: true })
    )
  })

  it('should_put_a_genesis_document_in_its_column_after_its_steps', () => {
    const at = positions(
      planLayout({ genesisId: G, center, steps, proposals: [], documents: [document('g', G)] }).items
    )
    expect(at.get(documentNodeId('g'))?.x).toBe(center.x)
    expect(at.get(documentNodeId('g'))?.y).toBeGreaterThan(at.get('b')?.y ?? 0)
  })

  it('should_start_beside_the_genesis_when_it_carries_a_structure_map', () => {
    const at = positions(planLayout({ genesisId: G, center, steps, proposals: [], beside: true }).items)
    expect(at.get('a')?.x).toBeGreaterThan(center.x)
    expect(at.get('a')?.y).toBe(center.y)
  })

  it('should_swap_rows_and_columns_when_transposed', () => {
    const at = positions(planLayout({ genesisId: G, center, steps, proposals: [], transposed: true }).items)
    expect(at.get('a')?.y).toBe(center.y)
    expect(at.get('b')?.x).toBeGreaterThan(at.get('a')?.x ?? 0)
    expect(at.get('a1')?.x).toBe(at.get('a')?.x)
    expect(at.get('a1')?.y).toBeGreaterThan(at.get('a')?.y ?? 0)
  })

  it('should_hide_the_descendants_of_a_folded_step_at_its_place_and_bring_the_next_steps_closer', () => {
    const open = planLayout({ genesisId: G, center, steps, proposals: [] })
    const folded = planLayout({
      genesisId: G,
      center,
      steps: steps.map((entry) => (entry.id === 'a1' ? { ...entry, collapsed: true } : entry)),
      proposals: []
    })
    const hidden = folded.items.find((item) => item.kind === 'step' && item.step.id === 'a1x')
    expect(hidden?.folded).toBe(true)
    expect(positions(folded.items).get('a1x')).toEqual(positions(folded.items).get('a1'))
    expect(folded.edges.some((edge) => edge.target === 'a1x')).toBe(false)
    expect(positions(folded.items).get('b')?.y).toBeLessThan(positions(open.items).get('b')?.y ?? 0)
  })

  it('should_fold_the_whole_plan_into_the_genesis_when_the_root_is_collapsed', () => {
    const plan = planLayout({ genesisId: G, center, steps, proposals: [], rootCollapsed: true })
    expect(plan.items.every((item) => item.folded && item.x === center.x && item.y === center.y)).toBe(true)
    expect(plan.edges).toEqual([])
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

  it('should_put_the_deliverable_of_an_action_before_its_documents', () => {
    const deliverable: DeliverableView = {
      neuronId: 'a',
      genesisId: G,
      files: [],
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
    expect(at.get(deliverableNodeId('a'))?.y).toBe(at.get('a')?.y)
    expect(at.get(deliverableNodeId('a'))?.x).toBeLessThan(at.get(documentNodeId('cdc'))?.x ?? 0)
    expect(plan.edges).toContainEqual(
      expect.objectContaining({ source: 'a', target: deliverableNodeId('a'), annex: true })
    )
  })

  it('should_be_deterministic', () => {
    const input = { genesisId: G, center, steps, proposals: [], documents: [document('d', G)] }
    expect(planLayout(input)).toEqual(planLayout(input))
  })
})
