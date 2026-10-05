import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type DatabaseHandle } from '../../../src/main/infrastructure/db/client'
import { z } from 'zod'
import { seedDemo } from '../../../src/main/infrastructure/db/demo/seedDemo'
import { NeuronRepository } from '../../../src/main/infrastructure/db/repositories/NeuronRepository'
import { linkSeeds, neuronLinks } from '../../../src/main/infrastructure/db/schemaNeurons'

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

  it('should_create_12_roots_covering_every_context_level_and_8_links_when_the_base_is_empty', () => {
    expect(seedDemo(handle.db)).toEqual({ seeded: true })

    const roots = new NeuronRepository(handle.db)
    const count = (state: 'raw' | 'developing' | 'hatched'): number =>
      roots.listRoots({ state, limit: 100 }).items.length
    expect([count('raw'), count('developing'), count('hatched')]).toEqual([2, 7, 3])

    // Liens de l'ancien moteur (archive, spec 010) : repris en liens libres par la conversion au démarrage.
    const links = handle.db.select().from(neuronLinks).all()
    expect(links.filter((link) => link.status === 'accepted')).toHaveLength(6)
    expect(links.filter((link) => link.status === 'suggested')).toHaveLength(2)
    const pairs = links.map((link) => [link.aRootId, link.bRootId].sort().join('|'))
    expect(new Set(pairs).size).toBe(8)
    // Des liens entre idées d'états différents (espace unique).
    const stateOf = new Map(roots.canvasRoots().map((root) => [root.id, root.state]))
    expect(links.some((link) => stateOf.get(link.aRootId) !== stateOf.get(link.bRootId))).toBe(true)
    expect(new Set(roots.latestGaugeLevels().values())).toEqual(new Set(['insufficient', 'sufficient', 'complete']))
    // Graines fictives en attente sur des liens acceptés (FR-028).
    expect(handle.db.select().from(linkSeeds).all()).toEqual(
      Array.from({ length: 2 }, () => expect.objectContaining({ status: 'suggested', bornRootId: null }))
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
    expect(repository.latestGauge(rootId)?.level).toBeDefined()
  })

  it('should_do_nothing_when_demo_data_already_exists', () => {
    seedDemo(handle.db)
    expect(seedDemo(handle.db)).toEqual({ seeded: false })
    expect(new NeuronRepository(handle.db).listRoots({ limit: 200 }).items).toHaveLength(12)
  })

  it('should_use_uuid_ids_when_seeded_so_that_ipc_channels_accept_them', () => {
    seedDemo(handle.db)
    const repository = new NeuronRepository(handle.db)
    const roots = repository.listRoots({ limit: 200 }).items
    const ids = [
      ...roots.map((root) => root.id),
      ...roots.flatMap((root) => repository.neuronsOf(root.id).map((neuron) => neuron.id)),
      ...handle.db
        .select()
        .from(neuronLinks)
        .all()
        .map((link) => link.id)
    ]
    expect(ids.filter((id) => !z.uuid().safeParse(id).success)).toEqual([])
  })
})
