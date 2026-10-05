import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CanvasService } from '../../../src/main/application/canvas/CanvasService'
import { HistoryService } from '../../../src/main/application/history/HistoryService'
import { HistoryRepository } from '../../../src/main/infrastructure/db/repositories/HistoryRepository'
import { demoId, seedDemo } from '../../../src/main/infrastructure/db/demo/seedDemo'
import { BlockRepository } from '../../../src/main/infrastructure/db/repositories/BlockRepository'
import { MapLinkRepository } from '../../../src/main/infrastructure/db/repositories/MapLinkRepository'
import { NeuronRepository } from '../../../src/main/infrastructure/db/repositories/NeuronRepository'
import { createCanvasRoutes } from '../../../src/main/ipc/canvasHandlers'
import { createDispatcher } from '../../../src/main/ipc/registry'
import type { BlockView, IdeasCanvasView } from '../../../src/shared/ipc/canvas'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

describe('écran Idées', () => {
  let harness: NeuronHarness
  let canvas: CanvasService
  let dispatch: ReturnType<typeof createDispatcher>

  beforeEach(() => {
    harness = createNeuronHarness()
    seedDemo(harness.handle.db, { raw: 30, developing: 30, hatched: 40, links: 50 })
    const neurons = new NeuronRepository(harness.handle.db)
    canvas = new CanvasService({
      neurons,
      blocks: new BlockRepository(harness.handle.db),
      io: { links: () => [] },
      mapLinks: new MapLinkRepository(harness.handle.db)
    })
    dispatch = createDispatcher(createCanvasRoutes(canvas))
  })

  afterEach(() => harness.dispose())

  const get = async (filter: Record<string, unknown> = {}): Promise<IdeasCanvasView> => {
    const result = await dispatch('canvas:get', filter)
    if (!result.success) throw new Error(result.error.code)
    return result.data as IdeasCanvasView
  }

  it('should_list_every_idea_in_one_space_with_its_context_level_and_exact_counts', async () => {
    const view = await get()
    expect(view.counts).toEqual({ raw: 30, developing: 30, hatched: 40 })
    expect(view.ideas).toHaveLength(100)
    expect(view.ideas.filter((root) => root.state === 'raw').every((root) => root.contextLevel === null)).toBe(true)
    expect(view.ideas.filter((root) => root.state === 'developing').every((root) => root.contextLevel !== null)).toBe(
      true
    )
    expect(view.categories.map((category) => category.slug)).toContain('photo')
    expect(view.highlighted).toBeNull()
  })

  it('should_link_two_ideas_with_a_free_link_and_undo_it', async () => {
    const [a, b] = [demoId('root', 1), demoId('root', 2)]
    const created = await dispatch('canvas:createLink', { aRootId: a, bRootId: b, label: '  même budget ' })
    expect(created).toMatchObject({
      success: true,
      data: { from: { kind: 'idea', id: a }, to: { kind: 'idea', id: b }, label: 'même budget', origin: 'user' }
    })
    expect((await get()).mapLinks.filter((link) => link.from.id === a && link.to.id === b)).toHaveLength(1)

    const history = new HistoryService(new HistoryRepository(harness.handle.db))
    const [entry] = history.list().items
    expect(entry).toMatchObject({ kind: 'link', summary: 'Création du lien « même budget »', undoable: true })
    history.undo(entry?.batchId ?? '')
    expect((await get()).mapLinks.some((link) => link.from.id === a && link.to.id === b)).toBe(false)
  })

  it('should_refuse_a_second_link_between_the_same_ideas_in_either_direction', async () => {
    const [a, b] = [demoId('root', 1), demoId('root', 2)]
    await dispatch('canvas:createLink', { aRootId: a, bRootId: b })
    expect(await dispatch('canvas:createLink', { aRootId: b, bRootId: a, label: 'x' })).toMatchObject({
      success: false,
      error: { code: 'DUPLICATE' }
    })
  })

  it('should_refuse_to_link_an_idea_to_itself_or_to_an_archived_idea', async () => {
    const a = demoId('root', 1)
    const archived = demoId('root', 2)
    await harness.neurons.archive(archived)
    expect(await dispatch('canvas:createLink', { aRootId: a, bRootId: a })).toMatchObject({
      success: false,
      error: { code: 'VALIDATION' }
    })
    expect(await dispatch('canvas:createLink', { aRootId: a, bRootId: archived })).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' }
    })
  })

  it('should_drop_free_links_of_archived_ideas_from_the_map', async () => {
    const [a, b] = [demoId('root', 1), demoId('root', 2)]
    await dispatch('canvas:createLink', { aRootId: a, bRootId: b })
    await harness.neurons.archive(a)
    const view = await get()
    expect(view.mapLinks.some((link) => link.from.id === a || link.to.id === a)).toBe(false)
    expect(view.ideas).toHaveLength(99)
  })

  it('should_highlight_only_matching_ideas_when_filtered_by_nature_category_or_search', async () => {
    const all = await get()
    const everyone = all.ideas
    const actions = await get({ nature: 'action' })
    expect(new Set(actions.highlighted)).toEqual(
      new Set(everyone.filter((root) => root.nature === 'action').map((root) => root.id))
    )
    const photo = await get({ categoryId: 'cat-photo' })
    expect(new Set(photo.highlighted)).toEqual(
      new Set(everyone.filter((root) => root.category?.id === 'cat-photo').map((root) => root.id))
    )
    // Recherche insensible aux accents : « deuxieme » trouve « un deuxième écran ».
    const search = await get({ search: 'deuxieme' })
    expect(search.highlighted?.length).toBeGreaterThan(0)
    expect(search.highlighted?.every((id) => everyone.find((root) => root.id === id)?.title.includes('deuxième'))).toBe(
      true
    )
    // Les idées non retenues restent sur la carte.
    expect(search.ideas).toHaveLength(100)
  })

  it('should_highlight_nothing_when_the_search_has_no_word', async () => {
    expect((await get({ search: '***' })).highlighted).toEqual([])
  })

  it('should_store_positions_without_changing_the_idea_version', async () => {
    const rootId = demoId('root', 1)
    const version = (await get()).ideas.find((root) => root.id === rootId)?.version
    const result = await dispatch('canvas:savePositions', { positions: [{ neuronId: rootId, x: -120.5, y: 48 }] })
    expect(result).toEqual({ success: true, data: { ok: true } })
    const root = (await get()).ideas.find((entry) => entry.id === rootId)
    expect(root?.position).toEqual({ x: -120.5, y: 48 })
    expect(root?.version).toBe(version)
  })

  it('should_pin_an_idea_dragged_by_hand_and_release_it', async () => {
    const rootId = demoId('root', 31)
    const pinned = await dispatch('canvas:savePositions', {
      positions: [{ neuronId: rootId, x: 10, y: 20, pinned: true }]
    })
    expect(pinned).toEqual({ success: true, data: { ok: true } })
    expect((await get()).ideas.find((root) => root.id === rootId)).toMatchObject({
      position: { x: 10, y: 20 },
      pinned: true
    })

    await dispatch('canvas:savePositions', { positions: [{ neuronId: rootId, x: 10, y: 20, pinned: false }] })
    expect((await get()).ideas.find((root) => root.id === rootId)?.pinned).toBe(false)
  })

  it.each([
    [{ positions: [{ rootId: 'pas-un-uuid', x: 0, y: 0 }] }],
    [{ positions: [{ rootId: demoId('root', 1), x: Number.NaN, y: 0 }] }],
    [{ positions: [{ rootId: demoId('root', 1), x: 1e9, y: 0 }] }],
    [{ nature: 'autre' }]
  ])('should_refuse_invalid_input_%o', async (payload) => {
    const channel = 'positions' in payload ? 'canvas:savePositions' : 'canvas:get'
    expect(await dispatch(channel, payload)).toMatchObject({ success: false, error: { code: 'VALIDATION' } })
  })

  const create = async (input: Record<string, unknown>): Promise<BlockView> => {
    const created = await dispatch('canvas:createBlock', input)
    if (!created.success) throw new Error(created.error.code)
    return created.data as BlockView
  }
  const geometry = (block: BlockView) => ({
    id: block.id,
    x: block.x,
    y: block.y,
    width: block.width,
    height: block.height
  })

  it('should_create_move_resize_and_delete_a_block_and_keep_it_between_openings', async () => {
    const block = await create({ x: 100, y: 200 })
    expect(block).toMatchObject({ kind: 'empty', x: 100, y: 200, width: 240, height: 160, text: null, versionId: null })
    expect((await get()).blocks).toEqual([block])

    const moved = { ...block, x: -50, y: 20, width: 400, height: 300 }
    expect(await dispatch('canvas:updateBlock', geometry(moved))).toEqual({ success: true, data: moved })
    expect((await get()).blocks).toEqual([moved])

    expect(await dispatch('canvas:deleteBlock', { id: block.id })).toMatchObject({ success: true })
    expect((await get()).blocks).toEqual([])
  })

  it('should_create_a_note_and_a_widget_at_the_given_place_with_the_default_size_of_their_kind', async () => {
    expect(await create({ kind: 'label', x: 10, y: 20 })).toMatchObject({ kind: 'label', x: 10, y: 20, text: '' })
    expect(await create({ kind: 'widget', x: 30, y: 40 })).toMatchObject({
      kind: 'widget',
      width: 520,
      height: 440,
      text: null
    })
  })

  it('should_store_the_text_of_a_note_but_refuse_text_on_another_block', async () => {
    const note = await create({ kind: 'label', x: 0, y: 0 })
    const written = await dispatch('canvas:updateBlock', { ...geometry(note), text: 'Zone mariage' })
    expect(written).toMatchObject({ success: true, data: { text: 'Zone mariage' } })
    const widget = await create({ kind: 'widget', x: 0, y: 0 })
    expect(await dispatch('canvas:updateBlock', { ...geometry(widget), text: 'x' })).toMatchObject({
      success: false,
      error: { code: 'VALIDATION' }
    })
    expect(await dispatch('canvas:updateBlock', { ...geometry(note), text: 'x'.repeat(2001) })).toMatchObject({
      success: false,
      error: { code: 'VALIDATION' }
    })
  })

  it.each([
    ['widget', { width: 239, height: 300 }],
    ['widget', { width: 600, height: 1201 }],
    ['label', { width: 801, height: 100 }],
    ['label', { width: 200, height: 47 }]
  ])('should_refuse_a_%s_outside_its_size_limits_%o', async (kind, size) => {
    const block = await create({ kind, x: 0, y: 0 })
    expect(await dispatch('canvas:updateBlock', { ...geometry(block), ...size })).toMatchObject({
      success: false,
      error: { code: 'VALIDATION' }
    })
  })

  it('should_bring_a_deleted_widget_back_when_the_deletion_is_undone', async () => {
    const widget = await create({ kind: 'widget', x: 5, y: 6 })
    const deleted = await dispatch('canvas:deleteBlock', { id: widget.id })
    const batchId = (deleted.success ? deleted.data : null) as { batchId: string }
    expect((await get()).blocks).toEqual([])
    const history = new HistoryService(new HistoryRepository(harness.handle.db))
    expect(history.list().items[0]?.summary).toBe('Suppression d’un widget')
    history.undo(batchId.batchId)
    expect((await get()).blocks).toEqual([widget])
  })

  it('should_report_not_found_when_the_block_no_longer_exists', async () => {
    const id = demoId('root', 1)
    expect(await dispatch('canvas:deleteBlock', { id })).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } })
    expect(await dispatch('canvas:updateBlock', { id, x: 0, y: 0, width: 200, height: 200 })).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' }
    })
  })

  it.each([
    { width: 10, height: 200 },
    { width: 200, height: 5000 },
    { width: Number.POSITIVE_INFINITY, height: 200 }
  ])('should_refuse_an_unreasonable_block_size_%o', async (size) => {
    const block = await create({ x: 0, y: 0 })
    expect(await dispatch('canvas:updateBlock', { ...geometry(block), ...size })).toMatchObject({
      success: false,
      error: { code: 'VALIDATION' }
    })
  })

  it('should_remove_the_blocks_table_when_the_down_migration_runs', () => {
    const down = readFileSync(
      resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations/down/0006_canvas_blocks.down.sql'),
      'utf8'
    )
    harness.handle.db.run(sql.raw(down))
    const table = harness.handle.db.get<{ name: string } | undefined>(
      sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'canvas_blocks'`
    )
    expect(table).toBeUndefined()
  })
})
