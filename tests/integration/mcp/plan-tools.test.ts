import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NeuronTools } from '../../../src/main/application/mcp/NeuronTools'
import { PlanTools } from '../../../src/main/application/mcp/PlanTools'
import { PlanService } from '../../../src/main/application/plan/PlanService'
import { AppError } from '../../../src/main/domain/errors'
import { McpToolError, toMcpError } from '../../../src/main/domain/mcp/errors'
import { ConversationRepository } from '../../../src/main/infrastructure/db/repositories/ConversationRepository'
import { PlanRepository } from '../../../src/main/infrastructure/db/repositories/PlanRepository'
import { PlanProposerInput } from '../../../src/shared/mcp/tools'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

describe('outil MCP plan_proposer (spec 011 US1)', () => {
  let t: NeuronHarness
  let repository: PlanRepository
  let tools: PlanTools
  let proposed: string[]
  let studio: string
  let other: string

  beforeEach(async () => {
    t = createNeuronHarness()
    repository = new PlanRepository(t.handle.db)
    proposed = []
    tools = new PlanTools({
      plan: new PlanService({ repository }),
      conversations: new ConversationRepository(t.handle.db),
      onProposed: (summary) => proposed.push(summary)
    })
    studio = (await t.neurons.create({ text: 'Ouvrir un studio photo' })).id
    other = (await t.neurons.create({ text: 'Acheter un 70-200' })).id
  })
  afterEach(() => t.dispose())

  const call = (args: unknown, neuronId: string | null = studio) =>
    tools.propose(PlanProposerInput.parse(args), { neuronId })

  const etapes = [
    { cle: 'budget', titre: 'Valider le budget', pourquoi: 'Tout en dépend' },
    { cle: 'lieu', titre: 'Choisir le lieu', pourquoi: 'Après le budget', attend: ['budget'] }
  ]

  it('should_propose_a_layer_for_the_conversation_node_and_announce_it_without_writing_steps', () => {
    const result = call({ etapes })
    expect(result.text).toContain('en attente de sa validation')
    expect(proposed).toEqual(['Claude propose 2 étapes pour « Ouvrir un studio photo »'])
    expect(repository.pendingProposals(studio)[0]?.items.map((item) => item.title)).toEqual([
      'Valider le budget',
      'Choisir le lieu'
    ])
    expect(repository.children(studio)).toEqual([])
  })

  it('should_show_the_plan_and_the_lock_of_a_node_in_neurone_contexte', () => {
    call({ etapes })
    const [proposal] = repository.pendingProposals(studio)
    new PlanService({ repository }).decide({
      proposalId: proposal?.id ?? '',
      accept: proposal?.items.map((item) => item.id) ?? [],
      reject: []
    })
    const conversations = new ConversationRepository(t.handle.db)
    const neuronTools = new NeuronTools({
      conversations,
      insertAssessment: (input) => conversations.insertAssessment(input),
      onChanged: () => undefined,
      plan: repository
    })
    const text = neuronTools.context(undefined, { neuronId: studio }).text
    expect(text).toContain('Verrouillé')
    expect(text).toContain('Plan d’attaque (étapes filles, dans l’ordre)')
    expect(text).toMatch(/- 1\. Valider le budget \[.+\] — à faire\n- 2\. Choisir le lieu \[.+\] — à faire — attend 1/)
  })

  it('should_refuse_to_propose_for_a_node_of_another_tree', () => {
    expect(() => call({ id: other, etapes })).toThrow(expect.objectContaining({ code: 'NON_MODIFIABLE' }))
  })

  it('should_return_a_readable_error_to_claude_when_the_order_is_wrong', () => {
    const wrong = [
      { cle: 'a', titre: 'A', pourquoi: 'x', attend: ['b'] },
      { cle: 'b', titre: 'B', pourquoi: 'x' }
    ]
    let caught: unknown
    try {
      call({ etapes: wrong })
    } catch (error) {
      caught = error
    }
    expect(toMcpError(caught)).toMatchObject({ code: 'LOT_INVALIDE', message: expect.stringContaining('ordre') })
  })

  it('should_refuse_more_than_twelve_steps_at_the_schema', () => {
    const many = Array.from({ length: 13 }, (_, n) => ({ cle: `k${n}`, titre: `É${n}`, pourquoi: 'x' }))
    expect(PlanProposerInput.safeParse({ etapes: many }).success).toBe(false)
  })

  it('should_translate_expected_business_errors_and_hide_unexpected_ones', () => {
    expect(toMcpError(new AppError('NOT_FOUND', 'absent'))).toMatchObject({ code: 'INTROUVABLE', message: 'absent' })
    expect(toMcpError(new AppError('LOCKED', 'figé'))).toMatchObject({ code: 'NON_MODIFIABLE' })
    expect(toMcpError(new McpToolError('LOT_TROP_GROS', 'x'))?.code).toBe('LOT_TROP_GROS')
    expect(toMcpError(new AppError('BUSY', 'x'))).toBeUndefined()
    expect(toMcpError(new Error('panne'))).toBeUndefined()
  })
})
