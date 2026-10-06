import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PlanService } from '../../../src/main/application/plan/PlanService'
import { WidgetIoService } from '../../../src/main/application/widgets/WidgetIoService'
import { BlockRepository } from '../../../src/main/infrastructure/db/repositories/BlockRepository'
import { NeuronRepository } from '../../../src/main/infrastructure/db/repositories/NeuronRepository'
import { PlanRepository } from '../../../src/main/infrastructure/db/repositories/PlanRepository'
import { WidgetIoRepository } from '../../../src/main/infrastructure/db/repositories/WidgetIoRepository'
import { WidgetRepository } from '../../../src/main/infrastructure/db/repositories/WidgetRepository'
import { neurons, widgetInputs } from '../../../src/main/infrastructure/db/schemaNeurons'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

const sheet = (resume: string): string =>
  JSON.stringify({ resume, points_cles: [], decisions: [], questions_ouvertes: [], manques: [] })

describe('widget branché sur une étape de plan (spec 015 US1, US2)', () => {
  let t: NeuronHarness
  let io: WidgetIoService
  let widgets: WidgetRepository
  let blockId: string
  let genesisId: string
  let parentStep: string
  let step: string
  let child: string

  const approveVersion = (): string => {
    const version = widgets.insertVersion({
      blockId,
      title: 'Budget',
      html: '<main></main>',
      css: '',
      ts: 'gi.onInputs(() => {})',
      js: 'gi.onInputs(() => {})',
      summary: 'Version',
      model: 'claude-sonnet-5-5'
    })
    widgets.setCurrent(blockId, version.id)
    return version.id
  }

  /** Propose et accepte une couche d'étapes sous `parentId` ; renvoie leurs identifiants dans l'ordre. */
  const grow = (service: PlanService, plan: PlanRepository, parentId: string, titles: string[]): readonly string[] => {
    const { proposalId } = service.propose({
      parentId,
      steps: titles.map((title, index) => ({ key: `k${index}`, title, why: `Parce que ${title}` }))
    })
    return service.decide({
      proposalId,
      accept: plan.proposal(proposalId)?.items.map((item) => item.id) ?? [],
      reject: []
    }).born
  }

  beforeEach(async () => {
    t = createNeuronHarness()
    const db = t.handle.db
    widgets = new WidgetRepository(db)
    const neuronRepository = new NeuronRepository(db)
    const plan = new PlanRepository(db)
    io = new WidgetIoService({
      repository: new WidgetIoRepository(db),
      widgets,
      blocks: new BlockRepository(db),
      tree: (id) => (neuronRepository.root(id) === undefined ? undefined : t.neurons.getTree(id)),
      document: () => null,
      context: {
        node: (id) => plan.node(id),
        steps: (id) => plan.steps(id),
        sheetJson: (id) => plan.sheetJson(id),
        whyOf: (id) => plan.whyOf(id),
        final: (id) =>
          id === step
            ? { deliverable: 'budget.md', state: 'a_revoir', files: [{ path: 'docs/budget.md', status: 'cree' }] }
            : null,
        documents: (ids) => (ids.has(step) ? [{ title: 'Devis', content: 'Trois devis relevés.' }] : [])
      }
    })
    blockId = new BlockRepository(db).insert({ kind: 'widget', x: 0, y: 0, width: 520, height: 440, text: null }).id

    genesisId = (await t.neurons.create({ text: 'Mariage de Léa' })).id
    const service = new PlanService({ repository: plan })
    ;[parentStep = ''] = grow(service, plan, genesisId, ['Préparer'])
    ;[, step = ''] = grow(service, plan, parentStep, ['Choisir le lieu', 'Chiffrer le budget'])
    ;[child = ''] = grow(service, plan, step, ['Demander les devis'])
    db.update(neurons)
      .set({ sheetJson: sheet('Fête en juin') })
      .where(eq(neurons.id, genesisId))
      .run()
    db.update(neurons)
      .set({ sheetJson: sheet('Budget serré') })
      .where(eq(neurons.id, step))
      .run()
  })
  afterEach(() => t.dispose())

  it('should_connect_a_step_with_its_rank_and_all_its_context_parts', () => {
    const state = io.connect({ blockId, sourceKind: 'plan_step', sourceId: step })
    expect(state.inputs).toEqual([
      expect.objectContaining({
        sourceKind: 'plan_step',
        sourceId: step,
        title: 'Chiffrer le budget',
        // Revue : rang au style de la carte ; données du widget : chiffres simples.
        label: '①.2',
        parts: ['identity', 'sheet', 'path', 'subtree']
      })
    ])
    expect(() => io.connect({ blockId, sourceKind: 'plan_step', sourceId: step })).toThrow(
      expect.objectContaining({ code: 'DUPLICATE' })
    )
    // Un genesis n'est pas une étape.
    expect(() => io.connect({ blockId, sourceKind: 'plan_step', sourceId: genesisId })).toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' })
    )
  })

  it('should_give_the_full_context_of_the_step_once_approved', () => {
    const versionId = approveVersion()
    io.connect({ blockId, sourceKind: 'plan_step', sourceId: step })
    expect(io.inputs({ blockId, versionId })).toEqual({ approved: false, inputs: [] })
    io.approve(blockId)
    const [input] = io.inputs({ blockId, versionId }).inputs
    expect(input).toEqual({
      kind: 'plan_step',
      id: step,
      genesisId,
      title: 'Chiffrer le budget',
      label: '1.2',
      rank: 2,
      depth: 2,
      status: 'a_faire',
      why: 'Parce que Chiffrer le budget',
      final: { deliverable: 'budget.md', state: 'a_revoir' },
      sheet: expect.objectContaining({ resume: 'Budget serré' }),
      path: [
        expect.objectContaining({ id: genesisId, kind: 'genesis', label: null, title: 'Mariage de Léa' }),
        expect.objectContaining({ id: parentStep, kind: 'step', label: '1', title: 'Préparer' })
      ],
      subtree: {
        steps: [expect.objectContaining({ id: child, parentId: step, label: '1.2.1', title: 'Demander les devis' })],
        documents: [{ title: 'Devis', content: 'Trois devis relevés.' }],
        deliverable: [{ path: 'docs/budget.md', status: 'cree' }]
      }
    })
    if (input?.kind !== 'plan_step') throw new Error('kind')
    expect(input.path?.[0]?.sheet.resume).toBe('Fête en juin')
  })

  it('should_drop_an_unchecked_part_after_a_new_approval_and_read_fresh_content_without_one', () => {
    const versionId = approveVersion()
    const inputId = io.connect({ blockId, sourceKind: 'plan_step', sourceId: step }).inputs[0]?.id ?? ''
    io.approve(blockId)
    expect(io.setParts({ inputId, parts: ['identity', 'sheet', 'subtree'] }).approved).toBe(false)
    io.approve(blockId)
    const [input] = io.inputs({ blockId, versionId }).inputs
    expect(input).not.toHaveProperty('path')
    // Une fiche modifiée arrive à jour, sans nouvelle autorisation.
    t.handle.db
      .update(neurons)
      .set({ sheetJson: sheet('Budget revu') })
      .where(eq(neurons.id, step))
      .run()
    const [fresh] = io.inputs({ blockId, versionId }).inputs
    expect(fresh).toMatchObject({ sheet: { resume: 'Budget revu' } })
  })

  it('should_give_an_idea_its_plan_and_convert_an_old_style_connection_once', () => {
    const versionId = approveVersion()
    // Branchement d'idée créé avant la spec 015 (ancien vocabulaire), autorisé à l'époque.
    t.handle.db
      .insert(widgetInputs)
      .values({
        id: 'old-input',
        blockId,
        sourceKind: 'idea',
        sourceId: genesisId,
        partsJson: JSON.stringify(['identity', 'original', 'answers', 'tree', 'document'])
      })
      .run()
    const state = io.state(blockId)
    expect(state.inputs[0]?.parts).toEqual(['identity', 'sheet', 'plan', 'annexes'])
    expect(state.approved).toBe(false)
    io.approve(blockId)
    const [idea] = io.inputs({ blockId, versionId }).inputs
    if (idea?.kind !== 'idea') throw new Error('kind')
    expect(idea.sheet?.resume).toBe('Fête en juin')
    expect(idea.plan?.map((entry) => `${entry.label} ${entry.title}`)).toEqual([
      '1 Préparer',
      '1.1 Choisir le lieu',
      '1.2 Chiffrer le budget',
      '1.2.1 Demander les devis'
    ])
  })

  it('should_give_an_empty_input_when_the_step_is_removed', () => {
    const versionId = approveVersion()
    io.connect({ blockId, sourceKind: 'plan_step', sourceId: step })
    io.approve(blockId)
    t.handle.db.update(neurons).set({ state: 'archived' }).where(eq(neurons.id, step)).run()
    expect(io.inputs({ blockId, versionId }).inputs).toEqual([])
    expect(io.state(blockId).inputs[0]).toMatchObject({ title: null, label: null })
  })
})
