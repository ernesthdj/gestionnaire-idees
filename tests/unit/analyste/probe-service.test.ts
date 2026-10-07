import { describe, expect, it } from 'vitest'
import type { ObservationRecord } from '../../../src/shared/analyste/events'
import { PROBE_QUEUE, ProbeService } from '../../../src/main/application/analyste/ProbeService'
import { pseudonym } from '../../../src/main/domain/analyste/fingerprint'

const KEY = 'c'.repeat(64)

const setup = (options: { key?: string | null; failWrites?: boolean } = {}) => {
  const written: ObservationRecord[] = []
  const purged: { olderThan: number; maxEvents: number }[] = []
  const ticks: { ms: number; run: () => void }[] = []
  let now = 1_000_000
  const service = new ProbeService({
    key: () => (options.key === undefined ? KEY : options.key),
    repository: {
      insertBatch: (records) => {
        if (options.failWrites === true) throw new Error('disque plein')
        written.push(...records)
      },
      purge: (olderThan, maxEvents) => {
        purged.push({ olderThan, maxEvents })
        return 0
      },
      count: () => written.length
    },
    settings: () => ({ retentionDays: 30, maxEvents: 50_000 }),
    now: () => now,
    timers: {
      every: (ms, run) => {
        ticks.push({ ms, run })
        return ticks.length
      },
      cancel: () => undefined
    }
  })
  return { service, written, purged, ticks, advance: (ms: number) => (now += ms) }
}

describe('sonde de l’Analyste', () => {
  it('should_ignore_everything_when_the_probe_is_inactive', () => {
    const { service, written } = setup({ key: null })
    service.record({ family: 'performance', event: 'ipc.call', channel: 'canvas:get', durationMs: 3, status: 'ok' })
    expect(service.recordRenderer([{ event: 'screen.open', screen: 'carte' }])).toEqual({ accepted: 0, dropped: 0 })
    service.flush()
    expect(written).toEqual([])
  })

  it('should_store_a_pseudonym_and_never_the_object_id_when_recording_an_action', () => {
    const { service, written } = setup()
    service.recordRenderer([{ event: 'neuron.create', subjectKind: 'neuron', subjectId: 'neuron-42', via: 'clavier' }])
    service.flush()
    expect(written).toHaveLength(1)
    expect(written[0]).toMatchObject({
      family: 'action',
      event: 'neuron.create',
      subjectRef: pseudonym(KEY, 'neuron-42')
    })
    expect(JSON.stringify(written)).not.toContain('neuron-42')
  })

  it('should_drop_and_count_invalid_events_when_a_batch_mixes_good_and_bad_ones', () => {
    const { service, written } = setup()
    const result = service.recordRenderer([
      { event: 'screen.open', screen: 'carte' },
      { event: 'neuron.create', subjectKind: 'neuron', via: 'souris', title: 'Acheter du pain' },
      'n’importe quoi'
    ])
    expect(result).toEqual({ accepted: 1, dropped: 2 })
    expect(service.dropped()).toBe(2)
    service.flush()
    expect(written.map((record) => record.event)).toEqual(['screen.open'])
  })

  it('should_merge_identical_actions_then_drop_new_events_when_a_burst_overflows_the_queue', () => {
    const { service, written } = setup()
    const click = { event: 'link.create', subjectKind: 'link', subjectId: 'l1', via: 'souris' }
    for (let i = 0; i < PROBE_QUEUE.merge + 10; i += 1) service.recordRenderer([click])
    for (let i = 0; i < PROBE_QUEUE.max; i += 1)
      service.record({ family: 'performance', event: 'ipc.call', channel: 'canvas:get', durationMs: i, status: 'ok' })
    service.flush()
    expect(written).toHaveLength(PROBE_QUEUE.max)
    expect(written[PROBE_QUEUE.merge - 1]?.count).toBe(11)
    expect(service.dropped()).toBe(PROBE_QUEUE.merge)
  })

  it('should_count_and_swallow_a_write_error_when_the_database_fails', () => {
    const { service } = setup({ failWrites: true })
    service.recordRenderer([{ event: 'screen.open', screen: 'carte' }])
    expect(() => service.flush()).not.toThrow()
    expect(service.dropped()).toBe(1)
  })

  it('should_flush_every_two_seconds_and_purge_by_retention_when_started', () => {
    const { service, written, purged, ticks } = setup()
    service.start()
    expect(purged).toEqual([{ olderThan: 1_000_000 - 30 * 86_400_000, maxEvents: 50_000 }])
    expect(ticks.map((tick) => tick.ms)).toEqual([PROBE_QUEUE.flushMs, PROBE_QUEUE.purgeMs])
    service.recordRenderer([{ event: 'screen.open', screen: 'chat' }])
    ticks[0]?.run()
    expect(written).toHaveLength(1)
  })

  it('should_record_main_errors_and_call_durations_but_not_its_own_channels', () => {
    const { service, written } = setup()
    service.recordLog('info', 'app.ready')
    service.recordLog('error', 'context.scan_failed')
    service.recordCall('canvas:get', 14, true)
    service.recordCall('analyste:events', 2, true)
    service.flush()
    expect(written).toEqual([
      expect.objectContaining({
        family: 'erreur',
        event: 'error.main',
        code: 'context.scan_failed',
        module: 'context'
      }),
      expect.objectContaining({
        family: 'performance',
        event: 'ipc.call',
        channel: 'canvas:get',
        durationMs: 14,
        status: 'ok'
      })
    ])
  })
})
