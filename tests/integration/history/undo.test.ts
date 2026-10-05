import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CanvasService } from '../../../src/main/application/canvas/CanvasService'
import { HistoryService } from '../../../src/main/application/history/HistoryService'
import { BlockRepository } from '../../../src/main/infrastructure/db/repositories/BlockRepository'
import { HistoryRepository } from '../../../src/main/infrastructure/db/repositories/HistoryRepository'
import { MapLinkRepository } from '../../../src/main/infrastructure/db/repositories/MapLinkRepository'
import { NeuronRepository } from '../../../src/main/infrastructure/db/repositories/NeuronRepository'
import { createHistoryRoutes } from '../../../src/main/ipc/historyHandlers'
import { createDispatcher } from '../../../src/main/ipc/registry'
import type { HistoryPageView } from '../../../src/shared/ipc/history'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

describe('historique et annulation (spec 003 T040)', () => {
  let t: NeuronHarness
  let history: HistoryService
  let canvas: CanvasService
  let dispatch: ReturnType<typeof createDispatcher>
  beforeEach(() => {
    t = createNeuronHarness()
    const db = t.handle.db
    history = new HistoryService(new HistoryRepository(db))
    canvas = new CanvasService({
      neurons: new NeuronRepository(db),
      blocks: new BlockRepository(db),
      io: { links: () => [] },
      mapLinks: new MapLinkRepository(db)
    })
    dispatch = createDispatcher(createHistoryRoutes(history))
  })
  afterEach(() => t.dispose())

  const linked = (a: string, b: string): boolean =>
    canvas.get().mapLinks.some((link) => link.from.id === a && link.to.id === b)

  it('should_undo_and_redo_a_link_drawn_between_two_ideas', async () => {
    const a = (await t.neurons.create({ text: 'Studio photo' })).id
    const b = (await t.neurons.create({ text: 'Deuxième écran' })).id
    canvas.createLink({ aRootId: a, bRootId: b, label: 'même bureau' })
    const created = history.list().items.find((item) => item.summary === 'Création du lien « même bureau »')
    expect(created?.undoable).toBe(true)

    const undo = history.undo(created?.batchId ?? '')
    expect(linked(a, b)).toBe(false)
    history.undo(undo.undoBatchId)
    expect(linked(a, b)).toBe(true)
  })

  it('should_list_batches_newest_first_with_readable_summaries_and_paginate', async () => {
    const first = await t.neurons.create({ text: 'Première idée' })
    const second = await t.neurons.create({ text: 'Seconde idée' })
    t.neurons.remove(first.id)
    t.neurons.remove(second.id)
    const result = await dispatch('history:list', { limit: 1 })
    const page = (result.success ? result.data : null) as HistoryPageView
    expect(page.items).toHaveLength(1)
    expect(page.items[0]).toMatchObject({ kind: 'delete', summary: 'Suppression de « Seconde idée »', undoable: true })
    expect(page.nextCursor).not.toBeNull()
    const next = await dispatch('history:list', { limit: 1, cursor: page.nextCursor })
    const older = (next.success ? next.data : null) as HistoryPageView
    expect(older.items[0]).toMatchObject({ summary: 'Suppression de « Première idée »' })
  })

  it('should_refuse_to_undo_twice', async () => {
    const root = await t.neurons.create({ text: 'Idée' })
    const { batchId } = t.neurons.remove(root.id)
    history.undo(batchId)
    expect(() => history.undo(batchId)).toThrow(expect.objectContaining({ code: 'ALREADY_UNDONE' }))
  })

  it('should_remove_an_idea_with_all_its_content_then_restore_it_by_undo', async () => {
    const root = await t.neurons.create({ text: 'Idée à supprimer', nature: 'action' })
    const { batchId } = t.neurons.remove(root.id)
    expect(t.neurons.getTree(root.id).root.state).toBe('archived')
    const [entry] = history.list().items
    expect(entry).toMatchObject({ batchId, kind: 'delete', undoable: true })
    expect(entry?.summary).toBe('Suppression de « Idée à supprimer »')

    const { undoBatchId } = history.undo(batchId)
    expect(t.neurons.getTree(root.id).root.state).toBe('raw')
    expect(history.list().items[0]?.summary).toBe('Idée restaurée : « Idée à supprimer »')

    history.undo(undoBatchId)
    expect(t.neurons.getTree(root.id).root.state).toBe('archived')
    expect(() => t.neurons.remove(root.id)).toThrow(expect.objectContaining({ code: 'INVALID_STATE' }))
  })
})
