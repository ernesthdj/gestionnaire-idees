import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_APP_SETTINGS } from '../../../src/shared/ipc/app'
import { openDatabase, type DatabaseHandle } from '../../../src/main/infrastructure/db/client'
import { AppSettingsRepository } from '../../../src/main/infrastructure/db/repositories/AppSettingsRepository'
import { settings } from '../../../src/main/infrastructure/db/schemaNeurons'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')

describe('réglages de l’app', () => {
  let dir: string
  let handle: DatabaseHandle
  let repository: AppSettingsRepository

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gi-app-'))
    handle = openDatabase({ file: join(dir, 'a.db'), key: '8'.repeat(64), migrationsFolder: MIGRATIONS })
    repository = new AppSettingsRepository(handle.db)
  })

  afterEach(() => {
    handle.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('should_return_defaults_when_nothing_is_stored', () => {
    expect(repository.get()).toEqual(DEFAULT_APP_SETTINGS)
    expect(repository.draft()).toBe('')
  })

  it('should_persist_only_the_given_fields_when_updated', () => {
    repository.update({ theme: 'dark', motion: 'reduced' })
    expect(repository.get()).toEqual({ ...DEFAULT_APP_SETTINGS, theme: 'dark', motion: 'reduced' })
  })

  it('should_write_nothing_when_one_field_is_invalid', () => {
    expect(() => repository.update({ theme: 'dark', shortcut: 'Space' })).toThrow()
    expect(repository.get().theme).toBe('system')
  })

  it('should_fall_back_to_default_when_a_stored_value_is_corrupted', () => {
    handle.db.insert(settings).values({ key: 'app.theme', valueJson: '"violet"' }).run()
    handle.db.insert(settings).values({ key: 'app.launchAtLogin', valueJson: '{oops' }).run()
    expect(repository.get()).toEqual(DEFAULT_APP_SETTINGS)
  })

  it('should_keep_the_capture_draft_when_saved_and_refuse_it_when_too_long', () => {
    repository.saveDraft('Acheter un sac photo')
    expect(repository.draft()).toBe('Acheter un sac photo')
    expect(() => repository.saveDraft('x'.repeat(2001))).toThrow()
    expect(repository.draft()).toBe('Acheter un sac photo')
  })
})
