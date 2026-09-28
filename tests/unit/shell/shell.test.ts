import { describe, expect, it } from 'vitest'
import { loginItemSettings, startsHidden } from '../../../src/main/shell/lifecycle'
import { captureBounds } from '../../../src/main/shell/placement'
import { drawNeuronIcon } from '../../../src/main/shell/trayIcon'

describe('coquille', () => {
  it('should_center_the_capture_on_the_first_third_of_the_active_screen', () => {
    // Deuxième écran placé à droite du premier.
    expect(captureBounds({ x: 1920, y: 0, width: 2560, height: 1400 }, { width: 560, height: 176 })).toEqual({
      x: 1920 + 1000,
      y: 379,
      width: 560,
      height: 176
    })
  })

  it('should_stay_inside_the_screen_when_the_work_area_is_tiny', () => {
    const bounds = captureBounds({ x: 0, y: 40, width: 400, height: 150 }, { width: 560, height: 176 })
    expect(bounds).toEqual({ x: 0, y: 40, width: 400, height: 150 })
  })

  it('should_start_hidden_only_when_launched_with_windows', () => {
    expect(startsHidden(['app.exe', '--hidden'])).toBe(true)
    expect(startsHidden(['app.exe'])).toBe(false)
    expect(loginItemSettings(true)).toEqual({ openAtLogin: true, args: ['--hidden'] })
  })

  it('should_draw_an_opaque_ring_and_core_with_a_transparent_background', () => {
    const size = 32
    const pixels = drawNeuronIcon(size, { r: 1, g: 2, b: 3 })
    const alpha = (x: number, y: number): number => pixels[(y * size + x) * 4 + 3] ?? -1
    expect(pixels).toHaveLength(size * size * 4)
    expect(alpha(0, 0)).toBe(0) // coin
    expect(alpha(16, 16)).toBe(255) // noyau
    expect(alpha(16, 1)).toBe(255) // anneau
    expect(alpha(16, 9)).toBe(0) // entre l'anneau et le noyau
    expect([...pixels.subarray((16 * size + 16) * 4, (16 * size + 16) * 4 + 3)]).toEqual([3, 2, 1]) // BGRA
  })
})
