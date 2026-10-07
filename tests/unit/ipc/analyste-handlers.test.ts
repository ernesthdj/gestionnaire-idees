import { describe, expect, it } from 'vitest'
import type { RepoState } from '../../../src/main/application/analyste/RepoGuard'
import { createAnalysteRoutes, type AnalysteRoutesDeps } from '../../../src/main/ipc/analysteHandlers'
import { createDispatcher } from '../../../src/main/ipc/registry'

const ACTIVE: RepoState = { available: true, active: true, repoPath: 'D:/dev/brainstormer', reason: null }
const PACKAGED: RepoState = { available: false, active: false, repoPath: null, reason: 'PACKAGED_APP' }

const setup = (state: RepoState, overrides: Partial<AnalysteRoutesDeps> = {}) => {
  const written: { path: string; content: string }[] = []
  let flushed = 0
  const deps: AnalysteRoutesDeps = {
    guard: { current: () => state, designate: async () => ACTIVE },
    probe: {
      recordRenderer: (events) => ({ accepted: events.length }),
      dropped: () => 3,
      flush: () => {
        flushed += 1
      }
    },
    observations: {
      page: () => ({ items: [], next: null }),
      totals: () => ({ navigation: 1, action: 2, erreur: 0, performance: 4 }),
      count: () => 7,
      all: () => [],
      clear: () => 7
    },
    settings: {
      settings: () => ({ retentionDays: 30, maxEvents: 50_000 }),
      updateSettings: (patch) => ({ retentionDays: 30, maxEvents: 50_000, ...patch })
    },
    pickRepo: async () => 'D:/dev/brainstormer',
    pickExportFile: async () => 'D:/export.json',
    writeFile: (path, content) => written.push({ path, content }),
    ...overrides
  }
  return { dispatch: createDispatcher(createAnalysteRoutes(deps)), written, flushed: () => flushed }
}

describe('canaux analyste:*', () => {
  it('should_report_status_with_counts_when_the_probe_is_active', async () => {
    const { dispatch } = setup(ACTIVE)
    await expect(dispatch('analyste:repo:status', undefined)).resolves.toEqual({
      success: true,
      data: { ...ACTIVE, observations: 7, dropped: 3 }
    })
  })

  it('should_refuse_every_action_when_the_app_is_packaged', async () => {
    const { dispatch } = setup(PACKAGED)
    for (const [channel, payload] of [
      ['analyste:repo:choose', undefined],
      ['analyste:observations', {}],
      ['analyste:purge', { confirm: true }],
      ['analyste:settings:set', { retentionDays: 10 }]
    ] as const) {
      expect(await dispatch(channel, payload)).toMatchObject({ success: false, error: { code: 'PACKAGED_APP' } })
    }
    expect(await dispatch('analyste:repo:status', undefined)).toMatchObject({
      data: { available: false, observations: 0 }
    })
  })

  it('should_return_cancelled_when_no_folder_is_chosen', async () => {
    const { dispatch } = setup(ACTIVE, { pickRepo: async () => undefined })
    expect(await dispatch('analyste:repo:choose', undefined)).toMatchObject({ error: { code: 'CANCELLED' } })
  })

  it('should_refuse_a_path_or_an_oversized_batch_sent_by_the_interface', async () => {
    const { dispatch } = setup(ACTIVE)
    expect(await dispatch('analyste:repo:choose', { path: 'C:/' })).toMatchObject({ error: { code: 'VALIDATION' } })
    expect(await dispatch('analyste:events', { events: Array(101).fill({}) })).toMatchObject({
      error: { code: 'VALIDATION' }
    })
    expect(await dispatch('analyste:observations:export', { file: 'C:/x.json' })).toMatchObject({
      error: { code: 'VALIDATION' }
    })
  })

  it('should_require_an_explicit_confirmation_when_purging', async () => {
    const { dispatch } = setup(ACTIVE)
    expect(await dispatch('analyste:purge', {})).toMatchObject({ error: { code: 'VALIDATION' } })
    expect(await dispatch('analyste:purge', { confirm: true })).toEqual({ success: true, data: { deleted: 7 } })
  })

  it('should_flush_the_queue_then_return_totals_when_listing_observations', async () => {
    const { dispatch, flushed } = setup(ACTIVE)
    const result = await dispatch('analyste:observations', { family: 'erreur', limit: 50 })
    expect(result).toMatchObject({ success: true, data: { items: [], next: null, totals: { performance: 4 } } })
    expect(flushed()).toBe(1)
  })

  it('should_write_the_export_to_the_file_chosen_in_the_main_process', async () => {
    const { dispatch, written } = setup(ACTIVE)
    expect(await dispatch('analyste:observations:export', undefined)).toEqual({ success: true, data: { count: 0 } })
    expect(written[0]?.path).toBe('D:/export.json')
  })

  it('should_refuse_out_of_bounds_settings_when_setting', async () => {
    const { dispatch } = setup(ACTIVE)
    expect(await dispatch('analyste:settings:set', { retentionDays: 365 })).toMatchObject({
      error: { code: 'VALIDATION' }
    })
    expect(await dispatch('analyste:settings:set', { retentionDays: 14 })).toMatchObject({
      data: { retentionDays: 14 }
    })
  })
})
