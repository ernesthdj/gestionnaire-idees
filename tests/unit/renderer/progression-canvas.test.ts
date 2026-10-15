import { describe, expect, it } from 'vitest'
import { fitViewport } from '../../../src/renderer/src/canvas/progression/ProgressionCanvas'
import { ZOOM_BOUNDS } from '../../../src/renderer/src/canvas/useSmoothZoom'

describe('cadrage du canevas de la Progression (spec 032 Q8)', () => {
  it('should_fit_a_wide_content_whole_centred_and_stuck_to_the_top', () => {
    const fit = fitViewport({ width: 2000, height: 500 }, { width: 1064, height: 800 }, 32)
    expect(fit.zoom).toBeCloseTo(0.5)
    expect(fit.x).toBeCloseTo(32)
    expect(fit.y).toBe(32)
  })

  it('should_never_enlarge_a_small_content_nor_shrink_under_the_minimal_zoom', () => {
    expect(fitViewport({ width: 200, height: 100 }, { width: 1000, height: 800 }, 32)).toEqual({
      x: 400,
      y: 32,
      zoom: 1
    })
    expect(fitViewport({ width: 100_000, height: 100 }, { width: 1000, height: 800 }, 32).zoom).toBe(ZOOM_BOUNDS.min)
  })

  it('should_fit_only_the_width_when_a_reading_opens_so_the_text_stays_readable', () => {
    const fit = fitViewport({ width: 1000, height: 5000 }, { width: 1064, height: 600 }, 32, 'width')
    expect(fit.zoom).toBe(1)
    expect(fit.y).toBe(32)
  })

  it('should_stay_at_full_size_while_nothing_is_measured', () => {
    expect(fitViewport({ width: 0, height: 0 }, { width: 1000, height: 800 }, 32)).toEqual({ x: 32, y: 32, zoom: 1 })
  })
})
