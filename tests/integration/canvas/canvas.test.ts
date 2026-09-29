import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CanvasService } from '../../../src/main/application/canvas/CanvasService'
import { demoId, seedDemo } from '../../../src/main/infrastructure/db/demo/seedDemo'
import { BlockRepository } from '../../../src/main/infrastructure/db/repositories/BlockRepository'
import { LinkRepository } from '../../../src/main/infrastructure/db/repositories/LinkRepository'
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
      links: new LinkRepository(harness.handle.db),
      blocks: new BlockRepository(harness.handle.db)
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

  it('should_preview_the_first_sub_neurons_of_developing_ideas_only', async () => {
    const view = await get()
    const developing = view.ideas.find((root) => root.state === 'developing')
    const raw = view.ideas.find((root) => root.state === 'raw')
    expect(developing?.subNeurons.map((sub) => sub.title)).toEqual(['Oui, dès que possible', 'Budget à définir'])
    expect(developing?.subCount).toBe(2)
    expect(raw?.subNeurons).toEqual([])
  })

  it('should_return_accepted_and_suggested_links_but_drop_those_of_archived_ideas', async () => {
    const before = await get()
    expect(before.links.filter((link) => link.status === 'accepted')).toHaveLength(40)
    expect(before.links.filter((link) => link.status === 'suggested')).toHaveLength(10)
    const linked = before.links[0]?.a.id ?? ''
    await harness.neurons.archive(linked)
    const after = await get()
    expect(after.links.some((link) => link.a.id === linked || link.b.id === linked)).toBe(false)
    expect(after.ideas).toHaveLength(99)
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

  it('should_pin_an_idea_or_a_sub_neuron_dragged_by_hand_and_release_it', async () => {
    const rootId = demoId('root', 31) // idée en développement : elle a des sous-neurones
    const subId = demoId('sub', 31 * 10)
    const pinned = await dispatch('canvas:savePositions', {
      positions: [
        { neuronId: rootId, x: 10, y: 20, pinned: true },
        { neuronId: subId, x: 200, y: 40, pinned: true }
      ]
    })
    expect(pinned).toEqual({ success: true, data: { ok: true } })
    expect((await get()).ideas.find((root) => root.id === rootId)?.pinned).toBe(true)
    const sub = new NeuronRepository(harness.handle.db).neuronsOf(rootId).find((neuron) => neuron.id === subId)
    expect(sub).toMatchObject({ position: { x: 200, y: 40 }, pinned: true })

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

  it('should_create_move_resize_and_delete_a_block_and_keep_it_between_openings', async () => {
    const created = await dispatch('canvas:createBlock', { x: 100, y: 200 })
    const block = (created.success ? created.data : null) as BlockView
    expect(block).toMatchObject({ x: 100, y: 200, width: 240, height: 160 })
    expect((await get()).blocks).toEqual([block])

    const moved = { ...block, x: -50, y: 20, width: 400, height: 300 }
    expect(await dispatch('canvas:updateBlock', moved)).toEqual({ success: true, data: moved })
    expect((await get()).blocks).toEqual([moved])

    expect(await dispatch('canvas:deleteBlock', { id: block.id })).toEqual({ success: true, data: { ok: true } })
    expect((await get()).blocks).toEqual([])
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
    const created = await dispatch('canvas:createBlock', { x: 0, y: 0 })
    const block = (created.success ? created.data : null) as BlockView
    expect(await dispatch('canvas:updateBlock', { ...block, ...size })).toMatchObject({
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
