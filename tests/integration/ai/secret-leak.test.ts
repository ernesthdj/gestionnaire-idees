import { readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase, type DatabaseHandle } from '../../../src/main/infrastructure/db/client'
import { AiConfigRepository } from '../../../src/main/infrastructure/db/repositories/AiConfigRepository'
import { createLogger, type LogRecord } from '../../../src/main/infrastructure/logging/logger'
import { createAiRoutesHarness } from '../../support/aiRoutes'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')
const KEY = 'sk-ant-api03-FICTIVE-leak-canary-1234567890'

function allFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? allFiles(path) : [path]
  })
}

describe('la clé API ne fuit nulle part (SC-006)', () => {
  let handle: DatabaseHandle | undefined
  let dir = ''
  afterEach(() => {
    handle?.close()
    if (dir !== '') rmSync(dir, { recursive: true, force: true })
  })

  it('should_leave_no_plaintext_key_in_files_database_logs_or_responses', async () => {
    const logs: LogRecord[] = []
    const logger = createLogger((record) => void logs.push(record))
    const h = createAiRoutesHarness()
    dir = h.dir
    handle = openDatabase({ file: join(dir, 'app.db'), key: 'f'.repeat(64), migrationsFolder: MIGRATIONS })
    const config = new AiConfigRepository(handle.db)

    const responses = [
      await h.dispatch('ai:setClaudeKey', { key: KEY }),
      await h.dispatch('ai:status', undefined),
      await h.dispatch('ai:getConfig', undefined),
      await h.dispatch('ai:test', { engine: 'claude' })
    ]
    config.update({ capCents: 1500 })
    logger.info('ai.key_saved', { status: 'ok', apiKey: KEY } as never)
    handle.close()
    handle = undefined

    expect(JSON.stringify(responses)).not.toContain(KEY)
    expect(JSON.stringify(logs)).not.toContain(KEY)
    for (const file of allFiles(dir)) {
      expect(readFileSync(file).includes(Buffer.from(KEY)), file).toBe(false)
    }
  })
})
