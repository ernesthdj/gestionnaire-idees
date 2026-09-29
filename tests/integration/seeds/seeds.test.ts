import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CanvasService } from '../../../src/main/application/canvas/CanvasService'
import { HistoryService } from '../../../src/main/application/history/HistoryService'
import { BlockRepository } from '../../../src/main/infrastructure/db/repositories/BlockRepository'
import { HistoryRepository } from '../../../src/main/infrastructure/db/repositories/HistoryRepository'
import { NeuronRepository } from '../../../src/main/infrastructure/db/repositories/NeuronRepository'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

const seed = { title: 'Faire financer l’écran par la prochaine mission', why: 'L’acompte paie l’outil de retouche.' }

describe('graines d’idées sur les liens (FR-028)', () => {
  let t: NeuronHarness
  let history: HistoryService
  beforeEach(() => {
    t = createNeuronHarness()
    history = new HistoryService(new HistoryRepository(t.handle.db))
  })
  afterEach(() => t.dispose())

  async function hatched(text: string, planTitle: string) {
    const root = await t.neurons.create({ text, nature: 'action' })
    t.h.claude.enqueue({
      raw: { nodes: [{ ref: 't0', type: 'task', title: planTitle, sourceRefs: ['s0'] }], dependencies: [], gaps: [] }
    })
    const proposal = await t.fusion.lock({ rootId: root.id, force: true })
    return { root, confirm: () => t.fusion.confirm(proposal.id) }
  }

  /** Deux idées écloses ; la seconde fait suggérer un lien (avec ou sans graine). */
  async function suggestedLink(linkSeed: unknown) {
    const wedding = await hatched('Mission photo mariage', 'Encaisser l’acompte du mariage photo')
    wedding.confirm()
    await t.links.settled()
    const screen = await hatched('Écran pour la retouche photo', 'Commander l’écran photo')
    t.h.claude.enqueue({
      raw: {
        links: [{ targetAlias: 'N1', label: 'financement', justification: 'L’acompte paie l’écran.', seed: linkSeed }]
      }
    })
    screen.confirm()
    await t.links.settled()
    const [link] = t.links.list('suggested')
    if (link === undefined) throw new Error('lien attendu')
    return { wedding: wedding.root, screen: screen.root, link }
  }

  it('should_show_the_seed_only_once_its_link_is_accepted', async () => {
    const { link } = await suggestedLink(seed)
    expect(t.seeds.list()).toEqual([])
    t.links.decide({ linkId: link.id, accept: true })
    expect(t.seeds.list()).toEqual([
      expect.objectContaining({ linkId: link.id, ...seed, status: 'suggested', bornRootId: null })
    ])
  })

  it('should_keep_the_link_when_the_seed_is_malformed', async () => {
    const { link } = await suggestedLink({ title: '', why: 42 })
    expect(link.label).toBe('financement')
    t.links.decide({ linkId: link.id, accept: true })
    expect(t.seeds.list()).toEqual([])
  })

  it('should_accept_a_seed_into_a_raw_idea_placed_between_its_parents', async () => {
    const { wedding, screen, link } = await suggestedLink(seed)
    new NeuronRepository(t.handle.db).savePositions([
      { rootId: wedding.id, x: 100, y: 0 },
      { rootId: screen.id, x: 300, y: 200 }
    ])
    t.links.decide({ linkId: link.id, accept: true })
    const [pending] = t.seeds.list()

    const { seed: accepted, rootId } = t.seeds.accept(pending?.id ?? '')
    expect(accepted).toMatchObject({ status: 'accepted', bornRootId: rootId })
    expect(accepted.parents.map((parent) => parent.id).sort()).toEqual([wedding.id, screen.id].sort())
    const born = t.neurons.getTree(rootId).root
    expect(born).toMatchObject({ title: seed.title, state: 'raw', position: { x: 200, y: 100 } })
    expect(t.examples.count('germer')).toBe(1)
    // Reliée à ses deux parents par des liens acceptés « née de ».
    const lineage = t.links.list('accepted').filter((l) => l.label === 'née de')
    expect(lineage.map((l) => [l.a.id, l.b.id].sort().join('|')).sort()).toEqual(
      [[rootId, wedding.id].sort().join('|'), [rootId, screen.id].sort().join('|')].sort()
    )
    expect(() => t.seeds.accept(pending?.id ?? '')).toThrow(expect.objectContaining({ code: 'INVALID_STATE' }))

    const [entry] = history.list().items
    expect(entry).toMatchObject({ kind: 'seed', rootId, undoable: true })
    expect(entry?.summary).toContain(seed.title)
  })

  it('should_undo_an_accepted_seed_then_redo_it', async () => {
    const { link } = await suggestedLink(seed)
    t.links.decide({ linkId: link.id, accept: true })
    const { rootId } = t.seeds.accept(t.seeds.list()[0]?.id ?? '')
    const batchId = history.list().items[0]?.batchId ?? ''

    const { undoBatchId } = history.undo(batchId)
    expect(t.neurons.getTree(rootId).root.state).toBe('archived')
    expect(t.links.list().filter((l) => l.label === 'née de')).toEqual([])
    expect(t.seeds.list()).toEqual([expect.objectContaining({ status: 'suggested', bornRootId: null })])
    expect(history.list().items[0]?.summary).toMatch(/^Graine annulée/)

    history.undo(undoBatchId)
    expect(t.neurons.getTree(rootId).root.state).toBe('raw')
    expect(t.links.list('accepted').filter((l) => l.label === 'née de')).toHaveLength(2)
    expect(t.seeds.list()).toEqual([expect.objectContaining({ status: 'accepted', bornRootId: rootId })])
  })

  it('should_show_the_born_idea_on_the_map_linked_to_its_parents', async () => {
    const { link } = await suggestedLink(seed)
    t.links.decide({ linkId: link.id, accept: true })
    const canvas = new CanvasService({
      neurons: new NeuronRepository(t.handle.db),
      links: t.linkRepository,
      blocks: new BlockRepository(t.handle.db)
    })
    expect(canvas.get().seeds).toEqual([expect.objectContaining({ linkId: link.id, status: 'suggested' })])

    const { rootId } = t.seeds.accept(canvas.get().seeds[0]?.id ?? '')
    const view = canvas.get()
    expect(view.ideas.find((root) => root.id === rootId)).toMatchObject({ state: 'raw', contextLevel: null })
    expect(view.counts.raw).toBe(1)
    expect(view.seeds).toEqual([expect.objectContaining({ status: 'accepted', bornRootId: rootId })])
  })

  it('should_refuse_to_undo_when_the_born_idea_has_grown_since', async () => {
    const { link } = await suggestedLink(seed)
    t.links.decide({ linkId: link.id, accept: true })
    const { rootId } = t.seeds.accept(t.seeds.list()[0]?.id ?? '')
    new NeuronRepository(t.handle.db).updateRoot(rootId, { state: 'developing' })

    expect(() => history.undo(history.list().items[0]?.batchId ?? '')).toThrow(
      expect.objectContaining({ code: 'UNDO_CONFLICT' })
    )
    expect(t.neurons.getTree(rootId).root.state).toBe('developing')
  })

  it('should_never_repropose_a_rejected_seed', async () => {
    const { link } = await suggestedLink(seed)
    t.links.decide({ linkId: link.id, accept: true })
    expect(t.seeds.reject(t.seeds.list()[0]?.id ?? '')).toEqual({ ok: true })
    expect(t.seeds.list()).toEqual([])
    expect(t.examples.count('germer')).toBe(1)

    const calls = t.h.claude.requests.length
    expect(await t.seeds.germinate(link.id)).toBe(false)
    expect(t.h.claude.requests.length).toBe(calls)
  })

  it('should_germinate_a_seed_in_the_background_after_a_user_link', async () => {
    const bike = await t.neurons.create({ text: 'Vélo électrique' })
    const move = await t.neurons.create({ text: 'Déménager en banlieue' })
    t.h.claude.enqueue({
      raw: { seed: { title: 'Choisir le logement selon les pistes cyclables', why: 'Relie les deux.' } }
    })
    const link = t.links.create({ aRootId: bike.id, bRootId: move.id, label: 'mobilité' })
    await t.seeds.settled()

    const input = t.h.anonymized.at(-1) ?? ''
    expect(input).toMatch(/Idée A : .*(Vélo|Déménager)/)
    expect(input).toMatch(/« mobilité »/)
    expect(t.seeds.list()).toEqual([expect.objectContaining({ linkId: link.id, status: 'suggested' })])
    expect(t.events).toContainEqual({ type: 'seeds:suggested', linkId: link.id })
  })

  it('should_record_nothing_when_the_ai_finds_no_seed', async () => {
    const bike = await t.neurons.create({ text: 'Vélo électrique' })
    const tax = await t.neurons.create({ text: 'Déclaration d’impôts' })
    t.h.claude.enqueue({ raw: {} })
    t.links.create({ aRootId: bike.id, bRootId: tax.id, label: 'budget' })
    await t.seeds.settled()
    expect(t.seeds.list()).toEqual([])
    expect(t.events.some((event) => event.type === 'seeds:suggested')).toBe(false)
  })

  it('should_drop_the_seed_with_its_link', async () => {
    const bike = await t.neurons.create({ text: 'Vélo électrique' })
    const move = await t.neurons.create({ text: 'Déménager en banlieue' })
    t.h.claude.enqueue({ raw: { seed } })
    const link = t.links.create({ aRootId: bike.id, bRootId: move.id, label: 'mobilité' })
    await t.seeds.settled()
    t.links.delete(link.id)
    expect(t.seeds.list()).toEqual([])
    expect(t.linkRepository.hasSeed(link.id)).toBe(false)
  })
})
