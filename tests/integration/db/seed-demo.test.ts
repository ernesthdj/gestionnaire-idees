import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type DatabaseHandle } from '../../../src/main/infrastructure/db/client'
import { z } from 'zod'
import { seedDemo } from '../../../src/main/infrastructure/db/demo/seedDemo'
import { NeuronRepository } from '../../../src/main/infrastructure/db/repositories/NeuronRepository'
import { LinkRepository } from '../../../src/main/infrastructure/db/repositories/LinkRepository'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')

describe('jeu de démonstration', () => {
  let dir: string
  let handle: DatabaseHandle

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gi-demo-'))
    handle = openDatabase({ file: join(dir, 'demo.db'), key: '7'.repeat(64), migrationsFolder: MIGRATIONS })
  })

  afterEach(() => {
    handle.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('should_create_100_roots_in_the_3_states_and_50_links_when_the_base_is_empty', () => {
    expect(seedDemo(handle.db)).toEqual({ seeded: true })

    const roots = new NeuronRepository(handle.db)
    const count = (state: 'raw' | 'developing' | 'hatched'): number =>
      roots.listRoots({ state, limit: 100 }).items.length
    expect([count('raw'), count('developing'), count('hatched')]).toEqual([30, 30, 40])

    const links = new LinkRepository(handle.db)
    expect(links.list('accepted')).toHaveLength(40)
    expect(links.list('suggested')).toHaveLength(10)
    const pairs = links.list().map((link) => [link.a.id, link.b.id].sort().join('|'))
    expect(new Set(pairs).size).toBe(50)
    // Graines fictives en attente sur des liens acceptés (FR-028).
    expect(links.seeds()).toEqual(
      Array.from({ length: 3 }, () => expect.objectContaining({ status: 'suggested', bornRootId: null }))
    )
  })

  it('should_give_developing_roots_a_tree_and_a_gauge_when_seeded', () => {
    seedDemo(handle.db)
    const repository = new NeuronRepository(handle.db)
    const developing = repository.listRoots({ state: 'developing', limit: 1 }).items[0]
    expect(developing).toBeDefined()
    const rootId = developing?.id ?? ''
    expect(repository.neuronsOf(rootId)).toHaveLength(2)
    expect(repository.proposedExtensions(rootId)).toHaveLength(1)
    expect(repository.latestGauge(rootId)?.level).toBe('insufficient')
  })

  it('should_do_nothing_when_demo_data_already_exists', () => {
    seedDemo(handle.db)
    expect(seedDemo(handle.db)).toEqual({ seeded: false })
    expect(new NeuronRepository(handle.db).listRoots({ limit: 200 }).items).toHaveLength(100)
  })

  it('should_use_uuid_ids_when_seeded_so_that_ipc_channels_accept_them', () => {
    seedDemo(handle.db)
    const repository = new NeuronRepository(handle.db)
    const roots = repository.listRoots({ limit: 200 }).items
    const ids = [
      ...roots.map((root) => root.id),
      ...roots.flatMap((root) => repository.neuronsOf(root.id).map((neuron) => neuron.id)),
      ...new LinkRepository(handle.db).list().map((link) => link.id)
    ]
    expect(ids.filter((id) => !z.uuid().safeParse(id).success)).toEqual([])
  })
})
