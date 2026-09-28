import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalQueue } from '../../../src/main/application/ai/LocalQueue'
import { openDatabase, type DatabaseHandle } from '../../../src/main/infrastructure/db/client'
import { PendingRequestRepository } from '../../../src/main/infrastructure/db/repositories/PendingRequestRepository'
import { CategoryOut } from '../../../src/shared/ai/schemas'
import { DEFAULT_ROUTING } from '../../../src/main/domain/ai/routing'
import { createGatewayHarness } from '../../support/gateway'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')

describe('LocalQueue', () => {
  let dir: string
  let handle: DatabaseHandle
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gi-queue-'))
    handle = openDatabase({ file: join(dir, 'q.db'), key: 'c'.repeat(64), migrationsFolder: MIGRATIONS })
  })
  afterEach(() => {
    handle.close()
    rmSync(dir, { recursive: true, force: true })
  })

  function setup(allowClaudeFallback = false) {
    const repository = new PendingRequestRepository(handle.db)
    const completed: string[] = []
    const failed: string[] = []
    const queueRef: { current?: LocalQueue } = {}
    const h = createGatewayHarness({
      config: () => ({ routing: DEFAULT_ROUTING, allowClaudeFallback }),
      localQueue: {
        enqueue: (request) => {
          if (queueRef.current === undefined) throw new Error('file non initialisée')
          return queueRef.current.enqueue(request)
        }
      }
    })
    const queue = new LocalQueue({
      repository,
      gateway: h.gateway,
      isLocalAvailable: async () => (await h.ollama.isAvailable()).up,
      schemas: { CategoryOut },
      onCompleted: (requestId) => void completed.push(requestId),
      onFailed: (requestId) => void failed.push(requestId)
    })
    queueRef.current = queue
    return { h, queue, repository, completed, failed }
  }

  it('should_persist_request_when_ollama_is_down', async () => {
    const { h, repository } = setup()
    h.ollama.setAvailable(false)
    await h.gateway.run({
      kind: 'categoriser',
      input: 'x',
      schema: CategoryOut,
      schemaName: 'CategoryOut',
      requestId: 'r1'
    })
    expect(repository.list().map((row) => row.requestId)).toEqual(['r1'])
  })

  it('should_replay_in_fifo_order_and_clear_when_ollama_comes_back', async () => {
    const { h, queue, repository, completed } = setup()
    h.ollama.setAvailable(false)
    for (const id of ['a', 'b']) {
      await h.gateway.run({
        kind: 'categoriser',
        input: id,
        schema: CategoryOut,
        schemaName: 'CategoryOut',
        requestId: id
      })
    }
    h.ollama.setAvailable(true)
    h.ollama.enqueue(
      { raw: { categorySlug: 'achat', nature: 'action' } },
      { raw: { categorySlug: 'it', nature: 'action' } }
    )
    await queue.tick()
    expect(completed).toEqual(['a', 'b'])
    expect(repository.list()).toEqual([])
  })

  it('should_keep_requests_when_ollama_is_still_down', async () => {
    const { h, queue, repository } = setup()
    h.ollama.setAvailable(false)
    await h.gateway.run({
      kind: 'categoriser',
      input: 'x',
      schema: CategoryOut,
      schemaName: 'CategoryOut',
      requestId: 'r1'
    })
    await queue.tick()
    expect(repository.list()).toHaveLength(1)
  })

  it('should_abandon_request_after_five_failed_attempts', async () => {
    const { h, queue, repository, failed } = setup()
    h.ollama.setAvailable(false)
    await h.gateway.run({
      kind: 'categoriser',
      input: 'x',
      schema: CategoryOut,
      schemaName: 'CategoryOut',
      requestId: 'r1'
    })
    h.ollama.setAvailable(true)
    for (let i = 0; i < 6; i += 1) {
      h.ollama.enqueue({ raw: {} }, { raw: {} })
      await queue.tick()
    }
    expect(failed).toEqual(['r1'])
    expect(repository.list()).toEqual([])
  })
})
