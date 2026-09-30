import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { HistoryService } from '../../../src/main/application/history/HistoryService'
import { FusionService } from '../../../src/main/application/neurons/FusionService'
import { SynthesisApplier } from '../../../src/main/application/neurons/SynthesisApplier'
import { ToolGeneration } from '../../../src/main/application/widgets/ToolGeneration'
import { WidgetIoService } from '../../../src/main/application/widgets/WidgetIoService'
import { WidgetService } from '../../../src/main/application/widgets/WidgetService'
import { placeTools } from '../../../src/main/domain/widgets/placeTools'
import { BlockRepository } from '../../../src/main/infrastructure/db/repositories/BlockRepository'
import { HatchedRepository } from '../../../src/main/infrastructure/db/repositories/HatchedRepository'
import { HistoryRepository } from '../../../src/main/infrastructure/db/repositories/HistoryRepository'
import { NeuronRepository } from '../../../src/main/infrastructure/db/repositories/NeuronRepository'
import { WidgetIoRepository } from '../../../src/main/infrastructure/db/repositories/WidgetIoRepository'
import { WidgetRepository } from '../../../src/main/infrastructure/db/repositories/WidgetRepository'
import { WidgetRequestRepository } from '../../../src/main/infrastructure/db/repositories/WidgetRequestRepository'
import { createFusionRoutes } from '../../../src/main/ipc/fusionHandlers'
import { createDispatcher } from '../../../src/main/ipc/registry'
import { readyRoot, screenPlan } from '../../support/fusion'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

const budget = {
  title: 'Tableau des dépenses',
  description: 'Additionne les achats prévus.',
  parts: ['tree', 'document'],
  producesResult: true
}
const countdown = { title: 'Compte à rebours', description: 'Jours restants.', parts: [], producesResult: false }
const checklist = { title: 'Check-list', description: 'Coche les étapes.', parts: ['document'], producesResult: false }

/** Réponse valide mais TypeScript intranspilable : la génération échoue sans nouvelle tentative. */
const broken = { raw: { title: 'Cassé', html: '', css: '', ts: 'const = ;', summary: 'Cassé.' } }

const widgetReply = (title: string) => ({
  raw: { title, html: '<main></main>', css: '', ts: 'gi.onInputs(() => {})', summary: `${title} fabriqué.` }
})

describe('outils cochés à l’éclosion (spec 006 lot 2)', () => {
  let t: NeuronHarness
  let fusion: FusionService
  let generation: ToolGeneration
  let blocks: BlockRepository
  let requests: WidgetRequestRepository
  let widgets: WidgetRepository
  let io: WidgetIoService
  let history: HistoryService

  beforeEach(() => {
    t = createNeuronHarness()
    const db = t.handle.db
    blocks = new BlockRepository(db)
    requests = new WidgetRequestRepository(db)
    widgets = new WidgetRepository(db)
    const ioRepository = new WidgetIoRepository(db)
    const neuronRepository = new NeuronRepository(db)
    const hatched = new HatchedRepository(db)
    io = new WidgetIoService({
      repository: ioRepository,
      widgets,
      blocks,
      tree: (id) => (neuronRepository.root(id) === undefined ? undefined : t.neurons.getTree(id)),
      document: (id) => hatched.result(id)
    })
    const widgetService: WidgetService = new WidgetService({
      repository: widgets,
      gateway: t.h.gateway,
      emit: () => undefined,
      inputShape: (blockId) => io.inputShape(blockId),
      request: (blockId) => generation.view(blockId)
    })
    generation = new ToolGeneration({
      requests,
      widgets: widgetService,
      exists: (blockId) => widgets.widget(blockId) !== undefined
    })
    const applier = new SynthesisApplier({
      repository: t.fusionRepository,
      tree: t.growthRepository,
      neurons: t.neurons,
      examples: t.examples,
      onStale: () => undefined,
      tools: {
        blocks,
        inputs: ioRepository,
        requests,
        surroundings: () => ({ idea: { x: 0, y: 0, width: 136, height: 136 }, obstacles: [] })
      }
    })
    fusion = new FusionService({
      repository: t.fusionRepository,
      tree: t.growthRepository,
      neurons: t.neurons,
      gateway: t.h.gateway,
      applier,
      links: { suggestInBackground: () => undefined },
      emit: () => undefined,
      existingTools: (rootId) => ioRepository.toolsOf(rootId),
      onToolsCreated: (blockIds) => generation.start(blockIds)
    })
    history = new HistoryService(new HistoryRepository(db))
  })
  afterEach(() => t.dispose())

  async function proposed(tools: readonly unknown[] = [budget, countdown, checklist]) {
    const tree = await readyRoot(t)
    t.h.claude.enqueue({ raw: { ...screenPlan().raw, tools } })
    const proposal = await fusion.lock({ rootId: tree.root.id })
    return { rootId: tree.root.id, synthesisId: proposal.id }
  }

  it('should_create_a_connected_empty_widget_per_checked_tool_in_the_hatching_batch', async () => {
    const { rootId, synthesisId } = await proposed()
    t.h.claude.enqueue(widgetReply('Tableau des dépenses'), widgetReply('Compte à rebours'))
    const confirmed = fusion.confirm(synthesisId, [0, 1])
    expect(confirmed.toolBlockIds).toHaveLength(2)
    const [budgetId, countdownId] = confirmed.toolBlockIds
    expect(t.neurons.getTree(rootId).root.state).toBe('hatched')
    // Branché avec les parties annoncées ; l'outil qui ne lit rien n'est pas branché.
    expect(io.state(budgetId ?? '').inputs).toEqual([
      expect.objectContaining({ sourceKind: 'idea', sourceId: rootId, parts: ['tree', 'document'] })
    ])
    expect(io.state(countdownId ?? '').inputs).toEqual([])
    expect(requests.get(budgetId ?? '')).toMatchObject({ rootId, title: 'Tableau des dépenses', producesResult: true })
    // Un seul lot : l'éclosion.
    expect(history.list().items[0]).toMatchObject({
      batchId: confirmed.batchId,
      summary: expect.stringMatching(/^Éclosion/)
    })
    await generation.settled()
  })

  it('should_generate_the_tools_one_after_the_other_without_any_value_of_the_idea', async () => {
    const { synthesisId } = await proposed()
    t.h.claude.enqueue(widgetReply('Tableau des dépenses'), widgetReply('Check-list'))
    const calls = t.h.claude.requests.length
    const { toolBlockIds } = fusion.confirm(synthesisId, [0, 2])
    await generation.settled()
    const sent = t.h.anonymized.slice(-2)
    expect(t.h.claude.requests.length).toBe(calls + 2)
    expect(sent[0]).toContain('« Tableau des dépenses ». Additionne les achats prévus.')
    expect(sent[0]).toContain('Publie son résultat avec window.gi.output.')
    expect(sent[0]).toContain('structure seulement')
    // Aucune valeur de l'idée (réponses « 250 € », « Un 27 pouces »…) : seulement la structure des entrées.
    for (const text of sent) expect(text).not.toMatch(/250|27 pouces|Cette semaine|2e écran/)
    for (const blockId of toolBlockIds) {
      expect(widgets.widget(blockId)?.versionId).not.toBeNull()
      expect(requests.get(blockId)).toBeUndefined()
      // Généré, il reste « À revoir » tant que sa version n'est pas autorisée.
      if (io.state(blockId).inputs.length > 0) expect(io.state(blockId).approved).toBe(false)
    }
  })

  it('should_keep_the_idea_hatched_and_the_other_tool_generated_when_one_generation_fails', async () => {
    const { rootId, synthesisId } = await proposed()
    t.h.claude.enqueue(broken, widgetReply('Compte à rebours'))
    const { toolBlockIds } = fusion.confirm(synthesisId, [0, 1])
    await generation.settled()
    const [failed, generated] = toolBlockIds
    expect(t.neurons.getTree(rootId).root.state).toBe('hatched')
    expect(widgets.widget(failed ?? '')?.versionId).toBeNull()
    expect(generation.view(failed ?? '')).toEqual({
      title: 'Tableau des dépenses',
      description: 'Additionne les achats prévus.',
      state: 'idle'
    })
    expect(widgets.widget(generated ?? '')?.versionId).not.toBeNull()

    t.h.claude.enqueue(widgetReply('Tableau des dépenses'))
    const retried = await generation.retry(failed ?? '')
    expect(retried.current?.title).toBe('Tableau des dépenses')
    expect(generation.view(failed ?? '')).toBeNull()
    await expect(generation.retry(failed ?? '')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('should_remove_the_tools_with_the_hatching_when_it_is_undone', async () => {
    const { rootId, synthesisId } = await proposed()
    t.h.claude.enqueue(widgetReply('Tableau des dépenses'))
    const confirmed = fusion.confirm(synthesisId, [0])
    await generation.settled()
    history.undo(confirmed.batchId)
    expect(t.neurons.getTree(rootId).root.state).toBe('developing')
    expect(blocks.list()).toEqual([])
    expect(io.links()).toEqual([])
  })

  it('should_ignore_a_generation_that_ends_after_the_hatching_was_undone', async () => {
    const { synthesisId } = await proposed()
    t.h.claude.enqueue(widgetReply('Tableau des dépenses'))
    const confirmed = fusion.confirm(synthesisId, [0])
    // Annulé avant que la file ne tourne : le widget n'existe plus quand vient son tour.
    history.undo(confirmed.batchId)
    await generation.settled()
    const [blockId] = confirmed.toolBlockIds
    expect(widgets.versions(blockId ?? '')).toEqual([])
  })

  it('should_create_nothing_without_a_checked_tool', async () => {
    const { synthesisId } = await proposed()
    const calls = t.h.claude.requests.length
    expect(fusion.confirm(synthesisId).toolBlockIds).toEqual([])
    await generation.settled()
    expect(blocks.list()).toEqual([])
    expect(t.h.claude.requests.length).toBe(calls)
  })

  it('should_refuse_an_unknown_or_repeated_tool_and_apply_nothing', async () => {
    const { rootId, synthesisId } = await proposed([budget])
    expect(() => fusion.confirm(synthesisId, [1])).toThrow(expect.objectContaining({ code: 'VALIDATION' }))
    expect(() => fusion.confirm(synthesisId, [0, 0])).toThrow(expect.objectContaining({ code: 'VALIDATION' }))
    expect(t.neurons.getTree(rootId).root.state).toBe('developing')
    expect(blocks.list()).toEqual([])
  })

  it('should_validate_the_checked_tools_on_the_channel', async () => {
    const { synthesisId } = await proposed()
    const dispatch = createDispatcher(createFusionRoutes(fusion))
    for (const tools of [[3], [-1], [0.5], [0, 1, 2, 0], 'tout']) {
      expect(await dispatch('fusion:confirm', { synthesisId, tools })).toMatchObject({
        success: false,
        error: { code: 'VALIDATION' }
      })
    }
    t.h.claude.enqueue(widgetReply('Check-list'))
    expect(await dispatch('fusion:confirm', { synthesisId, tools: [2] })).toMatchObject({ success: true })
    await generation.settled()
  })

  it('should_not_propose_again_a_tool_created_at_hatching_even_before_it_is_generated', async () => {
    const { rootId, synthesisId } = await proposed()
    t.h.claude.enqueue(broken)
    fusion.confirm(synthesisId, [0])
    await generation.settled()
    expect(new WidgetIoRepository(t.handle.db).toolsOf(rootId)).toEqual([
      { title: 'Tableau des dépenses', summary: 'Additionne les achats prévus.' }
    ])
  })
})

describe('place des outils autour de l’idée (spec 006 FR-014)', () => {
  const idea = { x: 0, y: 0, width: 136, height: 136 }
  const size = { width: 520, height: 440 }
  const overlap = (a: { x: number; y: number }, b: { x: number; y: number; width: number; height: number }) =>
    Math.abs(a.x - b.x) * 2 < size.width + b.width && Math.abs(a.y - b.y) * 2 < size.height + b.height

  it('should_put_the_first_tool_on_the_left_of_the_idea_away_from_its_next_step', () => {
    const step = { x: 190, y: 130, width: 240, height: 160 }
    const [first] = placeTools(idea, 1, size, [step])
    expect(first?.x).toBeLessThan(0)
    expect(overlap(first ?? { x: 0, y: 0 }, step)).toBe(false)
  })

  it('should_never_cover_the_idea_an_obstacle_or_another_tool', () => {
    const obstacles = [
      { x: -500, y: 0, width: 520, height: 440 },
      { x: 0, y: -600, width: 400, height: 300 }
    ]
    const places = placeTools(idea, 3, size, obstacles)
    expect(places).toHaveLength(3)
    for (const place of places) {
      for (const box of [idea, ...obstacles]) expect(overlap(place, box)).toBe(false)
    }
    const [a, b, c] = places
    for (const [p, q] of [
      [a, b],
      [a, c],
      [b, c]
    ] as const) {
      expect(overlap(p ?? { x: 0, y: 0 }, { ...(q ?? { x: 0, y: 0 }), ...size })).toBe(false)
    }
  })

  it('should_be_deterministic', () => {
    expect(placeTools(idea, 2, size, [])).toEqual(placeTools(idea, 2, size, []))
  })
})
