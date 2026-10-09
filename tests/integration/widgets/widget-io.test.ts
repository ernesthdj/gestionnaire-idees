import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { HistoryService } from '../../../src/main/application/history/HistoryService'
import { WidgetIoService } from '../../../src/main/application/widgets/WidgetIoService'
import { BlockRepository } from '../../../src/main/infrastructure/db/repositories/BlockRepository'
import { HatchedRepository } from '../../../src/main/infrastructure/db/repositories/HatchedRepository'
import { HistoryRepository } from '../../../src/main/infrastructure/db/repositories/HistoryRepository'
import { NeuronRepository } from '../../../src/main/infrastructure/db/repositories/NeuronRepository'
import { WidgetIoRepository } from '../../../src/main/infrastructure/db/repositories/WidgetIoRepository'
import { WidgetRepository } from '../../../src/main/infrastructure/db/repositories/WidgetRepository'
import { extensions, neurons } from '../../../src/main/infrastructure/db/schemaNeurons'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

describe('entrées des widgets (spec 005 lot 1)', () => {
  let t: NeuronHarness
  let io: WidgetIoService
  let widgets: WidgetRepository
  let blockId: string
  let rootId: string

  const addVersion = (ts: string): string => {
    const version = widgets.insertVersion({
      blockId,
      title: 'Budget',
      html: '<main></main>',
      css: '',
      ts,
      js: ts,
      summary: 'Version',
      model: 'claude-sonnet-5-5'
    })
    widgets.setCurrent(blockId, version.id)
    return version.id
  }

  beforeEach(async () => {
    t = createNeuronHarness()
    const db = t.handle.db
    widgets = new WidgetRepository(db)
    const neuronRepository = new NeuronRepository(db)
    const hatched = new HatchedRepository(db)
    io = new WidgetIoService({
      repository: new WidgetIoRepository(db),
      widgets,
      blocks: new BlockRepository(db),
      tree: (id) => (neuronRepository.root(id) === undefined ? undefined : t.neurons.getTree(id)),
      document: (id) => hatched.result(id)
    })
    blockId = new BlockRepository(db).insert({ kind: 'widget', x: 0, y: 0, width: 520, height: 440, text: null }).id

    const root = await t.neurons.create({ text: 'Acheter un 2e écran', nature: 'action' })
    rootId = root.id
    // Une question répondue dans l'ancien moteur (archive, spec 010) : plus transmise depuis la spec 015.
    db.insert(extensions)
      .values({
        id: 'q1',
        rootId,
        neuronId: rootId,
        question: 'Quel budget ?',
        dimension: 'budget',
        status: 'answered',
        origin: 'ai'
      })
      .run()
    db.insert(neurons)
      .values({
        id: 'a1',
        rootId,
        parentId: rootId,
        depth: 1,
        kind: 'answer',
        title: 'budget : 300 € maximum',
        content: '300 € maximum',
        origin: 'user',
        fromExtensionId: 'q1'
      })
      .run()
  })
  afterEach(() => t.dispose())

  it('should_give_nothing_to_a_widget_until_its_version_is_approved', () => {
    const versionId = addVersion('gi.onInputs(() => {})')
    const state = io.connect({ blockId, sourceKind: 'idea', sourceId: rootId })
    expect(state).toMatchObject({ approved: false, inputs: [{ sourceKind: 'idea', title: 'Acheter un 2e écran' }] })
    expect(state.inputs[0]?.parts).toEqual(['identity', 'sheet', 'plan', 'annexes'])
    expect(io.inputs({ blockId, versionId })).toEqual({ approved: false, inputs: [] })

    expect(io.approve(blockId).approved).toBe(true)
    const given = io.inputs({ blockId, versionId })
    expect(given.approved).toBe(true)
    expect(given.inputs).toHaveLength(1)
    expect(given.inputs[0]).toMatchObject({
      kind: 'idea',
      id: rootId,
      title: 'Acheter un 2e écran',
      nature: 'action',
      originalText: 'Acheter un 2e écran',
      sheet: { resume: '', points_cles: [], decisions: [], questions_ouvertes: [], manques: [] },
      plan: [],
      annexes: { documents: [] }
    })
    expect(given.inputs[0]).not.toHaveProperty('answers')
  })

  it('should_transmit_only_the_checked_parts_and_ask_again_when_they_change', () => {
    const versionId = addVersion('gi.onInputs(() => {})')
    const inputId = io.connect({ blockId, sourceKind: 'idea', sourceId: rootId }).inputs[0]?.id ?? ''
    io.approve(blockId)
    // Changer ce qui est transmis invalide l'autorisation donnée pour l'ancienne liste.
    expect(io.setParts({ inputId, parts: ['identity'] }).approved).toBe(false)
    expect(io.inputs({ blockId, versionId }).inputs).toEqual([])
    io.approve(blockId)
    const [idea] = io.inputs({ blockId, versionId }).inputs
    expect(idea).toEqual({
      kind: 'idea',
      id: rootId,
      title: 'Acheter un 2e écran',
      nature: 'action',
      category: null,
      state: 'raw',
      originalText: 'Acheter un 2e écran'
    })
  })

  it('should_ask_for_a_new_review_when_claude_writes_a_new_version', () => {
    const first = addVersion('gi.onInputs(() => {})')
    io.connect({ blockId, sourceKind: 'idea', sourceId: rootId })
    io.approve(blockId)
    const second = addVersion('gi.onInputs((inputs) => { document.title = String(inputs.length) })')
    expect(io.state(blockId).approved).toBe(false)
    expect(io.inputs({ blockId, versionId: second })).toEqual({ approved: false, inputs: [] })
    // Revenir à la version déjà approuvée ne redemande rien.
    widgets.setCurrent(blockId, first)
    expect(io.state(blockId).approved).toBe(true)
    expect(io.inputs({ blockId, versionId: first }).inputs).toHaveLength(1)
  })

  it('should_leave_a_widget_without_input_as_before', () => {
    const versionId = addVersion('const x = 1')
    expect(io.state(blockId)).toEqual({ blockId, inputs: [], approved: false })
    expect(io.inputs({ blockId, versionId })).toEqual({ approved: true, inputs: [] })
    expect(io.inputContext(blockId)).toBeNull()
    expect(() => io.approve(blockId)).toThrow(expect.objectContaining({ code: 'INVALID_STATE' }))
  })

  it('should_refuse_a_duplicate_an_unknown_source_and_a_new_old_style_next_step', () => {
    io.connect({ blockId, sourceKind: 'idea', sourceId: rootId })
    expect(() => io.connect({ blockId, sourceKind: 'idea', sourceId: rootId })).toThrow(
      expect.objectContaining({ code: 'DUPLICATE' })
    )
    expect(() => io.connect({ blockId, sourceKind: 'idea', sourceId: '00000000-0000-4000-8000-00000000dead' })).toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' })
    )
    // L'ancienne « prochaine étape » (spec 005) ne se branche plus (spec 015 D3) ; une étape sans plan : introuvable.
    expect(() => io.connect({ blockId, sourceKind: 'step', sourceId: rootId })).toThrow(
      expect.objectContaining({ code: 'VALIDATION' })
    )
    expect(() => io.connect({ blockId, sourceKind: 'plan_step', sourceId: rootId })).toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' })
    )
  })

  it('should_give_claude_the_full_context_of_the_connected_node_values_included', () => {
    addVersion('gi.onInputs(() => {})')
    io.connect({ blockId, sourceKind: 'idea', sourceId: rootId })
    const context = io.inputContext(blockId)
    expect(context?.titles).toHaveLength(1)
    const inputs = JSON.parse(context?.json ?? '[]') as { kind: string; id: string; originalText?: string }[]
    expect(inputs[0]).toMatchObject({ kind: 'idea', id: rootId })
    expect(typeof inputs[0]?.originalText).toBe('string')
  })

  it('should_create_the_settings_panel_beside_the_widget_and_keep_the_chosen_values', () => {
    const v1 = addVersion('gi.settings([])')
    const fields = [
      { key: 'titre', label: 'Titre', type: 'text', default: 'Accueil' },
      { key: 'etat', label: 'État', type: 'select', options: ['Normal', 'Erreur'] }
    ]
    const first = io.declareSettings({ blockId, versionId: v1, fields })
    expect(first).toMatchObject({ created: true, values: { titre: 'Accueil', etat: 'Normal' } })
    const panel = new BlockRepository(t.handle.db).get(first.panelBlockId)
    expect(panel).toMatchObject({ kind: 'settings', sourceBlockId: blockId })
    expect(panel?.x).toBeGreaterThan(260)

    expect(io.setSettings({ blockId, values: { titre: 'Devis', etat: 'Inconnu' } }).values).toEqual({
      titre: 'Devis',
      etat: 'Normal'
    })
    expect(io.settingsPanel(first.panelBlockId)).toMatchObject({
      widgetBlockId: blockId,
      widgetTitle: 'Budget',
      values: { titre: 'Devis', etat: 'Normal' }
    })
    // Une nouvelle version qui redéclare garde les valeurs encore valables, et le même panneau.
    const v2 = addVersion('gi.settings([])')
    const again = io.declareSettings({ blockId, versionId: v2, fields: [fields[0]] })
    expect(again).toMatchObject({ created: false, panelBlockId: first.panelBlockId, values: { titre: 'Devis' } })
    expect(io.settingsValues(blockId).values).toEqual({ titre: 'Devis' })
  })

  it('should_refuse_settings_from_an_old_version_or_an_invalid_declaration', () => {
    const v1 = addVersion('a')
    addVersion('b')
    const fields = [{ key: 'titre', label: 'Titre', type: 'text' }]
    expect(() => io.declareSettings({ blockId, versionId: v1, fields })).toThrow(
      expect.objectContaining({ code: 'INVALID_STATE' })
    )
    const current = addVersion('c')
    expect(() =>
      io.declareSettings({ blockId, versionId: current, fields: [{ key: 'x', label: 'X', type: 'script' }] })
    ).toThrow(expect.objectContaining({ code: 'VALIDATION' }))
    expect(() => io.setSettings({ blockId, values: {} })).toThrow(expect.objectContaining({ code: 'INVALID_STATE' }))
    expect(io.settingsValues(blockId)).toEqual({ values: null, fields: [] })
  })

  it('should_save_and_read_back_the_widget_state_within_its_bounds', () => {
    addVersion('gi.onState(() => {})')
    expect(io.savedState(blockId)).toBeNull()
    expect(io.saveState({ blockId, data: { titre: 'Accueil', colonnes: 2 } })).toEqual({ ok: true })
    expect(io.savedState(blockId)).toEqual({ titre: 'Accueil', colonnes: 2 })
    expect(() => io.saveState({ blockId, data: Array(5).fill('x'.repeat(15_000)) })).toThrow(
      expect.objectContaining({ code: 'VALIDATION' })
    )
    expect(() => io.saveState({ blockId, data: { nombre: Number.NaN } })).toThrow(
      expect.objectContaining({ code: 'VALIDATION' })
    )
    expect(io.savedState(blockId)).toEqual({ titre: 'Accueil', colonnes: 2 })
  })

  it('should_disconnect_a_source_and_bring_it_back_from_the_history', () => {
    const versionId = addVersion('gi.onInputs(() => {})')
    const inputId = io.connect({ blockId, sourceKind: 'idea', sourceId: rootId }).inputs[0]?.id ?? ''
    io.approve(blockId)
    expect(io.links()).toEqual([{ id: inputId, blockId, sourceKind: 'idea', sourceId: rootId }])

    const { batchId } = io.disconnect(inputId)
    expect(io.state(blockId).inputs).toEqual([])
    expect(io.links()).toEqual([])
    expect(io.inputs({ blockId, versionId })).toEqual({ approved: true, inputs: [] })

    const history = new HistoryService(new HistoryRepository(t.handle.db))
    expect(history.list().items[0]).toMatchObject({
      batchId,
      undoable: true,
      summary: 'Débranchement d’une entrée de widget'
    })
    history.undo(batchId)
    expect(io.state(blockId)).toMatchObject({ approved: true, inputs: [{ id: inputId }] })
  })

  it('should_give_an_empty_input_when_the_idea_no_longer_exists', () => {
    const versionId = addVersion('gi.onInputs(() => {})')
    io.connect({ blockId, sourceKind: 'idea', sourceId: rootId })
    io.approve(blockId)
    t.neurons.remove(rootId)
    expect(io.state(blockId).inputs[0]?.title).toBeNull()
    expect(io.inputs({ blockId, versionId })).toEqual({ approved: true, inputs: [] })
  })

  it('should_refuse_an_unknown_widget_or_version', () => {
    const unknown = '00000000-0000-4000-8000-00000000dead'
    expect(() => io.state(unknown)).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }))
    expect(() => io.inputs({ blockId, versionId: unknown })).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }))
  })
})
