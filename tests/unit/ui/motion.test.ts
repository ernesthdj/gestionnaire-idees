import { describe, expect, it } from 'vitest'
import {
  DURATIONS,
  isReducedMotion,
  REDUCED_FADE_MS,
  timingFor,
  type AnimationKind
} from '../../../src/renderer/src/motion/durations'

const KINDS = Object.keys(DURATIONS) as AnimationKind[]

describe('animations', () => {
  it.each([
    ['auto', false, false],
    ['auto', true, true],
    ['reduced', false, true],
    ['reduced', true, true]
  ] as const)('should_reduce_when_setting_is_%s_and_system_reduced_is_%s', (mode, system, expected) => {
    expect(isReducedMotion(mode, system)).toBe(expected)
  })

  it('should_use_the_FR025_durations_when_not_reduced', () => {
    expect(timingFor('grow', false)).toEqual({ duration: 250, movement: true, repeat: false })
    expect(timingFor('dive', false).duration).toBe(400)
    expect(timingFor('fusion', false).duration).toBeGreaterThanOrEqual(600)
    expect(timingFor('fusion', false).duration).toBeLessThanOrEqual(800)
    expect(timingFor('migrate', false).duration).toBe(600)
    expect(timingFor('suggestion', false).duration).toBe(150)
    expect(timingFor('halo', false).repeat).toBe(true)
  })

  it.each(KINDS)('should_play_no_movement_and_at_most_a_short_fade_for_%s_when_reduced', (kind) => {
    const timing = timingFor(kind, true)
    expect(timing.movement).toBe(false)
    expect(timing.repeat).toBe(false)
    expect(timing.duration).toBeLessThanOrEqual(REDUCED_FADE_MS)
  })

  it('should_drop_pure_movements_entirely_when_reduced', () => {
    expect(timingFor('dive', true).duration).toBe(0)
    expect(timingFor('halo', true).duration).toBe(0)
    expect(timingFor('fusion', true).duration).toBe(REDUCED_FADE_MS)
  })
})
