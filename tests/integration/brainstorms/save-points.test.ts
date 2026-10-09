import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { eq, sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BrainstormScope } from '../../../src/main/application/brainstorms/BrainstormScope'
import { SavePointService } from '../../../src/main/application/brainstorms/SavePointService'
import { openDatabase, type DatabaseHandle } from '../../../src/main/infrastructure/db/client'
import { BlockRepository } from '../../../src/main/infrastructure/db/repositories/BlockRepository'
import { BrainstormRepository } from '../../../src/main/infrastructure/db/repositories/BrainstormRepository'
import { MapLinkRepository } from '../../../src/main/infrastructure/db/repositories/MapLinkRepository'
import { NeuronRepository } from '../../../src/main/infrastructure/db/repositories/NeuronRepository'
import { SavePointRepository } from '../../../src/main/infrastructure/db/repositories/SavePointRepository'
import { neurons } from '../../../src/main/infrastructure/db/schemaNeurons'
import { EMPTY_VIEW_STATE } from '../../../src/shared/brainstorms/viewState'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')

describe('points de sauvegarde (spec 024 US2)', () => {
  let dir: string
  let handle: DatabaseHandle
  let brainstorms: BrainstormRepository
  let scope: BrainstormScope
  let ideas: NeuronRepository
  let blocks: BlockRepository
  let links: MapLinkRepository
  let points: SavePointService
  let brainstormId: string

  const idea = (title: string): string => {
    const id = randomUUID()
    ideas.insertRoot({ id, title, content: null, nature: 'reflection', natureSource: null })
    return id
  }
  /** Ce que montre la carte : idées, blocs, liens. */
  const inventory = () => ({
    ideas: ideas
      .canvasRoots()
      .map((root) => root.title)
      .sort(),
    blocks: blocks
      .list()
      .map((block) => block.text)
      .sort(),
    links: links.list().length
  })

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gi-save-points-'))
    handle = openDatabase({ file: join(dir, 'g.db'), key: '8'.repeat(64), migrationsFolder: MIGRATIONS })
    brainstorms = new BrainstormRepository(handle.db)
    scope = new BrainstormScope(() => brainstorms.ensureLoose())
    ideas = new NeuronRepository(handle.db, scope)
    blocks = new BlockRepository(handle.db, scope)
    links = new MapLinkRepository(handle.db)
    points = new SavePointService({
      repository: new SavePointRepository(handle.db),
      brainstorm: (id) => brainstorms.get(id),
      saveViewState: (id, json) => brainstorms.saveViewState(id, json),
      now: () => new Date('2026-10-10T09:00:00Z')
    })
    brainstormId = brainstorms.insert({
      name: 'Alpha',
      slug: 'alpha',
      description: '',
      type: null,
      location: 'local',
      origin: 'scratch',
      folderPath: null,
      gitRole: 'none',
      github: false
    }).id
    scope.set(brainstormId)
  })
  afterEach(() => {
    handle.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('should_bring_back_the_canvas_of_a_point_then_undo_the_return_with_identical_inventories', () => {
    const [a, b, c] = [idea('a'), idea('b'), idea('c')]
    idea('d')
    blocks.insert({ kind: 'label', x: 0, y: 0, width: 200, height: 80, text: 'note' })
    links.insert({ from: { kind: 'idea', id: a }, to: { kind: 'idea', id: b }, label: null, origin: 'user' })
    const before = inventory()
    const view = { ...EMPTY_VIEW_STATE, viewport: { x: 1, y: 2, zoom: 1 } }
    brainstorms.saveViewState(brainstormId, JSON.stringify(view))
    const point = points.create(brainstormId, 'avant refonte')
    expect(points.list(brainstormId).map((entry) => entry.name)).toEqual(['avant refonte'])

    // Après le point : trois idées supprimées (archivées), une nouvelle, la note supprimée ; la conversation de « d » avance.
    for (const id of [a, b, c]) ideas.updateRoot(id, { state: 'archived', archivedAt: '2026-10-10T09:05:00Z' })
    idea('e')
    const [note] = blocks.list()
    blocks.softDelete(note?.id ?? '')
    const d = ideas.canvasRoots().find((root) => root.title === 'd')?.id ?? ''
    handle.db.update(neurons).set({ sessionStarted: true }).where(eq(neurons.id, d)).run()
    const after = inventory()
    expect(after).toEqual({ ideas: ['d', 'e'], blocks: [], links: 1 })

    const restored = points.restore(point.id)
    expect(restored.viewState).toEqual(view)
    expect(inventory()).toEqual(before)
    // La conversation n'est jamais remise à l'état du point.
    expect(handle.db.select().from(neurons).where(eq(neurons.id, d)).get()?.sessionStarted).toBe(true)
    // Le point caché « avant retour » n'est pas listé.
    expect(points.list(brainstormId).map((entry) => entry.name)).toEqual(['avant refonte'])

    points.undoRestore(restored.undoId)
    expect(inventory()).toEqual(after)
    expect(() => points.undoRestore(restored.undoId)).toThrow(/ne peut plus être annulé/)
  })

  it('should_leave_other_brainstorms_untouched', () => {
    idea('alpha 1')
    const point = points.create(brainstormId, 'p')
    const other = brainstorms.ensureLoose()
    scope.set(other)
    idea('vrac 1')
    scope.set(brainstormId)
    idea('alpha 2')
    points.restore(point.id)
    expect(inventory().ideas).toEqual(['alpha 1'])
    scope.set(other)
    expect(inventory().ideas).toEqual(['vrac 1'])
  })

  it('should_rename_delete_and_bound_the_points', () => {
    const point = points.create(brainstormId, '  premier  ')
    expect(point.name).toBe('premier')
    points.rename(point.id, 'renommé')
    expect(points.list(brainstormId)[0]?.name).toBe('renommé')
    expect(() => points.create(brainstormId, '   ')).toThrow(/nom/)
    points.remove(point.id)
    expect(points.list(brainstormId)).toEqual([])
    expect(() => points.restore(point.id)).toThrow(/n’existe plus/)
    for (let index = 0; index < 50; index += 1) points.create(brainstormId, `p${index}`)
    expect(() => points.create(brainstormId, 'un de trop')).toThrow(/50 points au plus/)
  })

  it('should_refuse_a_corrupted_snapshot_without_touching_the_canvas', () => {
    idea('x')
    const point = points.create(brainstormId, 'p')
    handle.db.run(sql`UPDATE save_points SET snapshot = ${Buffer.from('pas du gzip')} WHERE id = ${point.id}`)
    idea('y')
    expect(() => points.restore(point.id)).toThrow(/illisible/)
    expect(inventory().ideas).toEqual(['x', 'y'])
    expect(points.list(brainstormId)).toHaveLength(1)
  })
})
