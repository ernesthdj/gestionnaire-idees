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

  async function developedWith(suggestions: Suggested[]) {
    const root = await t.neurons.create({ text: 'Acheter un 2e écran', nature: 'action' })
    t.h.claude.enqueue(withSuggestions(['Pour quand ?', 'Quel budget ?', 'Quel modèle ?'], suggestions))
    return (await t.growth.develop(root.id)).tree
  }

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

  it('should_verify_only_the_first_flagged_suggestion_on_the_web_then_show_its_sources', async () => {
    t.h.claude.enqueueResearch({
      text: 'Compte 220 à 300 € pour un 27 pouces IPS.',
      sources: [{ url: 'https://exemple.be/ecrans', title: 'Comparatif écrans' }]
    })
    const tree = await developedWith([
      { neuronRef: 's0', title: 'Écran 27 pouces IPS', content: 'Prix à vérifier.', webQuery: 'prix écran 27 IPS' },
      { neuronRef: 's0', title: 'Bras articulé', content: 'Libère le bureau.', webQuery: 'prix bras écran' }
    ])
    expect(tree.suggestions.map((entry) => entry.research)).toEqual(['pending', 'none'])

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
    await t.growth.settled() // aucune recherche scriptée : le faux moteur échoue
    expect(t.growth.tree(tree.root.id).suggestions[0]).toMatchObject({
      research: 'failed',
      content: 'Prix à vérifier.'
    })
  })

  it('should_turn_an_accepted_suggestion_into_an_ai_sub_neuron_and_keep_growing', async () => {
    const tree = await developedWith([{ neuronRef: 's0', title: 'Écran 27 pouces IPS', content: 'Environ 250 €.' }])
    const suggestion = tree.suggestions[0]
    t.h.claude.enqueue(etendreReply(['Quelle connectique ?']))
    const calls = t.h.claude.requests.length
    const result = await t.growth.acceptSuggestion(suggestion?.id ?? '')
    const neuron = result.tree.neurons.find((entry) => entry.title === 'Écran 27 pouces IPS')
    expect(neuron).toMatchObject({ kind: 'answer', origin: 'ai', parentId: tree.root.id, content: 'Environ 250 €.' })
    expect(result.tree.suggestions).toEqual([])
    expect(t.h.claude.requests.length).toBe(calls + 1)
    expect(result.tree.extensions.some((entry) => entry.neuronId === neuron?.id)).toBe(true)
    await expect(t.growth.acceptSuggestion(suggestion?.id ?? '')).rejects.toMatchObject({ code: 'INVALID_STATE' })
  })

  it('should_count_values_of_an_accepted_suggestion_as_validated_by_the_user', async () => {
    const tree = await developedWith([{ neuronRef: 's0', title: 'Écran 27 pouces IPS', content: 'Environ 250 €.' }])
    t.h.claude.enqueue(etendreReply([], 'insufficient'))
    await t.growth.acceptSuggestion(tree.suggestions[0]?.id ?? '')
    t.h.claude.enqueue({
      raw: {
        nodes: [{ ref: 't1', type: 'task', title: 'Commander l’écran', amountCents: 25_000, sourceRefs: ['s1'] }],
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
    t.h.claude.enqueue(withSuggestions([], [{ neuronRef: 's1', title: 'Piste occasion', content: 'Seconde main.' }]))
    const answered = await t.growth.answer({
      extensionId: tree.extensions[0]?.id ?? '',
      answer: { text: 'Budget serré' }
    })
    const branch = answered.tree.neurons[0]
    expect(answered.tree.suggestions[0]?.neuronId).toBe(branch?.id)
    const after = t.growth.deleteBranch(branch?.id ?? '')
    expect(after.tree.suggestions).toEqual([])
  })
})
