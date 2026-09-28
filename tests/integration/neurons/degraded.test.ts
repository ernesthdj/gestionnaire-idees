import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createNeuronHarness, etendreReply, type NeuronHarness } from '../../support/neurons'

/** Mode dégradé (spec 002 T029) : Claude absent → l'idée reste utilisable, rien n'est perdu ni inventé. */
describe('mode dégradé du moteur de neurones', () => {
  let t: NeuronHarness
  beforeEach(() => {
    t = createNeuronHarness()
  })
  afterEach(() => t.dispose())

  async function developed() {
    const root = await t.neurons.create({ text: 'Acheter un 2e écran', nature: 'action' })
    t.h.claude.enqueue(etendreReply(['Pour quand ?', 'Quel budget ?', 'Quel modèle ?']))
    return (await t.growth.develop(root.id)).tree
  }

  it('should_keep_answers_and_allow_manual_branches_when_no_ai_is_available', async () => {
    const tree = await developed()
    t.h.claude.setAvailable(false) // l'IA locale est déjà arrêtée dans ce banc d'essai
    const answered = await t.growth.answer({
      extensionId: tree.extensions[0]?.id ?? '',
      answer: { text: 'Avant Noël' }
    })
    expect(answered.notice?.code).toBe('AI_UNAVAILABLE')
    expect(answered.tree.neurons.map((neuron) => neuron.content)).toContain('Avant Noël')
    const branched = t.growth.addBranch({ parentId: tree.root.id, title: 'Vérifier la place sur le bureau' })
    expect(branched.tree.neurons.some((neuron) => neuron.kind === 'user_branch')).toBe(true)
  })

  it('should_refuse_lock_without_writing_anything_when_no_ai_is_available', async () => {
    const tree = await developed()
    t.h.claude.setAvailable(false)
    await expect(t.fusion.lock({ rootId: tree.root.id, force: true })).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' })
    expect(t.fusionRepository.proposedFor(tree.root.id)).toBeUndefined()
    expect(t.neurons.getTree(tree.root.id).root.state).toBe('developing')
  })

  it('should_flag_a_synthesis_produced_by_the_local_ai_as_degraded', async () => {
    const tree = await developed()
    t.h.claude.setAvailable(false)
    t.h.ollama.setAvailable(true)
    t.h.ollama.enqueue({
      raw: {
        nodes: [{ ref: 't1', type: 'task', title: 'Comparer les écrans', sourceRefs: ['s0'] }],
        dependencies: [],
        gaps: []
      }
    })
    const proposal = await t.fusion.lock({ rootId: tree.root.id, force: true })
    expect(proposal).toMatchObject({ status: 'proposed', degraded: true, forced: true })
  })

  it('should_ignore_an_out_of_scope_verdict_from_the_local_fallback_and_retry_for_questions', async () => {
    t.h.claude.setAvailable(false)
    t.h.ollama.setAvailable(true)
    // La création lance d'abord la catégorisation locale.
    t.h.ollama.enqueue({ raw: { categorySlug: 'it', nature: 'action' } })
    const root = await t.neurons.create({ text: 'Préparer un deuxième écran', nature: 'action' })
    await t.neurons.settled()
    t.h.ollama.enqueue(etendreReply([], 'insufficient', { kind: 'out_of_scope', outOfScopeMessage: 'Hors sujet.' }))
    t.h.ollama.enqueue(etendreReply(['Pour quel usage ?', 'Où l’installer ?', 'Quel budget ?']))
    const result = await t.growth.develop(root.id)
    expect(result.notice?.code).not.toBe('OUT_OF_SCOPE')
    expect(result.tree.extensions).toHaveLength(3)
  })
})
