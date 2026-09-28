import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { openDatabase } from '../../../src/main/infrastructure/db/client'
import { aiConfig } from '../../../src/main/infrastructure/db/schema'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')
const KEY = 'a'.repeat(64)

describe('openDatabase', () => {
  let dir: string
  let file: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gi-db-'))
    file = join(dir, 'app.db')
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('should_apply_migrations_and_persist_data_when_key_is_correct', () => {
    const first = openDatabase({ file, key: KEY, migrationsFolder: MIGRATIONS })
    first.db.insert(aiConfig).values({ key: 'cap_cents', valueJson: '1000' }).run()
    first.close()

    const second = openDatabase({ file, key: KEY, migrationsFolder: MIGRATIONS })
    const row = second.db.select().from(aiConfig).where(eq(aiConfig.key, 'cap_cents')).get()
    expect(row?.valueJson).toBe('1000')
    second.close()
  })

  it('should_store_file_encrypted_when_data_is_written', () => {
    const handle = openDatabase({ file, key: KEY, migrationsFolder: MIGRATIONS })
    handle.db.insert(aiConfig).values({ key: 'marqueur_en_clair', valueJson: '"visible?"' }).run()
    handle.close()
    expect(readFileSync(file).includes(Buffer.from('marqueur_en_clair'))).toBe(false)
  })

  it('should_fail_when_key_is_wrong', () => {
    openDatabase({ file, key: KEY, migrationsFolder: MIGRATIONS }).close()
    expect(() => openDatabase({ file, key: 'b'.repeat(64), migrationsFolder: MIGRATIONS })).toThrow()
  })

  it('should_reject_malformed_key_when_opening', () => {
    expect(() => openDatabase({ file, key: "x'; DROP", migrationsFolder: MIGRATIONS })).toThrow(/clé/i)
  })
})
