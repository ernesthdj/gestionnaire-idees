import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CanvasService } from '../../../src/main/application/canvas/CanvasService'
import { HistoryService } from '../../../src/main/application/history/HistoryService'
import { WidgetIoService } from '../../../src/main/application/widgets/WidgetIoService'
import { BlockRepository } from '../../../src/main/infrastructure/db/repositories/BlockRepository'
import { HatchedRepository } from '../../../src/main/infrastructure/db/repositories/HatchedRepository'
import { HistoryRepository } from '../../../src/main/infrastructure/db/repositories/HistoryRepository'
import { LinkRepository } from '../../../src/main/infrastructure/db/repositories/LinkRepository'
import { NeuronRepository } from '../../../src/main/infrastructure/db/repositories/NeuronRepository'
import { WidgetIoRepository } from '../../../src/main/infrastructure/db/repositories/WidgetIoRepository'
import { WidgetRepository } from '../../../src/main/infrastructure/db/repositories/WidgetRepository'
import { createCanvasRoutes } from '../../../src/main/ipc/canvasHandlers'
import { createDispatcher } from '../../../src/main/ipc/registry'
import { createWidgetIoRoutes } from '../../../src/main/ipc/widgetIoHandlers'
import { BLOCK_DEFAULT_SIZES, RESULT_GAP } from '../../../src/shared/ipc/canvas'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

describe('sortie d’un widget dans un cadre résultat (spec 005 lot 2)', () => {
  let t: NeuronHarness
  let io: WidgetIoService
  let widgets: WidgetRepository
  let blocks: BlockRepository
  let canvas: CanvasService
  let blockId: string
  let versionId: string

  const addVersion = (title: string): string => {
    const version = widgets.insertVersion({
      blockId,
      title,
      html: '<main></main>',
      css: '',
      ts: 'gi.output({ total: 1 })',
      js: 'gi.output({ total: 1 })',
      summary: 'Version',
      model: 'claude-sonnet-5-5'
    })
    widgets.setCurrent(blockId, version.id)
    return version.id
  }

  beforeEach(() => {
    t = createNeuronHarness()
    const db = t.handle.db
    widgets = new WidgetRepository(db)
    blocks = new BlockRepository(db)
    const neuronRepository = new NeuronRepository(db)
    const hatched = new HatchedRepository(db)
    io = new WidgetIoService({
      repository: new WidgetIoRepository(db),
      widgets,
      blocks,
      tree: (id) => (neuronRepository.root(id) === undefined ? undefined : t.neurons.getTree(id)),
      document: (id) => hatched.result(id)
    })
    canvas = new CanvasService({
      neurons: neuronRepository,
      links: new LinkRepository(db),
      blocks,
      steps: hatched,
      io
    })
    blockId = blocks.insert({ kind: 'widget', x: 100, y: 50, width: 520, height: 440, text: null }).id
    versionId = addVersion('Budget')
  })
  afterEach(() => t.dispose())

  it('should_create_the_result_frame_once_to_the_right_of_its_widget_when_it_first_emits', () => {
    const budget = { total: 1250, lignes: [{ libelle: 'Traiteur', montant: 900 }] }
    const first = io.emit({ blockId, versionId, data: budget })
    expect(first.created).toBe(true)
    const size = BLOCK_DEFAULT_SIZES.result
    expect(blocks.get(first.resultBlockId)).toMatchObject({
      kind: 'result',
      sourceBlockId: blockId,
      x: 100 + 260 + RESULT_GAP + size.width / 2,
      y: 50,
      ...size
    })
    expect(io.result(first.resultBlockId)).toMatchObject({
      blockId: first.resultBlockId,
      widgetBlockId: blockId,
      widgetTitle: 'Budget',
      data: budget
    })

    const second = io.emit({ blockId, versionId, data: { total: 1300, lignes: [] } })
    expect(second).toEqual({ resultBlockId: first.resultBlockId, created: false })
    expect(io.result(first.resultBlockId).data).toEqual({ total: 1300, lignes: [] })
    expect(canvas.get().blocks.filter((block) => block.kind === 'result')).toHaveLength(1)
  })

  it('should_recreate_the_result_frame_at_the_next_emission_when_it_was_deleted', () => {
    const first = io.emit({ blockId, versionId, data: [1, 2, 3] })
    const { batchId } = canvas.deleteBlock(first.resultBlockId)
    expect(canvas.get().blocks.map((block) => block.kind)).toEqual(['widget'])
    const history = new HistoryService(new HistoryRepository(t.handle.db))
    expect(history.list().items[0]).toMatchObject({ batchId, summary: 'Suppression d’un cadre résultat' })

    const again = io.emit({ blockId, versionId, data: [4] })
    expect(again.created).toBe(true)
    expect(again.resultBlockId).not.toBe(first.resultBlockId)
    expect(io.result(again.resultBlockId).data).toEqual([4])
  })

  it('should_refuse_an_invalid_result_and_keep_the_previous_one', () => {
    const { resultBlockId } = io.emit({ blockId, versionId, data: { total: 1 } })
    expect(() => io.emit({ blockId, versionId, data: { when: new Date(0) } })).toThrow(
      expect.objectContaining({ code: 'VALIDATION', message: expect.stringMatching(/^Résultat refusé/) })
    )
    expect(() => io.emit({ blockId, versionId, data: 'x'.repeat(30_000) })).toThrow(
      expect.objectContaining({ code: 'VALIDATION' })
    )
    expect(io.result(resultBlockId).data).toEqual({ total: 1 })
  })

  it('should_create_no_frame_when_the_first_result_is_refused', () => {
    expect(() => io.emit({ blockId, versionId, data: undefined })).toThrow(
      expect.objectContaining({ code: 'VALIDATION' })
    )
    expect(blocks.resultBlockOf(blockId)).toBeUndefined()
  })

  it('should_ignore_a_result_from_a_version_that_is_no_longer_displayed', () => {
    addVersion('Budget v2')
    expect(() => io.emit({ blockId, versionId, data: { total: 1 } })).toThrow(
      expect.objectContaining({ code: 'INVALID_STATE' })
    )
    expect(() => io.emit({ blockId: '00000000-0000-4000-8000-00000000dead', versionId, data: { total: 1 } })).toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' })
    )
  })

  it('should_give_a_result_frame_only_the_result_of_its_own_widget', () => {
    const { resultBlockId } = io.emit({ blockId, versionId, data: { total: 1 } })
    // Un widget, une note ou un identifiant inconnu ne sont pas des cadres résultat.
    const note = blocks.insert({ kind: 'label', x: 0, y: 0, width: 240, height: 72, text: 'note' })
    for (const id of [blockId, note.id, '00000000-0000-4000-8000-00000000dead']) {
      expect(() => io.result(id)).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }))
    }
    expect(Object.keys(io.result(resultBlockId)).sort()).toEqual([
      'blockId',
      'data',
      'updatedAt',
      'widgetBlockId',
      'widgetTitle'
    ])
  })

  it('should_hide_the_result_frame_with_its_widget_and_bring_both_back_when_the_deletion_is_undone', () => {
    io.emit({ blockId, versionId, data: { total: 1 } })
    const { batchId } = canvas.deleteBlock(blockId)
    expect(canvas.get().blocks).toEqual([])
    new HistoryService(new HistoryRepository(t.handle.db)).undo(batchId)
    expect(
      canvas
        .get()
        .blocks.map((block) => block.kind)
        .sort()
    ).toEqual(['result', 'widget'])
  })

  it('should_keep_the_last_result_after_a_restart', () => {
    const { resultBlockId } = io.emit({ blockId, versionId, data: { total: 42 } })
    const db = t.handle.db
    const reopened = new WidgetIoService({
      repository: new WidgetIoRepository(db),
      widgets: new WidgetRepository(db),
      blocks: new BlockRepository(db),
      tree: () => undefined,
      document: () => null
    })
    expect(reopened.result(resultBlockId).data).toEqual({ total: 42 })
  })

  it('should_validate_the_channels_and_never_let_the_interface_create_a_result_frame', async () => {
    const dispatch = createDispatcher([...createWidgetIoRoutes(io), ...createCanvasRoutes(canvas)])
    expect(await dispatch('widgetIo:emit', { blockId, versionId, data: { total: 3 } })).toMatchObject({
      success: true,
      data: { created: true }
    })
    expect(await dispatch('widgetIo:emit', { blockId, versionId: 'pas-un-uuid', data: 1 })).toMatchObject({
      success: false,
      error: { code: 'VALIDATION' }
    })
    expect(await dispatch('widgetIo:emit', { blockId, versionId, data: 1, extra: true })).toMatchObject({
      success: false,
      error: { code: 'VALIDATION' }
    })
    expect(await dispatch('canvas:createBlock', { kind: 'result', x: 0, y: 0 })).toMatchObject({
      success: false,
      error: { code: 'VALIDATION' }
    })
  })

  it('should_remove_the_results_and_their_frames_when_the_down_migration_runs', () => {
    io.emit({ blockId, versionId, data: { total: 1 } })
    const down = readFileSync(
      resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations/down/0015_widget_results.down.sql'),
      'utf8'
    )
    for (const statement of down.split('--> statement-breakpoint')) t.handle.db.run(sql.raw(statement))
    const db = t.handle.db
    expect(db.get(sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'widget_results'`)).toBeUndefined()
    expect(db.all<{ name: string }>(sql`PRAGMA table_info(canvas_blocks)`).map((column) => column.name)).not.toContain(
      'source_block_id'
    )
    expect(db.all<{ kind: string }>(sql`SELECT kind FROM canvas_blocks`)).toEqual([{ kind: 'widget' }])
  })
})
