import { describe, expect, it } from 'vitest'
import type { MapCallView, MapFileView } from '../../../src/shared/ipc/reprise'
import { INSIDE, insideLayout, neighboursOf } from '../../../src/renderer/src/explorer/boxes/insideLayout'
import {
  ease,
  fadeIn,
  fitFrame,
  lerpRect,
  onScreen,
  viewportOnto
} from '../../../src/renderer/src/explorer/boxes/sceneMath'

const file = (name: string, depth: number): MapFileView => ({
  key: `f:Domain/${name}`,
  path: `Domain/${name}`,
  moduleKey: 'm:dir:Domain',
  title: name,
  folder: '',
  lang: 'cs',
  lines: 10,
  role: null,
  functions: [],
  depth,
  external: false,
  plumbing: false
})
const call = (from: string, to: string): MapCallView => ({ from, to, count: 1, provenance: 'syntax', sentences: [] })

describe('intérieur d’un module (spec 031 D5)', () => {
  it('should_find_who_calls_the_module_on_the_left_and_what_it_calls_on_the_right', () => {
    const moduleOf = new Map([
      ['f:a', 'm:Api'],
      ['f:d', 'm:Domain'],
      ['f:i', 'm:Infra'],
      ['f:d2', 'm:Domain']
    ])
    const calls = [call('f:a', 'f:d'), call('f:d', 'f:i'), call('f:d', 'f:d2'), call('f:i', 'f:d')]
    // Infra appelle Domain et Domain appelle Infra : il reste à gauche, une seule fois.
    expect(neighboursOf('m:Domain', calls, moduleOf)).toEqual({ callers: ['m:Api', 'm:Infra'], callees: [] })
  })

  it('should_size_the_frame_to_its_content_with_air_and_rank_files_by_call_depth', () => {
    const files = [file('Service.cs', 0), file('Stores.cs', 1), file('Rules.cs', 1)]
    const layout = insideLayout(files, { callers: ['m:Api'], callees: ['m:Infra'] })
    const service = layout.files.get('f:Domain/Service.cs')
    const stores = layout.files.get('f:Domain/Stores.cs')
    expect(service?.x).toBeLessThan(stores?.x ?? 0)
    // Une colonne plus courte se centre : le fichier seul est à mi-hauteur des deux autres.
    expect(service?.y).toBe(INSIDE.top + INSIDE.rowHeight / 2)
    expect(layout.width).toBeGreaterThanOrEqual(
      2 * INSIDE.padding + 2 * (INSIDE.stubWidth + INSIDE.sideGap) + 2 * INSIDE.columnWidth
    )
    expect(layout.stubs.map((stub) => [stub.moduleKey, stub.side, stub.rect.x < layout.width / 2])).toEqual([
      ['m:Api', 'in', true],
      ['m:Infra', 'out', false]
    ])
    // Un module à un seul fichier garde un cadre d'une taille minimale, pas toute la carte.
    expect(insideLayout([file('Program.cs', 0)], { callers: [], callees: [] })).toMatchObject({
      width: INSIDE.minWidth
    })
  })

  it('should_put_at_most_seven_files_per_column', () => {
    const many = Array.from({ length: 20 }, (_, i) => file(`F${String(i).padStart(2, '0')}.cs`, 0))
    const xs = new Set([...insideLayout(many, { callers: [], callees: [] }).files.values()].map((rect) => rect.x))
    expect(xs.size).toBe(3)
  })
})

describe('transitions de l’explorateur, calculs (spec 031 D4)', () => {
  it('should_frame_two_scenes_in_the_same_rectangle_at_one_scale', () => {
    const node = { x: 100, y: 50, width: 200, height: 100 }
    const frame = { x: 0, y: 0, width: 1000, height: 500 }
    const to = { x: 40, y: 30, width: 400, height: 200 }
    // Même rectangle d'arrivée, même proportion : chaque scène y pose son nœud exactement.
    expect(onScreen(node, viewportOnto(node, to))).toEqual(to)
    expect(onScreen(frame, viewportOnto(frame, to))).toEqual(to)
  })

  it('should_fit_an_inside_without_going_under_80_percent', () => {
    expect(fitFrame({ width: 500, height: 300 }, { width: 1000, height: 600 })).toEqual({ zoom: 1, x: 250, y: 150 })
    expect(fitFrame({ width: 3000, height: 900 }, { width: 1000, height: 600 })).toMatchObject({ zoom: 0.8, x: 16 })
  })

  it('should_ease_the_motion_and_fade_in_a_time_window', () => {
    expect(ease(0)).toBe(0)
    expect(ease(1)).toBe(1)
    expect(ease(0.25)).toBeLessThan(0.25)
    expect(fadeIn(0.1, 0.15, 0.75)).toBe(0)
    expect(fadeIn(0.45, 0.15, 0.75)).toBeCloseTo(0.5)
    expect(fadeIn(0.9, 0.15, 0.75)).toBe(1)
    expect(lerpRect({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 10, width: 30, height: 30 }, 0.5)).toEqual({
      x: 5,
      y: 5,
      width: 20,
      height: 20
    })
  })
})
