import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readyRoot, reflectionSummary, screenPlan } from '../../support/fusion'
import { createNeuronHarness, etendreReply, type NeuronHarness } from '../../support/neurons'

describe('verrouillage, synthèse et éclosion (US3)', () => {
  let t: NeuronHarness
  beforeEach(() => {
    t = createNeuronHarness()
  })
  afterEach(() => t.dispose())

  it('should_refuse_lock_with_missing_dimensions_when_context_is_insufficient', async () => {
    const root = await t.neurons.create({ text: 'Idée floue', nature: 'action' })
    t.h.claude.enqueue(etendreReply(['Pourquoi ?', 'Pour qui ?', 'Quand ?']))
    await t.growth.develop(root.id)
    const calls = t.h.claude.requests.length
    await expect(t.fusion.lock({ rootId: root.id })).rejects.toMatchObject({
      code: 'CONTEXT_INSUFFICIENT',
      details: { missing: ['budget'] }
    })
    expect(t.h.claude.requests.length).toBe(calls)
  })

  it('should_lock_anyway_when_forced_and_flag_the_proposal', async () => {
    const root = await t.neurons.create({ text: 'Idée floue', nature: 'action' })
    t.h.claude.enqueue(etendreReply(['Pourquoi ?', 'Pour qui ?', 'Quand ?']))
    await t.growth.develop(root.id)
    t.h.claude.enqueue({
      raw: { nodes: [{ ref: 't1', type: 'task', title: 'Clarifier', sourceRefs: ['s0'] }], dependencies: [], gaps: [] }
    })
    const proposal = await t.fusion.lock({ rootId: root.id, force: true })
    expect(proposal).toMatchObject({ status: 'proposed', forced: true, type: 'action_plan' })
    expect(t.h.anonymized.at(-1)).toMatch(/Verrouillage forcé/)
  })

  it('should_propose_action_plan_with_condition_branches_without_writing_anything', async () => {
    const tree = await readyRoot(t, 'action')
    t.h.claude.enqueue(screenPlan())
    const proposal = await t.fusion.lock({ rootId: tree.root.id })
    expect(proposal.type).toBe('action_plan')
    if (proposal.type !== 'action_plan') return
    const condition = proposal.plan.nodes.find((node) => node.type === 'condition')
    expect(condition?.title).toBe('J’ai l’argent ?')
    expect(proposal.plan.nodes.filter((node) => node.parentRef === 'c1').map((node) => node.branchLabel)).toEqual([
      'Oui',
      'Non'
    ])
    expect(proposal.sources['s0']).toBe(tree.root.id)
    expect(t.neurons.getTree(tree.root.id).root.state).toBe('developing')
    expect(t.fusionRepository.planOf(tree.root.id)).toHaveLength(0)
  })

  it('should_propose_structured_reflection_summary', async () => {
    const tree = await readyRoot(t, 'reflection', ['Pour le reportage', 'Poids du sac', 'Location possible'])
    t.h.claude.enqueue(reflectionSummary)
    const proposal = await t.fusion.lock({ rootId: tree.root.id })
    expect(proposal.type).toBe('reflection_summary')
    if (proposal.type !== 'reflection_summary') return
    expect(proposal.summary.openQuestions).toEqual([{ text: 'Revendre le 24-70 ?' }])
  })

  it('should_return_the_pending_proposal_without_new_call_on_second_lock', async () => {
    const tree = await readyRoot(t)
    t.h.claude.enqueue(screenPlan())
    const first = await t.fusion.lock({ rootId: tree.root.id })
    const calls = t.h.claude.requests.length
    const second = await t.fusion.lock({ rootId: tree.root.id })
    expect(second.id).toBe(first.id)
    expect(t.h.claude.requests.length).toBe(calls)
  })

  it('should_retry_once_with_the_defect_when_a_check_fails', async () => {
    const tree = await readyRoot(t)
    const invalid = {
      raw: { nodes: [{ ref: 't1', type: 'task', title: 'X', sourceRefs: ['s99'] }], dependencies: [], gaps: [] }
    }
    t.h.claude.enqueue(invalid, screenPlan())
    const calls = t.h.claude.requests.length
    const proposal = await t.fusion.lock({ rootId: tree.root.id })
    expect(t.h.claude.requests.length).toBe(calls + 2)
    expect(t.h.anonymized.at(-1)).toMatch(/refusée : Source inconnue : s99/)
    expect(proposal.status).toBe('proposed')
  })

  it('should_fail_with_cycle_detected_after_two_looping_plans', async () => {
    const tree = await readyRoot(t)
    const looping = {
      raw: {
        nodes: [
          { ref: 'a', type: 'task', title: 'A', sourceRefs: [] },
          { ref: 'b', type: 'task', title: 'B', sourceRefs: [] }
        ],
        dependencies: [
          { fromRef: 'a', toRef: 'b', kind: 'after_done' },
          { fromRef: 'b', toRef: 'a', kind: 'after_done' }
        ],
        gaps: []
      }
    }
    t.h.claude.enqueue(looping, looping)
    await expect(t.fusion.lock({ rootId: tree.root.id })).rejects.toMatchObject({ code: 'CYCLE_DETECTED' })
    expect(t.fusionRepository.proposedFor(tree.root.id)).toBeUndefined()
  })

  it('should_replace_invented_amount_by_to_find_element', async () => {
    const tree = await readyRoot(t, 'action', ['Cette semaine', 'Oui', 'Un 27 pouces'])
    t.h.claude.enqueue(screenPlan({ amountCents: 39_900 }))
    const proposal = await t.fusion.lock({ rootId: tree.root.id })
    if (proposal.type !== 'action_plan') throw new Error('plan attendu')
    const order = proposal.plan.nodes.find((node) => node.ref === 't1')
    expect(order?.amountCents).toBeUndefined()
    expect(order?.investigation).toBe(true)
    expect(proposal.plan.gaps).toContain('Montant à trouver : Commander l’écran')
  })

  it('should_hatch_on_confirm_in_one_batch_and_learn_the_example', async () => {
    const tree = await readyRoot(t)
    t.h.claude.enqueue(screenPlan())
    const proposal = await t.fusion.lock({ rootId: tree.root.id })
    const version = t.neurons.getTree(tree.root.id).root.version
    const { batchId, root } = t.fusion.confirm(proposal.id)
    expect(root).toMatchObject({ state: 'hatched', version: version + 1 })
    const plan = t.fusionRepository.planOf(tree.root.id)
    expect(plan.map((node) => [node.title, node.status])).toEqual([
      ['J’ai l’argent ?', 'ready'],
      ['Commander l’écran', 'blocked'],
      ['Attendre la mission mariage', 'blocked'],
      ['Installer l’écran', 'blocked']
    ])
    expect(t.fusionRepository.synthesis(proposal.id)?.status).toBe('confirmed')
    const entities = t.fusionRepository.changesOf(batchId).map((change) => change.entity)
    expect(entities).toEqual(expect.arrayContaining(['plan_node', 'plan_dependency', 'neuron', 'synthesis']))
    expect(t.examples.count('synthetiser')).toBe(1)
  })

  it('should_store_neuron_ids_as_sources_of_a_confirmed_reflection', async () => {
    const tree = await readyRoot(t, 'reflection', ['Pour le reportage', 'Poids du sac', 'Location possible'])
    t.h.claude.enqueue(reflectionSummary)
    const proposal = await t.fusion.lock({ rootId: tree.root.id })
    t.fusion.confirm(proposal.id)
    const [stored] = t.fusionRepository.reflectionsOf(tree.root.id)
    const points = JSON.parse(stored?.keyPointsJson ?? '[]') as { sourceIds: string[] }[]
    expect(points[0]?.sourceIds).toEqual([proposal.sources['s1']])
  })

  it.each([['retireCurrentResults'], ['insertPlan'], ['setRootState'], ['decide'], ['log'], ['record']] as const)(
    'should_apply_nothing_when_%s_fails_during_confirm',
    async (step) => {
      const tree = await readyRoot(t)
      t.h.claude.enqueue(screenPlan())
      const proposal = await t.fusion.lock({ rootId: tree.root.id })
      const fail = (): never => {
        throw new Error('panne simulée')
      }
      if (step === 'record') vi.spyOn(t.examples, 'record').mockImplementationOnce(fail)
      else vi.spyOn(t.fusionRepository, step).mockImplementationOnce(fail)
      expect(() => t.fusion.confirm(proposal.id)).toThrow(expect.objectContaining({ code: 'APPLY_FAILED' }))
      expect(t.neurons.getTree(tree.root.id).root.state).toBe('developing')
      expect(t.fusionRepository.planOf(tree.root.id)).toHaveLength(0)
      expect(t.fusionRepository.synthesis(proposal.id)?.status).toBe('proposed')
      expect(t.examples.count('synthetiser')).toBe(0)
    }
  )

  it('should_mark_proposal_stale_when_tree_changes_before_confirm', async () => {
    const tree = await readyRoot(t)
    t.h.claude.enqueue(screenPlan())
    const proposal = await t.fusion.lock({ rootId: tree.root.id })
    t.growth.addBranch({ parentId: tree.root.id, title: 'Vérifier le bureau' })
    t.events.length = 0
    expect(() => t.fusion.confirm(proposal.id)).toThrow(expect.objectContaining({ code: 'STALE' }))
    expect(t.fusionRepository.synthesis(proposal.id)?.status).toBe('stale')
    expect(t.events).toContainEqual({ type: 'synthesis:stale', rootId: tree.root.id, synthesisId: proposal.id })
    expect(t.neurons.getTree(tree.root.id).root.state).toBe('developing')
  })

  it('should_supersede_the_proposal_on_revise', async () => {
    const tree = await readyRoot(t)
    t.h.claude.enqueue(screenPlan(), screenPlan())
    const first = await t.fusion.lock({ rootId: tree.root.id })
    const revised = await t.fusion.revise({ synthesisId: first.id, instruction: 'Ajoute la comparaison des prix' })
    expect(revised.id).not.toBe(first.id)
    expect(revised.instruction).toBe('Ajoute la comparaison des prix')
    expect(t.fusionRepository.synthesis(first.id)?.status).toBe('superseded')
    expect(t.h.anonymized.at(-1)).toMatch(/Correction demandée par l'utilisateur : Ajoute la comparaison des prix/)
  })

  it('should_reject_a_proposal_and_allow_a_new_lock', async () => {
    const tree = await readyRoot(t)
    t.h.claude.enqueue(screenPlan(), screenPlan())
    const first = await t.fusion.lock({ rootId: tree.root.id })
    expect(t.fusion.reject({ synthesisId: first.id, reason: 'Pas le bon angle' })).toEqual({ ok: true })
    expect(t.fusionRepository.synthesis(first.id)?.status).toBe('rejected')
    const second = await t.fusion.lock({ rootId: tree.root.id })
    expect(second.id).not.toBe(first.id)
    expect(() => t.fusion.confirm(first.id)).toThrow(expect.objectContaining({ code: 'INVALID_STATE' }))
  })

  it('should_deepen_a_hatched_neuron_keeping_its_plan_as_current_document', async () => {
    const tree = await readyRoot(t)
    t.h.claude.enqueue(screenPlan())
    const proposal = await t.fusion.lock({ rootId: tree.root.id })
    t.fusion.confirm(proposal.id)
    const reopened = t.fusion.reopen(tree.root.id)
    expect(reopened.root.state).toBe('developing')
    const plan = t.fusionRepository.planOf(tree.root.id)
    expect(plan).toHaveLength(4)
    expect(plan.every((node) => node.isCurrent)).toBe(true)
    expect(t.fusionRepository.synthesis(proposal.id)?.status).toBe('confirmed')
    expect(() => t.fusion.reopen(tree.root.id)).toThrow(expect.objectContaining({ code: 'NOT_HATCHED' }))
  })

  it('should_absorb_the_sub_neurons_into_the_document_when_hatching', async () => {
    const tree = await readyRoot(t)
    const before = t.growthRepository.nodes(tree.root.id).length
    t.h.claude.enqueue(screenPlan())
    t.fusion.confirm((await t.fusion.lock({ rootId: tree.root.id })).id)
    const after = t.neurons.getTree(tree.root.id)
    expect(after.neurons).toHaveLength(0)
    expect(after.extensions).toHaveLength(0)
    expect(t.growthRepository.nodes(tree.root.id).map((node) => node.id)).toEqual([tree.root.id])
    expect(t.growthRepository.nodesWithHistory(tree.root.id)).toHaveLength(before)
  })

  it('should_carry_the_open_questions_of_the_document_without_calling_the_ai_when_deepened', async () => {
    const tree = await readyRoot(t, 'reflection', ['Pour le reportage', 'Poids du sac', 'Location possible'])
    t.h.claude.enqueue(reflectionSummary)
    t.fusion.confirm((await t.fusion.lock({ rootId: tree.root.id })).id)
    t.fusion.reopen(tree.root.id)
    t.h.claude.enqueue(
      etendreReply(['Question inventée ?'], 'sufficient', {
        suggestions: [{ neuronRef: 's0', title: 'Louer un 35 mm un week-end', content: 'Tester avant d’acheter.' }]
      })
    )
    const developed = (await t.growth.develop(tree.root.id)).tree
    // Les questions reprises sont là tout de suite, sans attendre l'IA.
    expect(developed.extensions.map((extension) => extension.question)).toEqual(['Revendre le 24-70 ?'])
    expect(developed.extensions[0]?.dimension).toBe('Revendre le 24-70')
    // En arrière-plan, l'IA n'apporte que des idées suggérées : aucune question en plus.
    await t.growth.settled()
    const after = t.neurons.getTree(tree.root.id)
    expect(after.extensions.map((extension) => extension.question)).toEqual(['Revendre le 24-70 ?'])
    expect(after.suggestions.map((suggestion) => suggestion.title)).toEqual(['Louer un 35 mm un week-end'])
    expect(t.h.anonymized.at(-1)).toContain('ne propose AUCUNE question')
  })

  it('should_ask_new_questions_from_the_document_when_it_leaves_nothing_open', async () => {
    const tree = await readyRoot(t)
    t.h.claude.enqueue(screenPlan())
    t.fusion.confirm((await t.fusion.lock({ rootId: tree.root.id })).id)
    t.fusion.reopen(tree.root.id)
    t.h.claude.enqueue(etendreReply(['Quelle marque ?', 'Où l’acheter ?', 'Quel pied ?']))
    const developed = (await t.growth.develop(tree.root.id)).tree
    expect(developed.extensions.map((extension) => extension.question)).toEqual([
      'Quelle marque ?',
      'Où l’acheter ?',
      'Quel pied ?'
    ])
    const input = t.h.anonymized.at(-1) ?? ''
    expect(input).toContain("Document de l'idée (cycles précédents")
    expect(input).toMatch(/Nouveau cycle/)
  })

  it('should_synthesize_the_next_cycle_from_the_whole_history', async () => {
    const tree = await readyRoot(t)
    t.h.claude.enqueue(screenPlan())
    t.fusion.confirm((await t.fusion.lock({ rootId: tree.root.id })).id)
    const firstCycle = t.growthRepository.nodesWithHistory(tree.root.id).map((node) => node.title)
    t.fusion.reopen(tree.root.id)
    t.h.claude.enqueue(etendreReply(['Quelle marque ?', 'Où l’acheter ?', 'Quel pied ?']))
    await t.growth.develop(tree.root.id)
    t.h.claude.enqueue(screenPlan())
    await t.fusion.lock({ rootId: tree.root.id, force: true })
    const request = t.h.anonymized.at(-1) ?? ''
    for (const title of firstCycle) expect(request).toContain(title)
  })

  it('should_refuse_locking_a_hatched_neuron', async () => {
    const tree = await readyRoot(t)
    t.h.claude.enqueue(screenPlan())
    t.fusion.confirm((await t.fusion.lock({ rootId: tree.root.id })).id)
    await expect(t.fusion.lock({ rootId: tree.root.id })).rejects.toMatchObject({ code: 'INVALID_STATE' })
  })
})
