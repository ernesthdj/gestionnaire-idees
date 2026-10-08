import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ObservationRecord } from '../../../src/shared/analyste/events'
import { openDatabase, type DatabaseHandle } from '../../../src/main/infrastructure/db/client'
import { AnalysteRepository } from '../../../src/main/infrastructure/db/repositories/AnalysteRepository'
import { ObservationRepository } from '../../../src/main/infrastructure/db/repositories/ObservationRepository'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')

describe('dépôts de l’Analyste', () => {
  let root: string
  let handle: DatabaseHandle
  let repo: ObservationRepository

  const action = (at: number): ObservationRecord => ({
    at,
    family: 'action',
    event: 'neuron.create',
    subjectKind: 'neuron',
    subjectRef: 'abcdef012345',
    via: 'souris'
  })

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gi-analyste-db-'))
    handle = openDatabase({ file: join(root, 'a.db'), key: '4'.repeat(64), migrationsFolder: MIGRATIONS })
    repo = new ObservationRepository(handle.db)
  })
  afterEach(() => {
    handle.close()
    rmSync(root, { recursive: true, force: true })
  })

  it('should_write_a_batch_and_read_it_back_newest_first_when_paging', () => {
    repo.insertBatch([
      action(1),
      { at: 2, family: 'erreur', event: 'error.renderer', code: 'TypeError', frames: ['src/a.ts:3'] },
      { at: 3, family: 'performance', event: 'ipc.call', channel: 'canvas:get', durationMs: 12, status: 'ok' }
    ])
    const first = repo.page({ limit: 2 })
    expect(first.items.map((item) => item.event)).toEqual(['ipc.call', 'error.renderer'])
    expect(first.items[1]?.frames).toEqual(['src/a.ts:3'])
    expect(repo.page({ limit: 2, cursor: first.next ?? 0 }).items.map((item) => item.event)).toEqual(['neuron.create'])
    expect(repo.page({ limit: 10, family: 'erreur' }).items).toHaveLength(1)
    expect(repo.totals()).toEqual({ navigation: 0, action: 1, erreur: 1, performance: 1 })
  })

  it('should_purge_by_age_then_by_volume_when_asked', () => {
    repo.insertBatch([1, 2, 3, 4, 5, 6].map((at) => action(at)))
    expect(repo.purge(3, 2)).toBe(4)
    expect(repo.all().map((item) => item.at)).toEqual([5, 6])
  })

  it('should_remove_everything_when_cleared', () => {
    repo.insertBatch([action(1), action(2)])
    expect(repo.clear()).toBe(2)
    expect(repo.count()).toBe(0)
  })

  it('should_keep_defaults_and_refuse_out_of_bounds_settings_when_updating', () => {
    const settings = new AnalysteRepository(handle.db)
    const defaults = { retentionDays: 30, maxEvents: 50_000, maxProposals: 5, repeatThreshold: 5, minEvents: 200 }
    expect(settings.settings()).toEqual(defaults)
    expect(settings.updateSettings({ retentionDays: 14, maxProposals: 3 })).toEqual({
      ...defaults,
      retentionDays: 14,
      maxProposals: 3
    })
    expect(() => settings.updateSettings({ maxEvents: 5 })).toThrow()
    expect(() => settings.updateSettings({ maxProposals: 11 })).toThrow()
    expect(settings.settings().maxEvents).toBe(50_000)
    expect(settings.repoPath()).toBeNull()
    settings.saveRepoPath('D:/dev/brainstormer')
    expect(settings.repoPath()).toBe('D:/dev/brainstormer')
  })

  it('should_read_a_window_in_order_and_count_grouped_events', () => {
    repo.insertBatch([action(10), { ...action(20), count: 4 }, action(30)])
    expect(repo.between(10, 30).map((record) => record.at)).toEqual([20, 30])
    expect(repo.between(10, 30)[0]).toEqual({ ...action(20), count: 4 })
    expect(repo.countBetween(0, 30)).toBe(6)
    expect(repo.countBetween(30, 40)).toBe(0)
  })

  it('should_save_an_analysis_and_its_proposals_together_and_keep_refusal_facts_out_of_the_view', () => {
    const store = new AnalysteRepository(handle.db)
    const row = { id: 'a1', trigger: 'manual' as const, windowFrom: 0, windowTo: 100, events: 3, startedAt: 100 }
    expect(store.startAnalysis(row)).toBe(true)
    expect(store.startAnalysis({ ...row, id: 'a2' })).toBe(false)
    store.finishAnalysis('a1', 200, 'req-1', [
      {
        id: 'p1',
        category: 'bug',
        title: 'Corriger buildGraph',
        finding: 'Constat',
        proposal: 'Proposition',
        gain: 'Gain',
        risk: 'faible',
        severity: 3,
        confidence: 0.5,
        evidence: {
          observations: [{ key: 'obs:err:1', sentence: 'Phrase.', signature: 'err|TypeError' }],
          code: [{ path: 'src/a.ts', start: 3 }]
        },
        files: ['src/a.ts'],
        withoutEvidence: false,
        dedupeKey: 'k1'
      }
    ])
    expect(store.analyses(5)[0]).toMatchObject({ id: 'a1', status: 'done', proposals: 1, finishedAt: 200 })
    expect(store.lastDoneWindowTo()).toBe(100)
    const [view] = store.proposals(['new'], 10)
    expect(view?.evidence).toEqual({
      observations: [{ key: 'obs:err:1', sentence: 'Phrase.' }],
      code: [{ path: 'src/a.ts', start: 3 }]
    })
    expect(store.known()).toEqual([{ dedupeKey: 'k1', status: 'new', signatures: ['err|TypeError'] }])
    expect(store.memory(30)).toEqual([
      { category: 'bug', title: 'Corriger buildGraph', status: 'new', refusalReason: null, files: ['src/a.ts'] }
    ])
  })

  it('should_count_by_tab_set_statuses_and_clear_only_closed_proposals', () => {
    const store = new AnalysteRepository(handle.db)
    store.startAnalysis({ id: 'a1', trigger: 'manual', windowFrom: 0, windowTo: 100, events: 3, startedAt: 100 })
    const base = {
      category: 'bug' as const,
      finding: 'Constat',
      proposal: 'Proposition',
      gain: 'Gain',
      risk: 'faible' as const,
      severity: 2,
      confidence: 0.5,
      evidence: { observations: [], code: [] },
      files: [],
      withoutEvidence: false
    }
    store.finishAnalysis(
      'a1',
      200,
      null,
      ['p1', 'p2', 'p3', 'p4'].map((id) => ({ ...base, id, title: `Proposition ${id}`, dedupeKey: id }))
    )
    store.setStatus('p2', 'refused', 'Pas utile', 300)
    store.setStatus('p3', 'applied', null, 300)
    store.setStatus('p4', 'postponed', null, 300)
    expect(store.counts()).toEqual({ todo: 1, progress: 1, kept: 1, dismissed: 1 })
    expect(store.proposal('p2')).toMatchObject({ status: 'refused', refusalReason: 'Pas utile' })
    // D11 : seules les closes partent (refusée, installée hors app) ; à trier et reportée restent.
    expect(store.clearClosed()).toBe(2)
    expect(store.proposal('p2')).toBeUndefined()
    expect(store.counts()).toEqual({ todo: 1, progress: 1, kept: 0, dismissed: 0 })
    expect(store.clearClosed()).toBe(0)
  })

  it('should_end_a_failed_analysis_without_moving_the_window_and_interrupt_a_stale_one', () => {
    const store = new AnalysteRepository(handle.db)
    store.startAnalysis({ id: 'a1', trigger: 'manual', windowFrom: 0, windowTo: 100, events: 0, startedAt: 1 })
    store.endAnalysis('a1', 'failed', 'AI_UNAVAILABLE', 2, 'req-1')
    expect(store.analyses(1)[0]).toMatchObject({ status: 'failed', errorCode: 'AI_UNAVAILABLE' })
    expect(store.lastDoneWindowTo()).toBeNull()
    store.startAnalysis({ id: 'a2', trigger: 'auto', windowFrom: 0, windowTo: 100, events: 0, startedAt: 3 })
    expect(store.interruptRunning(4)).toBe(1)
    expect(store.analyses(1)[0]).toMatchObject({ id: 'a2', status: 'failed', errorCode: 'INTERRUPTED' })
  })
})
