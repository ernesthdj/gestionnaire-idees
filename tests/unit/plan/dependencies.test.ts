import { describe, expect, it } from 'vitest'
import { checkDependencies, moveRank, renumber, type RankedStep } from '../../../src/main/domain/plan/dependencies'

const step = (id: string, rank: number, waitsFor: string[] = []): RankedStep => ({ id, rank, waitsFor })

describe('dépendances et rangs d’un plan d’attaque (spec 011)', () => {
  it('should_accept_dependencies_when_each_step_comes_after_what_it_waits_for', () => {
    expect(checkDependencies([step('a', 1), step('b', 2, ['a']), step('c', 3, ['a', 'b'])])).toBeNull()
  })

  it('should_refuse_a_cycle_when_two_steps_wait_for_each_other', () => {
    expect(checkDependencies([step('a', 1, ['b']), step('b', 2, ['a'])])).toBe('CYCLE')
  })

  it('should_refuse_a_step_waiting_for_itself', () => {
    expect(checkDependencies([step('a', 1, ['a'])])).toBe('CYCLE')
  })

  it('should_refuse_a_dependency_outside_the_siblings', () => {
    expect(checkDependencies([step('a', 1, ['ailleurs'])])).toBe('OUTSIDE')
  })

  it('should_refuse_a_step_placed_before_what_it_waits_for', () => {
    expect(checkDependencies([step('a', 2), step('b', 1, ['a'])])).toBe('ORDER')
  })

  it('should_renumber_from_one_in_rank_order_when_a_step_left', () => {
    expect(renumber([step('c', 7), step('a', 2), step('b', 5)]).map((entry) => [entry.id, entry.rank])).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3]
    ])
  })

  it('should_move_a_step_and_renumber_its_siblings', () => {
    const moved = moveRank([step('a', 1), step('b', 2), step('c', 3)], 'c', 1)
    expect(moved?.map((entry) => [entry.id, entry.rank])).toEqual([
      ['c', 1],
      ['a', 2],
      ['b', 3]
    ])
  })

  it('should_clamp_the_new_rank_to_the_number_of_siblings', () => {
    expect(moveRank([step('a', 1), step('b', 2)], 'a', 9)?.map((entry) => entry.id)).toEqual(['b', 'a'])
  })

  it('should_refuse_a_move_that_puts_a_step_before_what_it_waits_for', () => {
    expect(moveRank([step('a', 1), step('b', 2, ['a'])], 'b', 1)).toBeNull()
  })

  it('should_return_null_when_the_moved_step_is_unknown', () => {
    expect(moveRank([step('a', 1)], 'x', 1)).toBeNull()
  })
})
