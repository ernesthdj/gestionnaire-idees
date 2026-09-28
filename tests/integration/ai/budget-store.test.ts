import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type DatabaseHandle } from '../../../src/main/infrastructure/db/client'
import { AiCallRepository } from '../../../src/main/infrastructure/db/repositories/AiCallRepository'
import { AiConfigRepository } from '../../../src/main/infrastructure/db/repositories/AiConfigRepository'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')
const usage = { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }

describe('stockage du budget', () => {
  let dir: string
  let handle: DatabaseHandle
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gi-budget-'))
    handle = openDatabase({ file: join(dir, 'b.db'), key: 'e'.repeat(64), migrationsFolder: MIGRATIONS })
  })
  afterEach(() => {
    handle.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('should_sum_only_claude_costs_since_given_instant', async () => {
    const calls = new AiCallRepository(handle.db)
    for (const [engine, cost] of [
      ['claude', 1200],
      ['claude', 300],
      ['ollama', 999]
    ] as const) {
      await calls.record({
        requestId: `r-${cost}`,
        kind: 'etendre',
        engine,
        model: 'm',
        usage,
        costMillicents: cost,
        status: 'ok',
        durationMs: 1
      })
    }
    expect(calls.claudeSpentSince(new Date(0))).toBe(1500)
    expect(calls.claudeSpentSince(new Date(Date.now() + 60_000))).toBe(0)
  })

  it('should_return_defaults_then_persist_updates_when_config_is_edited', () => {
    const config = new AiConfigRepository(handle.db)
    expect(config.get()).toMatchObject({
      capCents: 1000,
      alertRatio: 0.8,
      claudeModel: 'claude-opus-5',
      allowClaudeFallback: false
    })
    config.update({ capCents: 2500, unlockedMonth: '2026-09' })
    expect(config.get()).toMatchObject({ capCents: 2500, unlockedMonth: '2026-09' })
  })

  it('should_reject_invalid_values_when_updating_config', () => {
    const config = new AiConfigRepository(handle.db)
    expect(() => config.update({ capCents: -5 })).toThrow()
    expect(() => config.update({ alertRatio: 2 })).toThrow()
  })
})
