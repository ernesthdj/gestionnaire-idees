import { describe, expect, it } from 'vitest'
import { BudgetGuard, type BudgetGuardDependencies } from '../../../src/main/application/ai/BudgetGuard'
import { budgetState, monthKey } from '../../../src/main/domain/ai/cost'

describe('budgetState', () => {
  const cap = 1_000_000 // 10 € en millicentimes
  it.each([
    [0, 'normal'],
    [790_000, 'normal'],
    [800_000, 'alert'],
    [999_999, 'alert'],
    [1_000_000, 'blocked']
  ])('should_return_state_for_%d_millicents_spent', (spent, state) => {
    expect(budgetState(spent, cap, 0.8, false)).toBe(state)
  })

  it('should_be_unlocked_when_cap_is_reached_but_month_was_unlocked', () => {
    expect(budgetState(1_200_000, cap, 0.8, true)).toBe('unlocked')
  })
})

describe('monthKey', () => {
  it('should_format_local_year_and_month', () => {
    expect(monthKey(new Date(2026, 8, 28))).toBe('2026-09')
  })
})

function harness(initialSpent: number, overrides: Partial<BudgetGuardDependencies> = {}) {
  let spent = initialSpent
  const alerts: number[] = []
  const guard = new BudgetGuard({
    spentMillicentsThisMonth: async () => spent,
    settings: async () => ({ capCents: 1000, alertRatio: 0.8, unlockedMonth: null, usdEurRate: 1 }),
    estimateMillicents: () => 10_000,
    now: () => new Date(2026, 8, 28),
    onAlert: (spentCents) => void alerts.push(spentCents),
    ...overrides
  })
  return { guard, alerts, addSpent: (value: number) => (spent += value) }
}

describe('BudgetGuard', () => {
  it('should_allow_call_when_budget_has_room_for_estimate', async () => {
    await expect(harness(500_000).guard.check('synthetiser')).resolves.toEqual({ allowed: true })
  })

  it('should_block_call_when_estimate_would_exceed_cap', async () => {
    await expect(harness(995_000).guard.check('synthetiser')).resolves.toEqual({ allowed: false })
  })

  it('should_block_every_call_once_cap_is_reached', async () => {
    await expect(harness(1_000_000).guard.check('etendre')).resolves.toEqual({ allowed: false })
  })

  it('should_allow_calls_again_when_month_is_unlocked', async () => {
    const h = harness(1_500_000, {
      settings: async () => ({ capCents: 1000, alertRatio: 0.8, unlockedMonth: '2026-09', usdEurRate: 1 })
    })
    await expect(h.guard.check('etendre')).resolves.toEqual({ allowed: true })
  })

  it('should_ignore_unlock_of_previous_month_when_new_month_starts', async () => {
    const h = harness(1_500_000, {
      settings: async () => ({ capCents: 1000, alertRatio: 0.8, unlockedMonth: '2026-08', usdEurRate: 1 })
    })
    await expect(h.guard.check('etendre')).resolves.toEqual({ allowed: false })
  })

  it('should_alert_once_when_spend_crosses_eighty_percent', async () => {
    const h = harness(790_000)
    h.addSpent(20_000)
    await h.guard.record()
    h.addSpent(5_000)
    await h.guard.record()
    expect(h.alerts).toEqual([810])
  })

  it('should_not_alert_when_spend_stays_below_threshold', async () => {
    const h = harness(100_000)
    h.addSpent(1000)
    await h.guard.record()
    expect(h.alerts).toEqual([])
  })
})
