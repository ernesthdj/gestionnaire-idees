import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CanvasService } from '../../../src/main/application/canvas/CanvasService'
import { HistoryService } from '../../../src/main/application/history/HistoryService'
import { NeuronTools } from '../../../src/main/application/mcp/NeuronTools'
import { McpToolError } from '../../../src/main/domain/mcp/errors'
import { readSheet } from '../../../src/main/domain/conversation/sheet'
import { BlockRepository } from '../../../src/main/infrastructure/db/repositories/BlockRepository'
import { ConversationRepository } from '../../../src/main/infrastructure/db/repositories/ConversationRepository'
import { HistoryRepository } from '../../../src/main/infrastructure/db/repositories/HistoryRepository'
import { NeuronRepository } from '../../../src/main/infrastructure/db/repositories/NeuronRepository'
import { FicheEcrireInput, MaturiteEvaluerInput } from '../../../src/shared/mcp/tools'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

describe('outils du neurone d’une conversation (spec 008)', () => {
  let t: NeuronHarness
  let tools: NeuronTools
  let conversations: ConversationRepository
  let history: HistoryService
  let canvas: CanvasService
  let changed: string[]
  let studio: string
  let other: string

  beforeEach(async () => {
    t = createNeuronHarness()
    const db = t.handle.db
    conversations = new ConversationRepository(db)
    changed = []
    tools = new NeuronTools({
      conversations,
      insertAssessment: (input) => conversations.insertAssessment(input),
      onChanged: (id) => changed.push(id)
    })
    history = new HistoryService(new HistoryRepository(db))
    canvas = new CanvasService({
      neurons: new NeuronRepository(db),
      blocks: new BlockRepository(db),
      io: { links: () => [] },
      sheetSummaries: () => conversations.sheetSummaries()
    })
    studio = (await t.neurons.create({ text: 'Ouvrir un studio photo' })).id
    other = (await t.neurons.create({ text: 'Acheter un 70-200' })).id
  })
  afterEach(() => t.dispose())

  const write = (args: unknown, neuronId: string | null = studio) =>
    tools.writeSheet(FicheEcrireInput.parse(args), { neuronId })

  it('should_write_the_sheet_of_the_conversation_neuron_and_undo_it', () => {
    write({ resume: 'Studio à Liège', decisions: ['Lieu : Liège'] })
    expect(readSheet(conversations.neuron(studio)?.sheetJson ?? null)).toMatchObject({
      resume: 'Studio à Liège',
      decisions: ['Lieu : Liège']
    })
    write({ manques: ['Budget'] })
    expect(readSheet(conversations.neuron(studio)?.sheetJson ?? null)).toMatchObject({
      decisions: ['Lieu : Liège'],
      manques: ['Budget']
    })
    expect(changed).toEqual([studio, studio])
    const head = history.list().items[0]
    expect(head).toMatchObject({ kind: 'mcp_write', actor: 'claude', summary: 'Claude : 1 fiche' })
    history.undo(head?.batchId ?? '')
    expect(readSheet(conversations.neuron(studio)?.sheetJson ?? null).manques).toEqual([])
  })

  it('should_show_the_sheet_summary_on_the_map', () => {
    write({ resume: 'Studio à Liège' })
    expect(canvas.get().ideas.find((idea) => idea.id === studio)?.sheetSummary).toBe('Studio à Liège')
  })

  it('should_refuse_to_write_in_another_tree_than_its_conversation', () => {
    expect(() => write({ id: other, resume: 'x' })).toThrow(McpToolError)
    try {
      write({ id: other, resume: 'x' })
    } catch (error) {
      expect((error as McpToolError).code).toBe('NON_MODIFIABLE')
    }
  })

  it('should_require_an_id_outside_a_neuron_conversation', () => {
    expect(() => write({ resume: 'x' }, null)).toThrow(/id requis/)
    expect(() => write({ id: other, resume: 'Achat' }, null)).not.toThrow()
  })

  it('should_size_the_neuron_with_its_maturity', () => {
    tools.evaluate(MaturiteEvaluerInput.parse({ niveau: 'suffisant', manques: ['Budget'] }), { neuronId: studio })
    expect(canvas.get().ideas.find((idea) => idea.id === studio)?.contextLevel).toBe('sufficient')
    expect(tools.context(undefined, { neuronId: studio }).text).toContain('Maturité : suffisant')
  })

  it('should_refuse_an_empty_sheet_update', () => {
    expect(FicheEcrireInput.safeParse({}).success).toBe(false)
  })
})
