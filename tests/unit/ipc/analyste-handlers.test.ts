import { describe, expect, it } from 'vitest'
import type { RepoState } from '../../../src/main/application/analyste/RepoGuard'
import { createAnalysteRoutes, type AnalysteRoutesDeps } from '../../../src/main/ipc/analysteHandlers'
import { createDispatcher } from '../../../src/main/ipc/registry'
import type { ProposalStatus, ProposalView } from '../../../src/shared/ipc/analyste'

const PROPOSAL: ProposalView = {
  id: '',
  analysisId: '6b1f0c1e-9a4b-4c3d-8e2f-0a1b2c3d4e5f',
  category: 'bug',
  title: 'Proposition fictive',
  finding: 'Constat fictif.',
  proposal: 'Proposition fictive.',
  gain: 'Gain fictif.',
  risk: 'faible',
  severity: 2,
  confidence: 0.8,
  evidence: { observations: [], code: [] },
  files: [],
  withoutEvidence: false,
  status: 'new',
  refusalReason: null,
  createdAt: 1
}

const ACTIVE: RepoState = { available: true, active: true, repoPath: 'D:/dev/brainstormer', reason: null }
const PACKAGED: RepoState = { available: false, active: false, repoPath: null, reason: 'PACKAGED_APP' }
const INACTIVE: RepoState = { available: true, active: false, repoPath: null, reason: 'NOT_DESIGNATED' }
const SETTINGS = { retentionDays: 30, maxEvents: 50_000, maxProposals: 5, repeatThreshold: 5, minEvents: 200 }
const ANALYSIS_ID = '5b1f0c1e-9a4b-4c3d-8e2f-0a1b2c3d4e5f'

const setup = (state: RepoState, overrides: Partial<AnalysteRoutesDeps> = {}) => {
  const written: { path: string; content: string }[] = []
  const analyzed: { force?: boolean }[] = []
  const cancelled: string[] = []
  const listed: (readonly string[])[] = []
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
      settings: () => SETTINGS,
      updateSettings: (patch) => ({ ...SETTINGS, ...patch })
    },
    pickRepo: async () => 'D:/dev/brainstormer',
    pickExportFile: async () => 'D:/export.json',
    writeFile: (path, content) => written.push({ path, content }),
    analyste: {
      analyze: (options) => {
        analyzed.push(options)
        return { analysisId: ANALYSIS_ID }
      },
      cancel: (id) => void cancelled.push(id)
    },
    store: {
      analyses: () => [],
      proposals: (statuses) => {
        listed.push(statuses)
        return []
      },
      proposal: () => undefined,
      setStatus: () => undefined,
      counts: () => ({ todo: 0, progress: 0, kept: 0, dismissed: 0 }),
      clearClosed: () => 0
    },
    ...overrides
  }
  return {
    dispatch: createDispatcher(createAnalysteRoutes(deps)),
    written,
    analyzed,
    cancelled,
    listed,
    flushed: () => flushed
  }
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

  it('should_start_an_analysis_with_or_without_force_when_the_probe_is_active', async () => {
    const { dispatch, analyzed } = setup(ACTIVE)
    await expect(dispatch('analyste:analyze', {})).resolves.toEqual({
      success: true,
      data: { analysisId: ANALYSIS_ID }
    })
    await dispatch('analyste:analyze', { force: true })
    expect(analyzed).toEqual([{}, { force: true }])
  })

  it('should_refuse_analysis_channels_when_the_probe_is_inactive_or_the_input_is_unexpected', async () => {
    const inactive = setup(INACTIVE)
    for (const [channel, payload] of [
      ['analyste:analyze', {}],
      ['analyste:analyses', {}],
      ['analyste:proposals', {}]
    ] as const) {
      await expect(inactive.dispatch(channel, payload)).resolves.toMatchObject({
        success: false,
        error: { code: 'PROBE_INACTIVE' }
      })
    }
    const active = setup(ACTIVE)
    await expect(active.dispatch('analyste:analyze', { force: true, repo: 'C:/' })).resolves.toMatchObject({
      error: { code: 'VALIDATION' }
    })
    await expect(active.dispatch('analyste:cancel', { analysisId: '../x' })).resolves.toMatchObject({
      error: { code: 'VALIDATION' }
    })
    expect(active.analyzed).toEqual([])
  })

  it('should_cancel_the_named_analysis_when_asked', async () => {
    const { dispatch, cancelled } = setup(ACTIVE)
    await expect(dispatch('analyste:cancel', { analysisId: ANALYSIS_ID })).resolves.toMatchObject({ success: true })
    expect(cancelled).toEqual([ANALYSIS_ID])
  })

  it('should_list_the_statuses_of_the_requested_tab_when_reading_proposals', async () => {
    const { dispatch, listed } = setup(ACTIVE)
    await expect(dispatch('analyste:proposals', {})).resolves.toEqual({
      success: true,
      data: { items: [], counts: { todo: 0, progress: 0, kept: 0, dismissed: 0 } }
    })
    await dispatch('analyste:proposals', { tab: 'dismissed', limit: 10 })
    await dispatch('analyste:proposals', { tab: 'kept' })
    expect(listed).toEqual([['new'], ['refused', 'discarded', 'reverted'], ['kept', 'applied']])
    await expect(dispatch('analyste:proposals', { tab: 'tout' })).resolves.toMatchObject({
      error: { code: 'VALIDATION' }
    })
  })

  it('should_apply_allowed_decisions_and_refuse_impossible_ones', async () => {
    const id = '4b1f0c1e-9a4b-4c3d-8e2f-0a1b2c3d4e5f'
    let status: ProposalStatus = 'new'
    let reason: string | null = null
    const proposal = (): ProposalView => ({ ...PROPOSAL, id, status, refusalReason: reason })
    const { dispatch } = setup(ACTIVE, {
      store: {
        analyses: () => [],
        proposals: () => [],
        proposal: (wanted) => (wanted === id ? proposal() : undefined),
        setStatus: (_id, next, why) => {
          status = next
          reason = why
        },
        counts: () => ({ todo: 0, progress: 0, kept: 0, dismissed: 0 }),
        clearClosed: () => 3
      }
    })
    await expect(dispatch('analyste:decide', { id, decision: 'refuse', reason: 'Pas utile' })).resolves.toMatchObject({
      data: { status: 'refused', refusalReason: 'Pas utile' }
    })
    await expect(dispatch('analyste:decide', { id, decision: 'applied' })).resolves.toMatchObject({
      error: { code: 'INVALID_TRANSITION' }
    })
    await expect(dispatch('analyste:decide', { id, decision: 'resume' })).resolves.toMatchObject({
      data: { status: 'new', refusalReason: null }
    })
    await expect(dispatch('analyste:decide', { id, decision: 'applied' })).resolves.toMatchObject({
      data: { status: 'applied' }
    })
    await expect(
      dispatch('analyste:decide', { id: '5b1f0c1e-9a4b-4c3d-8e2f-0a1b2c3d4e5f', decision: 'accept' })
    ).resolves.toMatchObject({ error: { code: 'NOT_FOUND' } })
    await expect(dispatch('analyste:proposals:clear', {})).resolves.toMatchObject({ error: { code: 'VALIDATION' } })
    await expect(dispatch('analyste:proposals:clear', { confirm: true })).resolves.toEqual({
      success: true,
      data: { deleted: 3 }
    })
  })
})
