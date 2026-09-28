import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { openDatabase, type DatabaseHandle } from '../../../src/main/infrastructure/db/client'
import { AiCallRepository } from '../../../src/main/infrastructure/db/repositories/AiCallRepository'
import { aiCalls } from '../../../src/main/infrastructure/db/schema'
import { createGatewayHarness } from '../../support/gateway'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')

describe('journal des appels IA (base chiffrée)', () => {
  let dir: string
  let handle: DatabaseHandle
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gi-calls-'))
    handle = openDatabase({ file: join(dir, 'c.db'), key: 'd'.repeat(64), migrationsFolder: MIGRATIONS })
  })
  afterEach(() => {
    handle.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('should_store_metadata_without_any_content_when_gateway_calls_claude', async () => {
    const h = createGatewayHarness({ callLog: new AiCallRepository(handle.db) })
    h.claude.enqueue({ raw: { answer: 'réponse confidentielle' } })
    await h.gateway.run({ kind: 'synthetiser', input: 'idée confidentielle', schema: z.object({ answer: z.string() }) })

    const rows = handle.db.select().from(aiCalls).all()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ kind: 'synthetiser', engine: 'claude', status: 'ok', inputTokens: 100 })
    expect(JSON.stringify(rows)).not.toMatch(/confidentielle/)
  })
})
