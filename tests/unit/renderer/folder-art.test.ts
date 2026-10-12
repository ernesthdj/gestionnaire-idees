import { describe, expect, it } from 'vitest'
import { createArtJob, paletteOf, seedOf } from '../../../src/renderer/src/canvas/folder/folderArt'

const luminance = ([r, g, b]: readonly [number, number, number]): number => 0.2126 * r + 0.7152 * g + 0.0722 * b

describe('illustration du dossier (spec 028 D5)', () => {
  it('should_derive_six_tones_from_the_node_color_from_dark_to_light', () => {
    const { stops } = paletteOf('#2563eb')
    expect(stops).toHaveLength(6)
    expect(luminance(stops[0] ?? [0, 0, 0])).toBeLessThan(40)
    expect(luminance(stops[5] ?? [0, 0, 0])).toBeGreaterThan(200)
    // Une couleur illisible donne une palette neutre plutôt qu'une erreur.
    expect(paletteOf('pas-une-couleur').stops).toHaveLength(6)
  })

  it('should_give_the_same_seed_for_the_same_node_and_a_different_one_otherwise', () => {
    expect(seedOf('00000000-0000-4000-8000-000000000001')).toBe(seedOf('00000000-0000-4000-8000-000000000001'))
    expect(seedOf('00000000-0000-4000-8000-000000000001')).not.toBe(seedOf('00000000-0000-4000-8000-000000000002'))
  })

  it('should_paint_the_same_pixels_for_the_same_input_in_slices_of_rows', () => {
    const paint = (seed: number, rows: number): Uint8ClampedArray => {
      const job = createArtJob(24, 18, paletteOf('#0f766e'), seed)
      let steps = 0
      while (!job.step(rows)) steps++
      expect(steps).toBeGreaterThan(0)
      return job.pixels
    }
    const first = paint(7, 3)
    expect(paint(7, 5)).toEqual(first)
    expect(paint(8, 3)).not.toEqual(first)
    // Image opaque.
    expect(first.filter((_, index) => index % 4 === 3).every((alpha) => alpha === 255)).toBe(true)
  })
})
