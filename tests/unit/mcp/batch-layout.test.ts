import { describe, expect, it } from 'vitest'
import { resolveBatch, type ExistingKind } from '../../../src/main/domain/mcp/batch'
import { layoutBatch, type LayoutItem, type Rect } from '../../../src/main/domain/mcp/layout'
import type { DessinerInput } from '../../../src/shared/mcp/tools'

const IDEA = '0f8b2a52-6d1c-4f3e-9a7b-2c4d5e6f7a8b'
const WIDGET = '1f8b2a52-6d1c-4f3e-9a7b-2c4d5e6f7a8b'
const GONE = '2f8b2a52-6d1c-4f3e-9a7b-2c4d5e6f7a8b'
const existing = (id: string): ExistingKind | undefined => (id === IDEA ? 'idea' : id === WIDGET ? 'other' : undefined)

const batch = (input: Partial<DessinerInput> & Pick<DessinerInput, 'noeuds'>): DessinerInput => input

describe('résolution d’un lot', () => {
  it('should_resolve_keys_parents_depths_and_links_to_existing_elements', () => {
    const result = resolveBatch(
      batch({
        noeuds: [
          { cle: 'a', titre: 'A' },
          { cle: 'b', titre: 'B', parent: 'a' },
          { cle: 'c', titre: 'C', parent: 'b', type: 'idee' },
          { cle: 'd', titre: 'D', parent: IDEA }
        ],
        liens: [{ de: 'a', vers: IDEA, libelle: 'budget' }]
      }),
      existing
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.batch.nodes.map((node) => [node.key, node.depth])).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 2],
      ['d', 0]
    ])
    expect(result.batch.nodes[3]?.parent).toEqual({ kind: 'existing', id: IDEA, existing: 'idea' })
    expect(result.batch.links[0]).toEqual({
      from: { kind: 'key', key: 'a' },
      to: { kind: 'existing', id: IDEA, existing: 'idea' },
      label: 'budget'
    })
  })

  it('should_refuse_duplicated_keys', () => {
    const result = resolveBatch(
      batch({
        noeuds: [
          { cle: 'a', titre: 'A' },
          { cle: 'a', titre: 'B' }
        ]
      }),
      existing
    )
    expect(result).toMatchObject({ ok: false, problem: { code: 'LOT_INVALIDE' } })
  })

  it('should_name_the_faulty_link_when_it_points_to_a_missing_key', () => {
    const result = resolveBatch(
      batch({ noeuds: [{ cle: 'a', titre: 'A' }], liens: [{ de: 'a', vers: 'zz' }] }),
      existing
    )
    expect(result).toMatchObject({
      ok: false,
      problem: { code: 'LOT_INVALIDE', message: expect.stringContaining('liens[0].vers') }
    })
  })

  it('should_report_a_missing_existing_element_as_not_found', () => {
    const result = resolveBatch(batch({ noeuds: [{ cle: 'a', titre: 'A', parent: GONE }] }), existing)
    expect(result).toMatchObject({ ok: false, problem: { code: 'INTROUVABLE' } })
  })

  it('should_refuse_a_cycle_of_parents_and_a_self_link', () => {
    expect(
      resolveBatch(
        batch({
          noeuds: [
            { cle: 'a', titre: 'A', parent: 'b' },
            { cle: 'b', titre: 'B', parent: 'a' }
          ]
        }),
        existing
      )
    ).toMatchObject({ ok: false, problem: { code: 'LOT_INVALIDE' } })
    expect(
      resolveBatch(batch({ noeuds: [{ cle: 'a', titre: 'A' }], liens: [{ de: 'a', vers: 'a' }] }), existing)
    ).toMatchObject({
      ok: false
    })
  })

  it('should_refuse_a_widget_as_parent', () => {
    expect(resolveBatch(batch({ noeuds: [{ cle: 'a', titre: 'A', parent: WIDGET }] }), existing)).toMatchObject({
      ok: false,
      problem: { code: 'LOT_INVALIDE' }
    })
  })

  it('should_refuse_a_batch_over_200_nodes_with_the_limit_in_the_message', () => {
    const noeuds = Array.from({ length: 230 }, (_, index) => ({ cle: `n${index}`, titre: `N${index}` }))
    expect(resolveBatch(batch({ noeuds }), existing)).toMatchObject({
      ok: false,
      problem: { code: 'LOT_TROP_GROS', message: expect.stringContaining('maximum 200') }
    })
  })
})

const item = (key: string, parent: string | null = null, height = 80): LayoutItem => ({
  key,
  parent,
  width: 240,
  height
})

const boxes = (centers: ReadonlyMap<string, { x: number; y: number }>, items: readonly LayoutItem[]): Rect[] =>
  items.map((it) => ({ ...(centers.get(it.key) as { x: number; y: number }), width: it.width, height: it.height }))

const overlap = (a: Rect, b: Rect): boolean =>
  Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.y - b.y) < (a.height + b.height) / 2

describe('placement d’un lot', () => {
  it('should_put_each_depth_in_its_own_column_and_center_parents_on_their_children', () => {
    const items = [item('a'), item('b', 'a'), item('c', 'a')]
    const { centers } = layoutBatch({ items, occupied: [], framed: false })
    const [a, b, c] = ['a', 'b', 'c'].map((key) => centers.get(key) as { x: number; y: number })
    expect(b?.x).toBeGreaterThan(a?.x ?? 0)
    expect(b?.x).toBe(c?.x)
    expect(a?.y).toBeCloseTo(((b?.y ?? 0) + (c?.y ?? 0)) / 2)
  })

  it('should_never_overlap_its_own_items_nor_existing_ones', () => {
    const occupied: Rect[] = [
      { x: 0, y: 0, width: 600, height: 400 },
      { x: 900, y: 100, width: 300, height: 300 }
    ]
    const items = [
      ...Array.from({ length: 40 }, (_, index) => item(`r${index}`, null, 56 + (index % 5) * 30)),
      ...Array.from({ length: 160 }, (_, index) => item(`c${index}`, `r${index % 40}`))
    ]
    const { centers, frame } = layoutBatch({ items, occupied, framed: true })
    const placed = boxes(centers, items)
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) expect(overlap(placed[i] as Rect, placed[j] as Rect)).toBe(false)
      for (const rect of occupied) expect(overlap(placed[i] as Rect, rect)).toBe(false)
    }
    for (const rect of occupied) expect(overlap(frame as Rect, rect)).toBe(false)
  })

  it('should_wrap_every_item_in_the_frame_with_room_for_its_title', () => {
    const items = [item('a'), item('b', 'a'), item('c')]
    const { centers, frame } = layoutBatch({ items, occupied: [], framed: true })
    expect(frame).not.toBeNull()
    const f = frame as Rect
    for (const rect of boxes(centers, items)) {
      expect(rect.x - rect.width / 2).toBeGreaterThanOrEqual(f.x - f.width / 2)
      expect(rect.x + rect.width / 2).toBeLessThanOrEqual(f.x + f.width / 2)
      expect(rect.y - rect.height / 2).toBeGreaterThan(f.y - f.height / 2 + 40)
      expect(rect.y + rect.height / 2).toBeLessThanOrEqual(f.y + f.height / 2)
    }
  })

  it('should_go_below_the_anchor_when_one_is_given', () => {
    const anchor: Rect = { x: 500, y: 500, width: 200, height: 100 }
    const { centers } = layoutBatch({ items: [item('a')], occupied: [anchor], anchor, framed: false })
    const a = centers.get('a') as { x: number; y: number }
    expect(a.y - 40).toBeGreaterThan(anchor.y + anchor.height / 2)
    expect(Math.abs(a.x - 120 - (anchor.x - anchor.width / 2))).toBeLessThan(1)
  })

  it('should_be_deterministic', () => {
    const items = [item('a'), item('b', 'a'), item('c', 'b')]
    const first = layoutBatch({ items, occupied: [{ x: 0, y: 0, width: 100, height: 100 }], framed: true })
    const second = layoutBatch({ items, occupied: [{ x: 0, y: 0, width: 100, height: 100 }], framed: true })
    expect([...second.centers]).toEqual([...first.centers])
    expect(second.frame).toEqual(first.frame)
  })
})
