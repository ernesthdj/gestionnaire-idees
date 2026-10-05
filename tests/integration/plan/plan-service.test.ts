import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { HistoryService } from '../../../src/main/application/history/HistoryService'
import { PlanService } from '../../../src/main/application/plan/PlanService'
import { HistoryRepository } from '../../../src/main/infrastructure/db/repositories/HistoryRepository'
import { PlanRepository } from '../../../src/main/infrastructure/db/repositories/PlanRepository'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

describe('plan d’attaque : propositions et naissances (spec 011 US1)', () => {
  let t: NeuronHarness
  let repository: PlanRepository
  let plan: PlanService
  let history: HistoryService
  let genesis: string

  beforeEach(async () => {
    t = createNeuronHarness()
    repository = new PlanRepository(t.handle.db)
    plan = new PlanService({ repository })
    history = new HistoryService(new HistoryRepository(t.handle.db))
    genesis = (await t.neurons.create({ text: 'Ouvrir un studio photo' })).id
  })
  afterEach(() => t.dispose())

  const three = [
    { key: 'budget', title: 'Valider le budget', why: 'Tout en dépend' },
    { key: 'lieu', title: 'Choisir le lieu', why: 'Après le budget', waitsFor: ['budget'] },
    { key: 'com', title: 'Lancer la com', why: 'Quand le lieu est connu', waitsFor: ['lieu'] }
  ]
  const proposeThree = () => plan.propose({ parentId: genesis, steps: three })
  const itemIds = (proposalId: string) => repository.proposal(proposalId)?.items.map((item) => item.id) ?? []

  it('should_store_a_proposal_without_writing_anything_in_the_nodes_of_mentalyas', () => {
    const { proposalId } = proposeThree()
    expect(repository.pendingProposals(genesis)[0]?.items.map((item) => [item.rank, item.title])).toEqual([
      [1, 'Valider le budget'],
      [2, 'Choisir le lieu'],
      [3, 'Lancer la com']
    ])
    expect(repository.children(genesis)).toEqual([])
    expect(repository.node(genesis)?.lockedAt).toBeNull()
    expect(history.list().items.some((item) => item.kind === 'plan')).toBe(false)
    expect(proposalId).toBeTruthy()
  })

  it('should_lock_the_parent_and_give_birth_to_every_step_in_one_undoable_batch_when_all_are_accepted', () => {
    const { proposalId } = proposeThree()
    const { batchId } = plan.decide({ proposalId, accept: itemIds(proposalId), reject: [] })
    const steps = repository.children(genesis)
    expect(steps.map((step) => [step.rank, step.title, step.status, step.depth])).toEqual([
      [1, 'Valider le budget', 'a_faire', 1],
      [2, 'Choisir le lieu', 'a_faire', 1],
      [3, 'Lancer la com', 'a_faire', 1]
    ])
    expect(steps[1]?.waitsFor).toEqual([steps[0]?.id])
    expect(repository.node(genesis)?.lockedAt).not.toBeNull()
    expect(history.list().items[0]).toMatchObject({
      batchId,
      kind: 'plan',
      summary: 'Plan de « Ouvrir un studio photo » : 3 étapes',
      undoable: true
    })

    history.undo(batchId ?? '')
    expect(repository.children(genesis)).toEqual([])
    expect(repository.node(genesis)?.lockedAt).toBeNull()
    expect(history.list().items[0]?.summary).toBe('Annulé — Plan de « Ouvrir un studio photo » : 3 étapes')
  })

  it('should_give_birth_to_the_accepted_steps_only_and_drop_dependencies_on_refused_ones', () => {
    const { proposalId } = proposeThree()
    const [budget, lieu, com] = itemIds(proposalId)
    plan.decide({ proposalId, accept: [budget ?? '', com ?? ''], reject: [lieu ?? ''] })
    const steps = repository.children(genesis)
    expect(steps.map((step) => [step.rank, step.title, step.waitsFor])).toEqual([
      [1, 'Valider le budget', []],
      [2, 'Lancer la com', []]
    ])
    expect(repository.pendingProposals(genesis)).toEqual([])
  })

  it('should_keep_the_proposal_pending_while_some_ghosts_are_undecided', () => {
    const { proposalId } = proposeThree()
    const [budget] = itemIds(proposalId)
    plan.decide({ proposalId, accept: [budget ?? ''], reject: [] })
    expect(repository.pendingProposals(genesis)[0]?.items.filter((item) => item.status === 'en_attente')).toHaveLength(
      2
    )
  })

  it('should_not_propose_again_a_title_mentalyas_refused_for_the_same_parent', () => {
    const { proposalId } = proposeThree()
    plan.decide({ proposalId, accept: [], reject: itemIds(proposalId) })
    const again = plan.propose({
      parentId: genesis,
      steps: [
        { key: 'a', title: 'valider le BUDGET !', why: 'x' },
        { key: 'b', title: 'Trouver un associé', why: 'y' }
      ]
    })
    expect(repository.proposal(again.proposalId)?.items.map((item) => item.title)).toEqual(['Trouver un associé'])
    expect(() =>
      plan.propose({ parentId: genesis, steps: [{ key: 'a', title: 'Choisir le lieu', why: 'x' }] })
    ).toThrow(expect.objectContaining({ code: 'VALIDATION' }))
  })

  it('should_replace_the_pending_proposal_of_the_same_parent', () => {
    const first = proposeThree()
    const second = plan.propose({ parentId: genesis, steps: [{ key: 'a', title: 'Autre chose', why: 'x' }] })
    expect(repository.pendingProposals(genesis).map((proposal) => proposal.id)).toEqual([second.proposalId])
    expect(() => plan.decide({ proposalId: first.proposalId, accept: itemIds(first.proposalId), reject: [] })).toThrow(
      expect.objectContaining({ code: 'INVALID_STATE' })
    )
  })

  it.each([
    [
      'a cycle',
      [
        { key: 'a', title: 'A', why: 'x', waitsFor: ['b'] },
        { key: 'b', title: 'B', why: 'x', waitsFor: ['a'] }
      ]
    ],
    [
      'a step before what it waits for',
      [
        { key: 'a', title: 'A', why: 'x', waitsFor: ['b'] },
        { key: 'b', title: 'B', why: 'x' }
      ]
    ],
    ['an unknown dependency', [{ key: 'a', title: 'A', why: 'x', waitsFor: ['ailleurs'] }]],
    [
      'a duplicated key',
      [
        { key: 'a', title: 'A', why: 'x' },
        { key: 'a', title: 'B', why: 'x' }
      ]
    ]
  ])('should_refuse_a_proposal_with_%s', (_name, steps) => {
    expect(() => plan.propose({ parentId: genesis, steps })).toThrow(expect.objectContaining({ code: 'VALIDATION' }))
  })

  it('should_refuse_more_than_twelve_steps_or_more_than_four_levels', () => {
    const many = Array.from({ length: 13 }, (_, n) => ({ key: `k${n}`, title: `Étape ${n}`, why: 'x' }))
    expect(() => plan.propose({ parentId: genesis, steps: many })).toThrow(
      expect.objectContaining({ code: 'VALIDATION' })
    )
    let parent = genesis
    for (let level = 1; level <= 4; level++) {
      const { proposalId } = plan.propose({
        parentId: parent,
        steps: [{ key: 'k', title: `Niveau ${level}`, why: 'x' }]
      })
      plan.decide({ proposalId, accept: itemIds(proposalId), reject: [] })
      parent = repository.children(parent)[0]?.id ?? ''
    }
    expect(() => plan.propose({ parentId: parent, steps: [{ key: 'k', title: 'Trop bas', why: 'x' }] })).toThrow(
      expect.objectContaining({ code: 'VALIDATION' })
    )
  })

  it('should_place_new_steps_after_the_existing_siblings_and_allow_waiting_for_them', () => {
    const first = proposeThree()
    plan.decide({ proposalId: first.proposalId, accept: itemIds(first.proposalId), reject: [] })
    const lieu = repository.children(genesis)[1]?.id ?? ''
    const next = plan.propose({
      parentId: genesis,
      steps: [{ key: 'deco', title: 'Décorer', why: 'x', waitsFor: [lieu] }]
    })
    plan.decide({ proposalId: next.proposalId, accept: itemIds(next.proposalId), reject: [] })
    const deco = repository.children(genesis)[3]
    expect([deco?.rank, deco?.title, deco?.waitsFor]).toEqual([4, 'Décorer', [lieu]])
  })

  it('should_remove_a_step_with_its_descendants_renumber_its_siblings_and_restore_everything_by_undo', () => {
    const first = proposeThree()
    plan.decide({ proposalId: first.proposalId, accept: itemIds(first.proposalId), reject: [] })
    const [budget, lieu, com] = repository.children(genesis)
    const sub = plan.propose({ parentId: lieu?.id ?? '', steps: [{ key: 's', title: 'Visiter', why: 'x' }] })
    plan.decide({ proposalId: sub.proposalId, accept: itemIds(sub.proposalId), reject: [] })

    const { batchId } = plan.remove(lieu?.id ?? '')
    expect(history.list().items[0]?.summary).toBe('Suppression de l’étape « Choisir le lieu »')
    expect(repository.children(genesis).map((step) => [step.rank, step.id, step.waitsFor])).toEqual([
      [1, budget?.id, []],
      [2, com?.id, []]
    ])
    expect(repository.children(lieu?.id ?? '')).toEqual([])

    history.undo(batchId)
    expect(history.list().items[0]?.summary).toBe('Étape restaurée : « Choisir le lieu »')
    expect(repository.children(genesis).map((step) => [step.rank, step.title])).toEqual([
      [1, 'Valider le budget'],
      [2, 'Choisir le lieu'],
      [3, 'Lancer la com']
    ])
    expect(repository.children(genesis)[2]?.waitsFor).toEqual([lieu?.id])
    expect(repository.children(lieu?.id ?? '').map((step) => step.title)).toEqual(['Visiter'])
  })

  it('should_refuse_to_undo_the_lock_alone_while_children_born_later_depend_on_it', () => {
    const first = proposeThree()
    const { batchId } = plan.decide({ proposalId: first.proposalId, accept: itemIds(first.proposalId), reject: [] })
    const later = plan.propose({ parentId: genesis, steps: [{ key: 'x', title: 'Plus tard', why: 'x' }] })
    plan.decide({ proposalId: later.proposalId, accept: itemIds(later.proposalId), reject: [] })
    // Le lot initial verrouillait le genesis ; « Plus tard » est né ensuite, hors de ce lot.
    expect(() => history.undo(batchId ?? '')).toThrow(expect.objectContaining({ code: 'UNDO_CONFLICT' }))
  })
})
