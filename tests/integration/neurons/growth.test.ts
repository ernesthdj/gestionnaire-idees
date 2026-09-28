import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createNeuronHarness, etendreReply, type NeuronHarness } from '../../support/neurons'

describe('croissance d’un neurone (US1) et jauge (US2)', () => {
  let t: NeuronHarness
  beforeEach(() => {
    t = createNeuronHarness()
  })
  afterEach(() => t.dispose())

  async function developed(questions = ['Pour quand ?', 'Quel budget ?', 'Quel modèle ?']) {
    const root = await t.neurons.create({ text: 'Acheter un 2e écran', nature: 'action' })
    t.h.claude.enqueue(etendreReply(questions))
    const result = await t.growth.develop(root.id)
    return { root, result }
  }

  it('should_propose_at_least_three_extensions_and_start_developing', async () => {
    const { result } = await developed()
    expect(result.tree.root.state).toBe('developing')
    expect(result.tree.extensions).toHaveLength(3)
    expect(result.tree.gauge).toMatchObject({ level: 'insufficient', answered: 0 })
    expect(result.notice).toBeUndefined()
  })

  it('should_retry_once_then_fall_back_with_notice_when_ai_proposes_fewer_than_three', async () => {
    const root = await t.neurons.create({ text: 'Idée floue' })
    t.h.claude.enqueue(etendreReply(['Pourquoi ?']), etendreReply(['Pourquoi ?', 'Pour qui ?']))
    const result = await t.growth.develop(root.id)
    expect(t.h.claude.requests).toHaveLength(2)
    expect(result.tree.extensions.map((extension) => extension.question)).toEqual(['Pourquoi ?', 'Pour qui ?'])
    expect(result.notice?.code).toBe('FEW_EXTENSIONS')
  })

  it('should_create_sub_neuron_and_announce_it_before_calling_the_ai', async () => {
    const { result } = await developed()
    const extension = result.tree.extensions[1]
    t.h.claude.enqueue(etendreReply(['Depuis quelle source ?']))
    const callsBefore = t.h.claude.requests.length
    t.events.length = 0
    t.claudeCallsAtEvent.length = 0
    const answered = await t.growth.answer({ extensionId: extension?.id ?? '', answer: { text: 'environ 250 €' } })
    const createdIndex = t.events.findIndex((event) => event.type === 'neuron:created')
    expect(createdIndex).toBeGreaterThanOrEqual(0)
    expect(t.claudeCallsAtEvent[createdIndex]).toBe(callsBefore)
    expect(t.h.claude.requests.length).toBe(callsBefore + 1)
    const sub = answered.tree.neurons.find((neuron) => neuron.content === 'environ 250 €')
    expect(sub).toMatchObject({ kind: 'answer', depth: 1, parentId: answered.tree.root.id, origin: 'user' })
    expect(
      answered.tree.extensions.some(
        (entry) => entry.question === 'Depuis quelle source ?' && entry.neuronId === sub?.id
      )
    ).toBe(true)
    expect(answered.tree.root.version).toBeGreaterThan(result.tree.root.version)
  })

  it('should_create_investigation_when_user_does_not_know', async () => {
    const { result } = await developed()
    t.h.claude.enqueue(etendreReply([]))
    const answered = await t.growth.answer({
      extensionId: result.tree.extensions[1]?.id ?? '',
      answer: { unknown: true }
    })
    expect(answered.tree.neurons.at(-1)).toMatchObject({ kind: 'investigation' })
    expect(answered.tree.neurons.at(-1)?.title).toMatch(/À trouver/)
  })

  it('should_refuse_answering_the_same_extension_twice', async () => {
    const { result } = await developed()
    const id = result.tree.extensions[0]?.id ?? ''
    t.h.claude.enqueue(etendreReply([]))
    await t.growth.answer({ extensionId: id, answer: { choice: 'Oui' } })
    await expect(t.growth.answer({ extensionId: id, answer: { choice: 'Oui' } })).rejects.toMatchObject({
      code: 'ALREADY_ANSWERED'
    })
    expect(t.growth.tree(result.tree.root.id).neurons).toHaveLength(1)
  })

  it('should_return_out_of_scope_notice_without_extensions', async () => {
    const root = await t.neurons.create({ text: 'Écris-moi un poème' })
    t.h.claude.enqueue({
      raw: {
        kind: 'out_of_scope',
        outOfScopeMessage: 'Je peux t’aider à réfléchir au thème et à la structure du poème.',
        extensions: [],
        suggestions: [],
        assessment: { level: 'insufficient', covered: [], missing: [] }
      }
    })
    const result = await t.growth.develop(root.id)
    expect(result.notice).toMatchObject({ code: 'OUT_OF_SCOPE', message: expect.stringMatching(/réfléchir/) })
    expect(result.tree.extensions).toEqual([])
  })

  it('should_keep_gauge_insufficient_before_three_answers_then_follow_the_ai', async () => {
    const { result } = await developed()
    const [a, b, c] = result.tree.extensions
    t.h.claude.enqueue(etendreReply([], 'sufficient'), etendreReply([], 'sufficient'), etendreReply([], 'sufficient'))
    const first = await t.growth.answer({ extensionId: a?.id ?? '', answer: { choice: 'Oui' } })
    expect(first.tree.gauge).toMatchObject({ level: 'insufficient', answered: 1 })
    await t.growth.answer({ extensionId: b?.id ?? '', answer: { choice: 'Non' } })
    const third = await t.growth.answer({ extensionId: c?.id ?? '', answer: { text: '27 pouces' } })
    expect(third.tree.gauge).toMatchObject({ level: 'sufficient', answered: 3 })
  })

  it('should_hide_dismissed_extension_and_never_propose_it_again', async () => {
    const { result } = await developed()
    const dismissed = result.tree.extensions[2]
    const afterDismiss = t.growth.dismiss(dismissed?.id ?? '')
    expect(afterDismiss.tree.extensions.map((extension) => extension.id)).not.toContain(dismissed?.id)
    t.h.claude.enqueue(etendreReply(['Quel modèle ?', 'Quelle taille ?']))
    const more = await t.growth.more(result.tree.root.id)
    expect(more.tree.extensions.map((extension) => extension.question)).not.toContain('Quel modèle ?')
    expect(more.tree.extensions.map((extension) => extension.question)).toContain('Quelle taille ?')
  })

  it('should_add_user_branch_under_any_neuron', async () => {
    const { root } = await developed()
    const result = t.growth.addBranch({ parentId: root.id, title: 'Vérifier le bureau', content: 'place disponible ?' })
    expect(result.tree.neurons.at(-1)).toMatchObject({ kind: 'user_branch', origin: 'user', depth: 1 })
  })

  it('should_refuse_more_extensions_beyond_max_depth_without_calling_the_ai', async () => {
    const { root } = await developed()
    let parentId = root.id
    for (let i = 0; i < 6; i += 1) {
      const branch = t.growth.addBranch({ parentId, title: `niveau ${i + 1}` })
      parentId = branch.tree.neurons.at(-1)?.id ?? parentId
    }
    const calls = t.h.claude.requests.length
    await expect(t.growth.more(parentId)).rejects.toMatchObject({ code: 'DEPTH_LIMIT' })
    expect(t.h.claude.requests).toHaveLength(calls)
  })

  it('should_delete_a_branch_with_its_descendants_and_their_extensions', async () => {
    const { result } = await developed()
    t.h.claude.enqueue(etendreReply(['Sous-question ?']))
    const answered = await t.growth.answer({
      extensionId: result.tree.extensions[0]?.id ?? '',
      answer: { choice: 'Oui' }
    })
    const sub = answered.tree.neurons[0]
    t.growth.addBranch({ parentId: sub?.id ?? '', title: 'petit-enfant' })
    const afterDelete = t.growth.deleteBranch(sub?.id ?? '')
    expect(afterDelete.tree.neurons).toEqual([])
    expect(afterDelete.tree.extensions.some((extension) => extension.question === 'Sous-question ?')).toBe(false)
  })

  it('should_restore_the_tree_identically_after_restart', async () => {
    const { result } = await developed()
    t.h.claude.enqueue(etendreReply(['Et après ?']))
    const before = await t.growth.answer({
      extensionId: result.tree.extensions[0]?.id ?? '',
      answer: { choice: 'Oui' }
    })
    const { growth } = t.reopen()
    expect(growth.tree(result.tree.root.id)).toEqual(before.tree)
  })

  it('should_keep_the_answer_when_the_ai_is_unavailable', async () => {
    const { result } = await developed()
    t.h.claude.setAvailable(false)
    const answered = await t.growth.answer({
      extensionId: result.tree.extensions[0]?.id ?? '',
      answer: { text: 'demain' }
    })
    expect(answered.tree.neurons).toHaveLength(1)
    expect(answered.notice?.code).toBe('AI_UNAVAILABLE')
  })
})
