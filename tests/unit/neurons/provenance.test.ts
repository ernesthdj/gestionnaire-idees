import { describe, expect, it } from 'vitest'
import type { ActionPlanOut } from '../../../src/shared/ai/neurons'
import { extractValues, isUserDate } from '../../../src/main/domain/neurons/extractValues'
import { applyProvenance } from '../../../src/main/domain/neurons/provenance'

type PlanNode = ActionPlanOut['nodes'][number]

const plan = (nodes: PlanNode[]): ActionPlanOut => ({ nodes, dependencies: [], gaps: [], tools: [], toolsNote: '' })
const task = (extra: Partial<PlanNode>): PlanNode => ({
  ref: 't1',
  type: 'task',
  title: 'Acheter',
  sourceRefs: [],
  ...extra
})

describe('extraction des valeurs écrites par l’utilisateur (P6)', () => {
  it('should_extract_french_amounts_with_and_without_currency', () => {
    const values = extractValues(['environ 250 €', 'budget 1 200,50 euros', '2k max', 'je peux mettre 80'])
    expect([...values.amountsCents]).toEqual(expect.arrayContaining([25_000, 120_050, 200_000, 8_000]))
    expect(values.euroAmountsCents.has(25_000)).toBe(true)
    expect(values.euroAmountsCents.has(8_000)).toBe(false)
  })

  it('should_extract_iso_numeric_and_written_dates', () => {
    const values = extractValues([
      'le 2026-11-03',
      'avant le 15/12/2026',
      'vers le 1er mars',
      'le 24 août 2027',
      'le 5/10'
    ])
    expect(values.dates).toEqual(new Set(['2026-11-03', '2026-12-15', '2027-08-24']))
    expect(values.monthDays).toEqual(new Set(['03-01', '10-05']))
    expect(isUserDate('2027-03-01', values)).toBe(true)
    expect(isUserDate('2026-03-02', values)).toBe(false)
  })

  it('should_not_read_kilometers_as_thousands', () => {
    expect(extractValues(['250 km']).amountsCents.has(25_000_000)).toBe(false)
  })
})

describe('provenance des montants et dates (P6)', () => {
  it('should_keep_values_written_by_the_user', () => {
    const sources = new Map([
      ['s1', 'budget : environ 250 €'],
      ['s2', 'avant le 15/12/2026']
    ])
    const result = applyProvenance(
      plan([task({ amountCents: 25_000, dueDate: '2026-12-15', sourceRefs: ['s1', 's2'] })]),
      sources
    )
    expect(result.removed).toBe(0)
    expect(result.plan.nodes[0]).toMatchObject({ amountCents: 25_000, dueDate: '2026-12-15' })
  })

  it('should_remove_invented_amount_and_add_to_find_element', () => {
    const result = applyProvenance(plan([task({ amountCents: 39_900, sourceRefs: ['s1'] })]), new Map([['s1', 'Oui']]))
    expect(result.removed).toBe(1)
    expect(result.plan.nodes[0]?.amountCents).toBeUndefined()
    expect(result.plan.nodes[0]?.investigation).toBe(true)
    expect(result.plan.gaps).toContain('Montant à trouver : Acheter')
  })

  it('should_remove_invented_date_and_mark_to_schedule', () => {
    const result = applyProvenance(plan([task({ dueDate: '2026-10-01' })]), new Map([['s1', 'bientôt']]))
    expect(result.plan.nodes[0]).toMatchObject({ investigation: true, toSchedule: true })
    expect(result.plan.nodes[0]?.dueDate).toBeUndefined()
    expect(result.plan.gaps).toContain('Date à trouver : Acheter')
  })

  it('should_restore_exact_amount_masked_as_band_from_single_cited_answer', () => {
    // Claude n'a vu que « [montant 100-500 €] » : il propose le milieu de la fourchette et cite la réponse.
    const result = applyProvenance(
      plan([task({ amountCents: 30_000, sourceRefs: ['s1'] })]),
      new Map([['s1', 'budget : 249,99 €']])
    )
    expect(result.restored).toBe(1)
    expect(result.plan.nodes[0]?.amountCents).toBe(24_999)
  })

  it('should_not_restore_when_cited_answers_hold_several_amounts', () => {
    const result = applyProvenance(
      plan([task({ amountCents: 30_000, sourceRefs: ['s1', 's2'] })]),
      new Map([
        ['s1', '200 €'],
        ['s2', '350 €']
      ])
    )
    expect(result.restored).toBe(0)
    expect(result.plan.nodes[0]?.amountCents).toBeUndefined()
  })

  it('should_keep_zero_invented_values_over_twenty_trees', () => {
    let seed = 42
    const random = (max: number): number => {
      seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31
      return seed % max
    }
    let leaked = 0
    for (let tree = 0; tree < 20; tree++) {
      const userAmount = (random(900) + 100) * 100
      const sources = new Map([
        ['s0', `Idée n°${tree}`],
        ['s1', `budget ${userAmount / 100} €`],
        ['s2', `le ${random(28) + 1}/${random(12) + 1}`]
      ])
      const invented = (random(900) + 1_000) * 100 + 37
      const nodes = [
        task({ ref: 'a', amountCents: invented, sourceRefs: ['s0'] }),
        task({ ref: 'b', dueDate: `2031-0${random(9) + 1}-2${random(8) + 1}`, sourceRefs: ['s2'] }),
        task({ ref: 'c', amountCents: userAmount, sourceRefs: ['s1'] })
      ]
      const checked = applyProvenance(plan(nodes), sources).plan.nodes
      const allowed = extractValues([...sources.values()])
      for (const node of checked) {
        if (node.amountCents !== undefined && !allowed.amountsCents.has(node.amountCents)) leaked++
        if (node.dueDate !== undefined && !isUserDate(node.dueDate, allowed)) leaked++
      }
      expect(checked.find((node) => node.ref === 'c')?.amountCents).toBe(userAmount)
    }
    expect(leaked).toBe(0)
  })
})
