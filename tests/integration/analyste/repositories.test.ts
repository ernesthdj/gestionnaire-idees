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
    expect(settings.settings()).toEqual({ retentionDays: 30, maxEvents: 50_000 })
    expect(settings.updateSettings({ retentionDays: 14 })).toEqual({ retentionDays: 14, maxEvents: 50_000 })
    expect(() => settings.updateSettings({ maxEvents: 5 })).toThrow()
    expect(settings.settings().maxEvents).toBe(50_000)
    expect(settings.repoPath()).toBeNull()
    settings.saveRepoPath('D:/dev/brainstormer')
    expect(settings.repoPath()).toBe('D:/dev/brainstormer')
  })
})
