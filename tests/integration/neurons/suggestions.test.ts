import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createNeuronHarness, etendreReply, type NeuronHarness } from '../../support/neurons'

interface Suggested {
  neuronRef: string
  title: string
  content: string
  webQuery?: string
}

const withSuggestions = (questions: string[], suggestions: Suggested[]) =>
  etendreReply(questions, 'insufficient', { suggestions })

describe('suggestions d’approfondissement (neurones fantômes)', () => {
  let t: NeuronHarness
  beforeEach(() => {
    t = createNeuronHarness()
  })
  afterEach(() => t.dispose())

  const QUESTIONS = ['Pour quand ?', 'Quel budget ?', 'Quel modèle ?', 'Quel usage ?', 'Où le poser ?']
  const ANSWERS = ['Avant Noël', 'Un petit budget', 'Un 27 pouces']

  /**
   * Idée développée puis trois réponses données : le minimum avant que l'IA propose des idées. Les suggestions
   * arrivent avec la troisième réponse ; il reste deux questions ouvertes ; les réponses sont [s1] à [s3].
   */
  async function developedWith(suggestions: Suggested[]) {
    const root = await t.neurons.create({ text: 'Acheter un 2e écran', nature: 'action' })
    t.h.claude.enqueue(etendreReply(QUESTIONS))
    let tree = (await t.growth.develop(root.id)).tree
    for (const [index, text] of ANSWERS.entries()) {
      t.h.claude.enqueue(index === ANSWERS.length - 1 ? withSuggestions([], suggestions) : etendreReply([]))
      tree = (await t.growth.answer({ extensionId: tree.extensions[0]?.id ?? '', answer: { text } })).tree
    }
    return tree
  }

  it('should_propose_no_idea_before_three_answers_even_when_the_ai_suggests_some', async () => {
    const root = await t.neurons.create({ text: 'Acheter un 2e écran', nature: 'action' })
    const premature = [{ neuronRef: 's0', title: 'Écran 27 pouces IPS', content: 'Trop tôt pour le savoir.' }]
    t.h.claude.enqueue(withSuggestions(QUESTIONS, premature))
    let tree = (await t.growth.develop(root.id)).tree
    expect(tree.suggestions).toEqual([])
    expect(t.h.anonymized.at(-1)).toContain('Ne propose AUCUNE suggestion')

    for (const text of ANSWERS.slice(0, 2)) {
      t.h.claude.enqueue(withSuggestions([], premature))
      tree = (await t.growth.answer({ extensionId: tree.extensions[0]?.id ?? '', answer: { text } })).tree
      expect(tree.suggestions).toEqual([])
      expect(t.h.anonymized.at(-1)).toContain('Ne propose AUCUNE suggestion')
    }

    // Troisième réponse : le contexte suffit, l'IA est invitée à proposer et ses idées sont retenues.
    t.h.claude.enqueue(withSuggestions([], premature))
    tree = (await t.growth.answer({ extensionId: tree.extensions[0]?.id ?? '', answer: { text: ANSWERS[2] ?? '' } }))
      .tree
    expect(tree.suggestions.map((entry) => entry.title)).toEqual(['Écran 27 pouces IPS'])
    expect(t.h.anonymized.at(-1)).toContain('a maintenant assez répondu : propose 1 à 2 suggestions')
  })

  it('should_attach_ghosts_to_existing_neurons_and_drop_unknown_or_duplicate_ones', async () => {
    const tree = await developedWith([
      { neuronRef: 's0', title: 'Écran 27 pouces IPS', content: 'Bon compromis pour la retouche photo.' },
      { neuronRef: 's9', title: 'Neurone inconnu', content: 'Rattachée à rien.' }
    ])
    expect(tree.suggestions).toEqual([
      expect.objectContaining({ neuronId: tree.root.id, title: 'Écran 27 pouces IPS', research: 'none', sources: [] })
    ])

    const extension = tree.extensions[0]
    t.h.claude.enqueue(
      withSuggestions([], [{ neuronRef: 's0', title: 'écran 27 POUCES ips !', content: 'Doublon reformulé.' }])
    )
    const next = await t.growth.answer({ extensionId: extension?.id ?? '', answer: { text: 'Avant Noël' } })
    expect(next.tree.suggestions).toHaveLength(1)
    expect(t.h.anonymized.at(-1)).toMatch(/Suggestions déjà faites[^]*Écran 27 pouces IPS/)
  })

  it('should_verify_a_flagged_suggestion_on_the_web_only_when_asked_then_show_its_sources', async () => {
    t.h.claude.enqueueResearch({
      text: 'Compte 220 à 300 € pour un 27 pouces IPS.',
      sources: [{ url: 'https://exemple.be/ecrans', title: 'Comparatif écrans' }]
    })
    const tree = await developedWith([
      { neuronRef: 's0', title: 'Écran 27 pouces IPS', content: 'Prix à vérifier.', webQuery: 'prix écran 27 IPS' },
      { neuronRef: 's0', title: 'Bras articulé', content: 'Libère le bureau.', webQuery: 'prix bras écran' }
    ])
    // Plus de vérification automatique (T069) : vérifiable, à la demande.
    expect(tree.suggestions.map((entry) => entry.research)).toEqual(['available', 'none'])
    await t.growth.settled()
    expect(t.h.claude.researchRequests).toHaveLength(0)

    const started = t.growth.researchSuggestion(tree.suggestions[0]?.id ?? '')
    expect(started.tree.suggestions[0]?.research).toBe('pending')
    await t.growth.settled()
    const [verified, plain] = t.growth.tree(tree.root.id).suggestions
    expect(verified).toMatchObject({
      research: 'done',
      content: 'Compte 220 à 300 € pour un 27 pouces IPS.',
      sources: [{ url: 'https://exemple.be/ecrans', title: 'Comparatif écrans' }]
    })
    expect(plain?.research).toBe('none')
    expect(t.h.claude.researchRequests).toHaveLength(1)
    expect(t.h.claude.researchRequests[0]?.maxSearches).toBe(2)
    expect(t.events).toContainEqual({ type: 'suggestion:updated', rootId: tree.root.id, suggestionId: verified?.id })
  })

  it('should_mark_research_failed_and_keep_the_suggestion_when_web_search_is_unavailable', async () => {
    const tree = await developedWith([
      { neuronRef: 's0', title: 'Écran 27 pouces IPS', content: 'Prix à vérifier.', webQuery: 'prix écran 27 IPS' }
    ])
    t.growth.researchSuggestion(tree.suggestions[0]?.id ?? '')
    await t.growth.settled() // aucune recherche scriptée : le faux moteur échoue
    expect(t.growth.tree(tree.root.id).suggestions[0]).toMatchObject({
      research: 'failed',
      content: 'Prix à vérifier.'
    })
  })

  it('should_turn_an_accepted_suggestion_into_an_idea_sub_neuron_and_keep_growing', async () => {
    const tree = await developedWith([{ neuronRef: 's0', title: 'Écran 27 pouces IPS', content: 'Environ 250 €.' }])
    const suggestion = tree.suggestions[0]
    t.h.claude.enqueue(etendreReply(['Quelle connectique ?', 'Quel pied ?']))
    const calls = t.h.claude.requests.length
    const result = await t.growth.acceptSuggestion(suggestion?.id ?? '')
    const neuron = result.tree.neurons.find((entry) => entry.title === 'Écran 27 pouces IPS')
    expect(neuron).toMatchObject({
      kind: 'idea',
      origin: 'ai',
      parentId: tree.root.id,
      content: 'Environ 250 €.',
      sources: []
    })
    expect(result.tree.suggestions).toEqual([])
    expect(t.h.claude.requests.length).toBe(calls + 1)
    expect(result.tree.extensions.some((entry) => entry.neuronId === neuron?.id)).toBe(true)
    await expect(t.growth.acceptSuggestion(suggestion?.id ?? '')).rejects.toMatchObject({ code: 'INVALID_STATE' })
  })

  it('should_develop_an_adopted_idea_from_its_text_right_away_retrying_when_the_ai_asks_too_little', async () => {
    const tree = await developedWith([{ neuronRef: 's0', title: 'Écran 27 pouces IPS', content: 'Environ 250 €.' }])
    t.h.claude.enqueue(etendreReply([]), etendreReply(['Quelle connectique ?', 'Quel pied ?']))
    const result = await t.growth.acceptSuggestion(tree.suggestions[0]?.id ?? '')
    const idea = result.tree.neurons.find((entry) => entry.title === 'Écran 27 pouces IPS')
    const questions = result.tree.extensions.filter((entry) => entry.neuronId === idea?.id)
    expect(questions.map((entry) => entry.question)).toEqual(['Quelle connectique ?', 'Quel pied ?'])
    const input = t.h.anonymized.at(-1) ?? ''
    expect(input).toContain('vient d’adopter l’idée suggérée')
    expect(input).toContain('Environ 250 €.')
  })

  it('should_count_values_of_an_accepted_suggestion_as_validated_by_the_user', async () => {
    const tree = await developedWith([{ neuronRef: 's0', title: 'Écran 27 pouces IPS', content: 'Environ 250 €.' }])
    t.h.claude.enqueue(etendreReply([], 'insufficient'))
    await t.growth.acceptSuggestion(tree.suggestions[0]?.id ?? '')
    t.h.claude.enqueue({
      raw: {
        nodes: [{ ref: 't1', type: 'task', title: 'Commander l’écran', amountCents: 25_000, sourceRefs: ['s4'] }],
        dependencies: [],
        gaps: []
      }
    })
    const proposal = await t.fusion.lock({ rootId: tree.root.id, force: true })
    if (proposal.type !== 'action_plan') throw new Error('plan attendu')
    expect(proposal.plan.nodes[0]?.amountCents).toBe(25_000)
  })

  it('should_dismiss_a_suggestion_without_touching_the_tree', async () => {
    const tree = await developedWith([{ neuronRef: 's0', title: 'Bras articulé', content: 'Libère le bureau.' }])
    const result = t.growth.dismissSuggestion(tree.suggestions[0]?.id ?? '')
    expect(result.tree.suggestions).toEqual([])
    expect(result.tree.root.version).toBe(tree.root.version)
    expect(() => t.growth.dismissSuggestion(tree.suggestions[0]?.id ?? '')).toThrow(
      expect.objectContaining({ code: 'INVALID_STATE' })
    )
  })

  it('should_delete_ghosts_with_the_branch_they_are_attached_to', async () => {
    const tree = await developedWith([])
    t.h.claude.enqueue(withSuggestions([], [{ neuronRef: 's4', title: 'Piste occasion', content: 'Seconde main.' }]))
    const answered = await t.growth.answer({
      extensionId: tree.extensions[0]?.id ?? '',
      answer: { text: 'Budget serré' }
    })
    const branch = answered.tree.neurons.find((entry) => entry.title.includes('Budget serré'))
    expect(branch).toBeDefined()
    expect(answered.tree.suggestions[0]?.neuronId).toBe(branch?.id)
    const after = t.growth.deleteBranch(branch?.id ?? '')
    expect(after.tree.suggestions).toEqual([])
  })
})
