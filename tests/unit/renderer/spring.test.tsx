import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSpringFollow } from '../../../src/renderer/src/canvas/useSpringFollow'

describe('arbre qui suit son idée (ressort)', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] }))
  afterEach(() => vi.useRealTimers())

  it('should_start_on_the_target_without_flying_in', () => {
    const { result } = renderHook(() => useSpringFollow({ x: 10, y: 20 }, true))
    expect(result.current).toEqual({ x: 10, y: 20 })
  })

  it('should_lag_behind_then_settle_on_the_new_target', () => {
    const { result, rerender } = renderHook(({ target }) => useSpringFollow(target, true), {
      initialProps: { target: { x: 0, y: 0 } }
    })
    rerender({ target: { x: 100, y: 0 } })
    act(() => vi.advanceTimersToNextFrame())
    expect(result.current.x).toBeGreaterThan(0)
    expect(result.current.x).toBeLessThan(100)
    act(() => {
      for (let i = 0; i < 200; i++) vi.advanceTimersToNextFrame()
    })
    expect(result.current).toEqual({ x: 100, y: 0 })
  })

  it('should_follow_instantly_when_animations_are_reduced', () => {
    const { result, rerender } = renderHook(({ target }) => useSpringFollow(target, false), {
      initialProps: { target: { x: 0, y: 0 } }
    })
    rerender({ target: { x: 100, y: 50 } })
    expect(result.current).toEqual({ x: 100, y: 50 })
  })
})
