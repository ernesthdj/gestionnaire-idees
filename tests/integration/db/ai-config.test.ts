import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { currentModel } from '../../../src/shared/ipc/ai'
import { openDatabase, type DatabaseHandle } from '../../../src/main/infrastructure/db/client'
import { AiConfigRepository } from '../../../src/main/infrastructure/db/repositories/AiConfigRepository'
import { aiConfig } from '../../../src/main/infrastructure/db/schema'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')

/** Modèles retirés de la liste (audit 2026-10-11) : un réglage enregistré avant reste valable, sur sa version actuelle. */
describe('modèles enregistrés des réglages IA', () => {
  let dir: string
  let handle: DatabaseHandle

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gi-ai-config-'))
    handle = openDatabase({ file: join(dir, 'a.db'), key: '8'.repeat(64), migrationsFolder: MIGRATIONS })
  })

  afterEach(() => {
    handle.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('should_read_haiku_4_5_as_haiku_5_5_when_it_was_stored_before', () => {
    const stored = {
      claudeModel: 'claude-haiku-4-5',
      elementModel: 'claude-haiku-4-5',
      widgetModel: 'claude-haiku-4-5'
    }
    handle.db
      .insert(aiConfig)
      .values({ key: 'ai', valueJson: JSON.stringify(stored) })
      .run()
    const config = new AiConfigRepository(handle.db).get()
    expect([config.claudeModel, config.elementModel, config.widgetModel]).toEqual([
      'claude-haiku-5-5',
      'claude-haiku-5-5',
      'claude-haiku-5-5'
    ])
  })

  it('should_keep_a_model_still_offered_when_reading_it', () => {
    expect(currentModel('claude-sonnet-5-5')).toBe('claude-sonnet-5-5')
    expect(currentModel('claude-opus-5')).toBe('claude-opus-5')
  })
})
