import { describe, expect, it } from 'vitest'
import { semanticZoom } from '../../../src/renderer/src/explorer/semanticZoom'

describe('zoom sémantique de l’explorateur (spec 017 D10)', () => {
  it.each([
    // [zoom, zoom d'arrivée, à la racine, action]
    [0.85, 1.5, false, 'up'],
    [0.95, 1.5, false, null],
    [0.3, 0.5, false, 'up'],
    [0.3, 0.5, true, null],
    [3, 1.5, false, 'open'],
    [1.2, 0.6, true, 'open'],
    [1, 1, false, null]
  ] as const)('should_decide_from_the_zoom_%s_and_the_arrival_%s_at_root_%s', (zoom, arrival, atRoot, action) => {
    expect(semanticZoom(zoom, arrival, atRoot)).toBe(action)
  })
})
