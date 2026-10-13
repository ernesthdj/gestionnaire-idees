import { describe, expect, it } from 'vitest'
import {
  buildGrid,
  camera,
  computeStats,
  countByDay,
  levelOf,
  monthLabels,
  riseAt,
  toKey
} from '../../../src/renderer/src/git/skyline/contributions'

const END = Date.UTC(2026, 9, 13) // mardi 13 octobre 2026

describe('Skyline des contributions, calculs purs (spec 021 D16)', () => {
  it('should_count_commits_per_local_day_and_ignore_invalid_dates', () => {
    const counts = countByDay(['2026-10-12T09:00:00', '2026-10-12T23:30:00', '2026-10-13T08:00:00', 'pas une date'])
    expect(Object.fromEntries(counts)).toEqual({ '2026-10-12': 2, '2026-10-13': 1 })
  })

  it('should_build_a_year_of_weeks_starting_on_a_monday_and_ending_on_the_last_day', () => {
    const grid = buildGrid(new Map([['2026-10-13', 3]]), END)
    expect(new Date(Date.parse(`${grid.cells[0]?.date}T00:00:00Z`)).getUTCDay()).toBe(1)
    expect(grid.cells.at(-1)).toMatchObject({ date: '2026-10-13', count: 3, level: 4, day: 1 })
    expect(grid.weeks).toBe(53)
    expect(grid.max).toBe(3)
  })

  it('should_follow_a_shorter_span_and_leave_the_monday_padding_empty', () => {
    // Mardi 13 octobre, une semaine : la période commence le mercredi 7, la grille le lundi 5.
    const counts = new Map([
      ['2026-10-05', 9],
      ['2026-10-07', 2],
      ['2026-10-13', 1]
    ])
    const grid = buildGrid(counts, END, 7)
    expect(grid.cells[0]).toMatchObject({ date: '2026-10-05', count: 0 })
    expect(grid.weeks).toBe(2)
    expect(computeStats(grid.cells).total).toBe(3)
  })

  it('should_level_days_by_quarters_of_the_95th_percentile_so_one_huge_day_does_not_flatten_the_rest', () => {
    expect(levelOf(0, 10)).toBe(0)
    expect(levelOf(1, 10)).toBe(1)
    expect(levelOf(5, 10)).toBe(3)
    expect(levelOf(40, 10)).toBe(4)
    const counts = new Map<string, number>()
    for (let day = 0; day < 40; day += 1) counts.set(toKey(END - day * 86_400_000), 4)
    counts.set(toKey(END - 50 * 86_400_000), 100)
    const levels = buildGrid(counts, END)
      .cells.filter((cell) => cell.count === 4)
      .map((cell) => cell.level)
    expect(new Set(levels)).toEqual(new Set([4]))
  })

  it('should_compute_total_busiest_day_and_streaks', () => {
    const counts = new Map([
      ['2026-10-01', 1],
      ['2026-10-02', 5],
      ['2026-10-03', 1],
      ['2026-10-12', 2]
    ])
    const stats = computeStats(buildGrid(counts, END).cells)
    expect(stats.total).toBe(9)
    expect(stats.busiest).toEqual({ count: 5, date: '2026-10-02' })
    expect(stats.longest).toEqual({ days: 3, start: '2026-10-01', end: '2026-10-03' })
    // Le dernier jour (13) est vide : la série en cours finit la veille.
    expect(stats.current).toEqual({ days: 1, start: '2026-10-12', end: '2026-10-12' })
  })

  it('should_label_months_and_raise_bars_in_a_wave_from_flat_to_full', () => {
    const grid = buildGrid(new Map(), END)
    const labels = monthLabels(grid.cells, grid.weeks)
    expect(labels.length).toBeGreaterThanOrEqual(11)
    expect(labels.every((label, index) => index === 0 || label.week > (labels[index - 1]?.week ?? -1))).toBe(true)
    expect(riseAt(0, 0, 53, 0)).toBe(0)
    expect(riseAt(1, 52, 53, 6)).toBe(1)
    expect(riseAt(0.5, 0, 53, 0)).toBeGreaterThan(riseAt(0.5, 52, 53, 0))
  })

  it('should_look_straight_down_in_2d_and_ignore_the_orbit_there', () => {
    expect(camera(0, 0.5, 0.5)).toEqual(camera(0))
    expect(camera(0).ce).toBeCloseTo(0)
    expect(camera(1).sn).toBeCloseTo(Math.SQRT1_2)
  })
})
