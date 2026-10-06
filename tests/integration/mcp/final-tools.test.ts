import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FinalService } from '../../../src/main/application/finals/FinalService'
import { FinalTools } from '../../../src/main/application/mcp/FinalTools'
import { NeuronTools } from '../../../src/main/application/mcp/NeuronTools'
import { PlanService } from '../../../src/main/application/plan/PlanService'
import { toMcpError } from '../../../src/main/domain/mcp/errors'
import { ConversationRepository } from '../../../src/main/infrastructure/db/repositories/ConversationRepository'
import { FinalRepository } from '../../../src/main/infrastructure/db/repositories/FinalRepository'
import { PlanRepository } from '../../../src/main/infrastructure/db/repositories/PlanRepository'
import { ActionProposerInput } from '../../../src/shared/mcp/tools'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

describe('outil MCP action_proposer (spec 013 US1)', () => {
  let t: NeuronHarness
  let finals: FinalService
  let tools: FinalTools
  let neuronTools: NeuronTools
  let proposed: string[]
  let genesis: string
  let step: string
  let other: string

  beforeEach(async () => {
    t = createNeuronHarness()
    const plan = new PlanRepository(t.handle.db)
    const conversations = new ConversationRepository(t.handle.db)
    finals = new FinalService({ repository: new FinalRepository(t.handle.db), plan })
    proposed = []
    tools = new FinalTools({ finals, conversations, onProposed: (summary) => proposed.push(summary) })
    neuronTools = new NeuronTools({
      conversations,
      insertAssessment: () => undefined,
      onChanged: () => undefined,
      plan,
      finals
    })
    genesis = (await t.neurons.create({ text: 'Site vitrine' })).id
    other = (await t.neurons.create({ text: 'Acheter un 70-200' })).id
    const service = new PlanService({ repository: plan })
    const { proposalId } = service.propose({
      parentId: genesis,
      steps: [{ key: 'contact', title: 'Page contact', why: 'Les clients écrivent' }]
    })
    ;[step = ''] = service.decide({
      proposalId,
      accept: plan.proposal(proposalId)?.items.map((item) => item.id) ?? [],
      reject: []
    }).born
  })
  afterEach(() => t.dispose())

  const call = (args: unknown, neuronId: string | null = step) =>
    tools.propose(ActionProposerInput.parse(args), { neuronId })

  it('should_propose_the_conversation_step_announce_it_and_show_it_in_neurone_contexte', () => {
    const result = call({ livrable: 'src/pages/Contact.tsx', raison: 'Un seul composant' })
    expect(result.text).toContain('en attente de sa validation')
    expect(proposed).toEqual(['Claude propose « Page contact » comme action finale'])
    expect(finals.actionOf(step)?.state).toBe('proposee')
    expect(neuronTools.context(undefined, { neuronId: step }).text).toContain(
      'Action finale (proposée, en attente de mentalyas) — livrable annoncé : src/pages/Contact.tsx'
    )
  })

  it('should_refuse_a_genesis_with_an_invalid_batch_error_for_claude', () => {
    try {
      call({ livrable: 'x', raison: 'y' }, genesis)
      expect.unreachable()
    } catch (error) {
      expect(toMcpError(error)).toMatchObject({ code: 'LOT_INVALIDE' })
    }
  })

  it('should_refuse_a_step_of_another_tree', () => {
    expect(() => call({ id: step, livrable: 'x', raison: 'y' }, other)).toThrow(
      expect.objectContaining({ code: 'NON_MODIFIABLE' })
    )
  })

  it.each([{ livrable: '', raison: 'y' }, { livrable: 'x' }, { livrable: 'x', raison: 'y', chemin: 'C:/' }])(
    'should_reject_the_malformed_input_%j',
    (args) => {
      expect(ActionProposerInput.safeParse(args).success).toBe(false)
    }
  )
})
