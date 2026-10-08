import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { isEmptySheet, readSheet } from '../../../src/main/domain/conversation/sheet'
import { openDatabase, type DatabaseHandle } from '../../../src/main/infrastructure/db/client'
import { seedDemo } from '../../../src/main/infrastructure/db/demo/seedDemo'
import { ElementRepository } from '../../../src/main/infrastructure/db/repositories/ElementRepository'
import { MapLinkRepository } from '../../../src/main/infrastructure/db/repositories/MapLinkRepository'
import { NeuronRepository } from '../../../src/main/infrastructure/db/repositories/NeuronRepository'
import { PlanRepository } from '../../../src/main/infrastructure/db/repositories/PlanRepository'
import { neuronLinks, neurons, planNodes, reflectionSummaries } from '../../../src/main/infrastructure/db/schemaNeurons'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')

describe('jeu de démonstration (spec 010 C3)', () => {
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

  it('should_create_two_hatched_genesis_far_apart_with_their_sheets_when_the_base_is_empty', () => {
    expect(seedDemo(handle.db)).toEqual({ seeded: true })
    const roots = new NeuronRepository(handle.db)
    const genesis = roots.canvasRoots()
    expect(genesis.map((root) => root.title)).toEqual([
      'Planifier le portfolio en ligne',
      'Projet démo : application de notes'
    ])
    expect(Math.abs((genesis[1]?.position?.x ?? 0) - (genesis[0]?.position?.x ?? 0))).toBeGreaterThan(1000)
    expect(new Set(roots.latestGaugeLevels().values())).toEqual(new Set(['complete']))
    // Une idée travaillée (maturité évaluée) a une fiche ; une idée brute n'en a pas.
    const rows = handle.db
      .select({ kind: neurons.kind, state: neurons.state, sheet: neurons.sheetJson })
      .from(neurons)
      .all()
      .filter((row) => row.kind === 'root')
    expect(rows.filter((row) => row.state === 'raw').every((row) => row.sheet === null)).toBe(true)
    const worked = rows.filter((row) => row.state === 'developing' || row.state === 'hatched')
    expect(worked.every((row) => !isEmptySheet(readSheet(row.sheet)))).toBe(true)
  })

  it('should_link_ideas_with_free_links_when_a_larger_set_is_asked', () => {
    seedDemo(handle.db, { raw: 2, developing: 7, hatched: 3, links: 8 })
    const roots = new NeuronRepository(handle.db)
    expect(roots.canvasRoots()).toHaveLength(12)
    expect(new Set(roots.latestGaugeLevels().values())).toEqual(new Set(['insufficient', 'sufficient', 'complete']))
    const ideaLinks = new MapLinkRepository(handle.db)
      .list()
      .filter((link) => link.from.kind === 'idea' && link.to.kind === 'idea')
    expect(ideaLinks).toHaveLength(8)
    expect(new Set(ideaLinks.map((link) => [link.from.id, link.to.id].sort().join('|'))).size).toBe(8)
  })

  it('should_draw_a_structure_map_on_the_second_genesis', () => {
    seedDemo(handle.db)
    const links = new MapLinkRepository(handle.db).list()
    const elements = new ElementRepository(handle.db).views()
    expect(elements).toHaveLength(6)
    expect(new Set(elements.map((element) => element.genesisId)).size).toBe(1)
    expect(links.filter((link) => link.relation !== null)).toHaveLength(2)
  })

  it('should_give_the_first_hatched_genesis_a_plan_three_levels_deep', () => {
    seedDemo(handle.db)
    const steps = new PlanRepository(handle.db).steps()
    expect(steps).toHaveLength(11)
    expect(new Set(steps.map((step) => step.genesisId)).size).toBe(1)
    expect(Math.max(...steps.map((step) => step.depth))).toBe(3)
    expect(new Set(steps.map((step) => step.status))).toEqual(new Set(['a_faire', 'en_cours', 'fait', 'bloque']))
  })

  it('should_write_nothing_in_the_old_engine_tables', () => {
    seedDemo(handle.db)
    expect(handle.db.select().from(neuronLinks).all()).toEqual([])
    expect(handle.db.select().from(planNodes).all()).toEqual([])
    expect(handle.db.select().from(reflectionSummaries).all()).toEqual([])
  })

  it('should_do_nothing_when_demo_data_already_exists', () => {
    seedDemo(handle.db)
    expect(seedDemo(handle.db)).toEqual({ seeded: false })
    expect(new NeuronRepository(handle.db).canvasRoots()).toHaveLength(2)
  })

  it('should_use_uuid_ids_when_seeded_so_that_ipc_channels_accept_them', () => {
    seedDemo(handle.db)
    const ids = [
      ...handle.db
        .select({ id: neurons.id })
        .from(neurons)
        .all()
        .map((row) => row.id),
      ...new MapLinkRepository(handle.db).list().map((link) => link.id)
    ]
    expect(ids.filter((id) => !z.uuid().safeParse(id).success)).toEqual([])
  })
})
