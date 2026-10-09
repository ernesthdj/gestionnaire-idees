import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { decodeSnapshot, encodeSnapshot, idsToRetire } from '../../../src/main/domain/brainstorms/snapshot'

describe('instantané d’un canevas (spec 024 R3)', () => {
  const snapshot = {
    version: 1 as const,
    neurons: [{ id: 'n1', title: 'idée', pinned: true, posX: 1.5 }],
    blocks: [{ id: 'b1', text: null }],
    links: [],
    view: null
  }

  it('should_round_trip_a_snapshot_through_gzip', () => {
    const packed = encodeSnapshot(snapshot)
    expect(packed.length).toBeGreaterThan(0)
    expect(decodeSnapshot(packed)).toEqual(snapshot)
  })

  it('should_refuse_an_unreadable_or_foreign_snapshot', () => {
    expect(() => decodeSnapshot(Buffer.from('pas du gzip'))).toThrow(/illisible/)
    expect(() => decodeSnapshot(gzipSync(Buffer.from('{"version":2}')))).toThrow(/illisible/)
    expect(() => decodeSnapshot(gzipSync(Buffer.from(JSON.stringify({ ...snapshot, neurons: [{}] }))))).toThrow(
      /illisible/
    )
  })

  it('should_retire_only_what_did_not_exist_at_the_point', () => {
    expect(idsToRetire(['n1', 'n2', 'n3'], [{ id: 'n1' }, { id: 'n3' }, { id: 'n9' }])).toEqual(['n2'])
    expect(idsToRetire([], [{ id: 'n1' }])).toEqual([])
  })
})
