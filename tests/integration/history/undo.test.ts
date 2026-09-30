import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { HistoryService } from '../../../src/main/application/history/HistoryService'
import { HistoryRepository } from '../../../src/main/infrastructure/db/repositories/HistoryRepository'
import { createHistoryRoutes } from '../../../src/main/ipc/historyHandlers'
import { createDispatcher } from '../../../src/main/ipc/registry'
import type { HistoryPageView } from '../../../src/shared/ipc/history'
import { readyRoot, screenPlan } from '../../support/fusion'
import { createNeuronHarness, etendreReply, type NeuronHarness } from '../../support/neurons'

describe('historique et annulation (spec 003 T040)', () => {
  let t: NeuronHarness
  let history: HistoryService
  let dispatch: ReturnType<typeof createDispatcher>
  beforeEach(() => {
    t = createNeuronHarness()
    history = new HistoryService(new HistoryRepository(t.handle.db))
    dispatch = createDispatcher(createHistoryRoutes(history))
  })
  afterEach(() => t.dispose())

  /** Idée « 2e écran » éclose avec son plan ; renvoie l'état juste avant la confirmation. */
  async function hatched() {
    const tree = await readyRoot(t)
    t.h.claude.enqueue(screenPlan())
    const synthesis = await t.fusion.lock({ rootId: tree.root.id })
    const before = t.neurons.getTree(tree.root.id).root
    const examples = t.examples.count('synthetiser')
    const confirmed = t.fusion.confirm(synthesis.id)
    return { rootId: tree.root.id, synthesis, before, examples, batchId: confirmed.batchId }
  }

  const planIsCurrent = (rootId: string): boolean[] => t.fusionRepository.planOf(rootId).map((node) => node.isCurrent)

  it('should_bring_back_the_absorbed_sub_neurons_when_the_hatching_is_undone', async () => {
    const { rootId, batchId } = await hatched()
    expect(t.neurons.getTree(rootId).neurons).toHaveLength(0)
    expect((await dispatch('history:undo', { batchId })).success).toBe(true)
    expect(t.neurons.getTree(rootId).neurons.length).toBeGreaterThan(0)
  })

  it('should_restore_exactly_the_state_before_the_hatching_when_undone', async () => {
    const { rootId, synthesis, before, examples, batchId } = await hatched()
    expect(t.neurons.getTree(rootId).root.state).toBe('hatched')

    const result = await dispatch('history:undo', { batchId })
    expect(result.success).toBe(true)

    const root = t.neurons.getTree(rootId).root
    expect(root).toMatchObject({ state: before.state, version: before.version })
    expect(planIsCurrent(rootId).every((current) => !current)).toBe(true)
    expect(t.fusionRepository.synthesis(synthesis.id)?.status).toBe('proposed')
    expect(t.examples.count('synthetiser')).toBe(examples)
    // L'aperçu redevient confirmable tel quel, sans nouvel appel à l'IA.
    const calls = t.h.claude.requests.length
    expect(t.fusion.proposed(rootId)?.id).toBe(synthesis.id)
    expect(t.fusion.confirm(synthesis.id).root.state).toBe('hatched')
    expect(t.h.claude.requests.length).toBe(calls)
  })

  it('should_redo_the_hatching_when_the_undo_is_itself_undone', async () => {
    const { rootId, synthesis, examples, batchId } = await hatched()
    const undo = history.undo(batchId)
    history.undo(undo.undoBatchId)
    expect(t.neurons.getTree(rootId).root.state).toBe('hatched')
    expect(planIsCurrent(rootId).every((current) => current)).toBe(true)
    expect(t.fusionRepository.synthesis(synthesis.id)?.status).toBe('confirmed')
    expect(t.examples.count('synthetiser')).toBe(examples + 1)
  })

  it('should_refuse_with_a_conflict_and_change_nothing_when_the_idea_was_reopened_and_answered', async () => {
    const { rootId, batchId } = await hatched()
    t.fusion.reopen(rootId)
    t.growth.addBranch({ parentId: rootId, title: 'Nouvelle réponse' })
    const snapshot = t.neurons.getTree(rootId).root

    const result = await dispatch('history:undo', { batchId })
    expect(result).toMatchObject({ success: false, error: { code: 'UNDO_CONFLICT' } })
    const conflicts = result.success ? [] : (result.error.details?.['conflicts'] as string[])
    expect(conflicts.join(' ')).toMatch(/L’idée a changé depuis/)
    expect(t.neurons.getTree(rootId).root).toEqual(snapshot)
  })

  it('should_drop_the_link_suggestions_born_from_the_hatching_when_it_is_undone', async () => {
    const other = await readyRoot(t, 'action', ['Cette semaine', '300 €', 'Un 24 pouces'])
    t.h.claude.enqueue(screenPlan())
    const otherSynthesis = await t.fusion.lock({ rootId: other.root.id })
    t.fusion.confirm(otherSynthesis.id)
    await t.links.settled()
    const { rootId, batchId } = await hatched()
    t.h.claude.enqueue({ raw: { links: [{ targetAlias: 'N1', label: 'même bureau', justification: 'deux écrans' }] } })
    await t.links.settled()
    expect(t.links.list('suggested').some((link) => link.a.id === rootId || link.b.id === rootId)).toBe(true)
    history.undo(batchId)
    expect(t.links.list('suggested').some((link) => link.a.id === rootId || link.b.id === rootId)).toBe(false)
  })

  it('should_undo_and_redo_a_manually_created_link', async () => {
    const first = await hatched()
    t.h.claude.enqueue(screenPlan())
    const second = await readyRoot(t, 'action', ['Demain', '100 €', 'Un support'])
    t.h.claude.enqueue(screenPlan())
    t.fusion.confirm((await t.fusion.lock({ rootId: second.root.id })).id)
    const link = t.links.create({ aRootId: first.rootId, bRootId: second.root.id, label: 'même bureau' })
    const page = history.list()
    const created = page.items.find((item) => item.summary === 'Création du lien « même bureau »')
    expect(created?.undoable).toBe(true)

    const undo = history.undo(created?.batchId ?? '')
    expect(t.links.list().some((entry) => entry.id === link.id)).toBe(false)
    history.undo(undo.undoBatchId)
    expect(t.links.list().find((entry) => entry.id === link.id)).toMatchObject({
      label: 'même bureau',
      status: 'accepted'
    })
  })

  it('should_list_batches_newest_first_with_readable_summaries_and_paginate', async () => {
    const { batchId } = await hatched()
    history.undo(batchId)
    const result = await dispatch('history:list', { limit: 1 })
    const page = (result.success ? result.data : null) as HistoryPageView
    expect(page.items).toHaveLength(1)
    expect(page.items[0]).toMatchObject({
      kind: 'undo',
      summary: 'Éclosion annulée de « Acheter un 2e écran »',
      undoable: true
    })
    expect(page.nextCursor).not.toBeNull()
    const next = await dispatch('history:list', { limit: 1, cursor: page.nextCursor })
    const second = (next.success ? next.data : null) as HistoryPageView
    expect(second.items[0]).toMatchObject({
      kind: 'confirm_synthesis',
      summary: 'Éclosion de « Acheter un 2e écran »',
      undoable: false,
      undone: true
    })
  })

  it('should_refuse_to_undo_twice_or_to_undo_a_reopening', async () => {
    const { rootId, batchId } = await hatched()
    history.undo(batchId)
    expect(() => history.undo(batchId)).toThrow(expect.objectContaining({ code: 'ALREADY_UNDONE' }))
    t.h.claude.enqueue(etendreReply([]))
    t.fusion.confirm(t.fusion.proposed(rootId)?.id ?? '')
    t.fusion.reopen(rootId)
    const reopening = history.list().items.find((item) => item.summary.startsWith('Réouverture'))
    expect(reopening?.undoable).toBe(false)
    expect(() => history.undo(reopening?.batchId ?? '')).toThrow(expect.objectContaining({ code: 'NOT_UNDOABLE' }))
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
