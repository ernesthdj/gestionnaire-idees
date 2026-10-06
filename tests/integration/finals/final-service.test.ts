import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FinalService } from '../../../src/main/application/finals/FinalService'
import { HistoryService } from '../../../src/main/application/history/HistoryService'
import { PlanService } from '../../../src/main/application/plan/PlanService'
import { FinalRepository } from '../../../src/main/infrastructure/db/repositories/FinalRepository'
import { HistoryRepository } from '../../../src/main/infrastructure/db/repositories/HistoryRepository'
import { PlanRepository } from '../../../src/main/infrastructure/db/repositories/PlanRepository'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

describe('proposer une action finale (spec 013 US1)', () => {
  let t: NeuronHarness
  let plan: PlanService
  let repository: FinalRepository
  let finals: FinalService
  let history: HistoryService
  let genesis: string
  let budget: string
  let lieu: string

  beforeEach(async () => {
    t = createNeuronHarness()
    const planRepository = new PlanRepository(t.handle.db)
    repository = new FinalRepository(t.handle.db)
    finals = new FinalService({ repository, plan: planRepository })
    plan = new PlanService({ repository: planRepository, finals })
    history = new HistoryService(new HistoryRepository(t.handle.db), finals.historyHandlers())
    genesis = (await t.neurons.create({ text: 'Site vitrine' })).id
    const { proposalId } = plan.propose({
      parentId: genesis,
      steps: [
        { key: 'budget', title: 'Valider le budget', why: 'Tout en dépend' },
        { key: 'lieu', title: 'Page contact', why: 'Ensuite' }
      ]
    })
    const proposal = planRepository.proposal(proposalId)
    const born = plan.decide({ proposalId, accept: proposal?.items.map((item) => item.id) ?? [], reject: [] }).born
    ;[budget = '', lieu = ''] = born
  })
  afterEach(() => t.dispose())

  const propose = (neuronId = lieu, deliverable = 'src/pages/Contact.tsx'): void =>
    finals.propose({ neuronId, deliverable, reason: 'Elle se fait d’un seul tenant', origin: 'claude' })

  it('should_show_a_pending_proposal_without_touching_the_history', () => {
    const before = history.list().items.length
    propose()
    expect(finals.actionOf(lieu)).toMatchObject({ state: 'proposee', deliverable: 'src/pages/Contact.tsx' })
    expect(finals.isFinal(lieu)).toBe(false)
    expect(history.list().items).toHaveLength(before)
  })

  it('should_replace_a_pending_proposal_and_refuse_a_new_one_once_accepted', () => {
    propose()
    propose(lieu, 'Autre')
    expect(finals.actionOf(lieu)?.deliverable).toBe('Autre')
    finals.decide(lieu, true)
    expect(() => propose()).toThrow(expect.objectContaining({ code: 'VALIDATION' }))
  })

  it('should_accept_in_one_undoable_batch_and_undo_back_to_the_proposal', () => {
    propose()
    expect(finals.decide(lieu, true)).toMatchObject({ state: 'prete', batchId: expect.any(String) })
    expect(finals.isFinal(lieu)).toBe(true)
    const [head] = history.list().items
    expect(head).toMatchObject({ kind: 'final', summary: 'Action finale : « Page contact »', undoable: true })
    history.undo(head?.batchId ?? '')
    expect(finals.actionOf(lieu)?.state).toBe('proposee')
    expect(history.list().items[0]?.summary).toBe('Annulé — Action finale : « Page contact »')
  })

  it('should_drop_a_refused_proposal_without_a_trace', () => {
    propose()
    const before = history.list().items.length
    expect(finals.decide(lieu, false)).toEqual({ state: 'archived', batchId: null })
    expect(finals.actionOf(lieu)).toBeUndefined()
    expect(history.list().items).toHaveLength(before)
  })

  it('should_demote_an_action_and_undo_the_demotion', () => {
    propose()
    finals.decide(lieu, true)
    finals.demote(lieu)
    expect(finals.actionOf(lieu)).toBeUndefined()
    const [head] = history.list().items
    expect(head?.summary).toBe('Action finale retirée : « Page contact »')
    history.undo(head?.batchId ?? '')
    expect(finals.actionOf(lieu)?.state).toBe('prete')
  })

  it('should_refuse_to_demote_or_decide_during_an_execution', () => {
    propose()
    finals.decide(lieu, true)
    repository.setState(lieu, 'en_cours')
    expect(() => finals.demote(lieu)).toThrow(expect.objectContaining({ code: 'INVALID_STATE' }))
    expect(() => finals.decide(lieu, true)).toThrow(expect.objectContaining({ code: 'INVALID_STATE' }))
  })

  it('should_refuse_a_genesis_a_step_with_children_and_a_step_with_pending_sub_steps', () => {
    expect(() => propose(genesis)).toThrow(expect.objectContaining({ code: 'VALIDATION' }))
    plan.propose({ parentId: budget, steps: [{ key: 'a', title: 'Devis', why: 'x' }] })
    expect(() => propose(budget)).toThrow(expect.objectContaining({ message: expect.stringContaining('décider') }))
    expect(() => propose('00000000-0000-4000-8000-000000000000')).toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' })
    )
  })

  it('should_refuse_to_split_an_accepted_action_into_sub_steps', () => {
    propose()
    finals.decide(lieu, true)
    expect(() => plan.propose({ parentId: lieu, steps: [{ key: 'a', title: 'Formulaire', why: 'x' }] })).toThrow(
      expect.objectContaining({ code: 'VALIDATION', message: expect.stringContaining('action finale') })
    )
  })
})
