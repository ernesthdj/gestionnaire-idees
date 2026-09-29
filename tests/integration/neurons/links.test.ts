import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

const linksReply = (links: { targetAlias: string; label: string; justification: string }[]) => ({ raw: { links } })

describe('liens entre idées écloses (US4)', () => {
  let t: NeuronHarness
  beforeEach(() => {
    t = createNeuronHarness()
  })
  afterEach(() => t.dispose())

  /** Verrouille (forcé) une idée avec un plan scripté ; l'éclosion reste à confirmer. */
  async function locked(text: string, planTitles: string[]) {
    const root = await t.neurons.create({ text, nature: 'action' })
    t.h.claude.enqueue({
      raw: {
        nodes: planTitles.map((title, index) => ({ ref: `t${index}`, type: 'task', title, sourceRefs: ['s0'] })),
        dependencies: [],
        gaps: []
      }
    })
    const proposal = await t.fusion.lock({ rootId: root.id, force: true })
    return { root, proposal }
  }

  async function hatched(text: string, planTitles: string[]) {
    const { root, proposal } = await locked(text, planTitles)
    t.fusion.confirm(proposal.id)
    await t.links.settled()
    return root
  }

  it('should_not_call_the_ai_when_no_hatched_idea_is_close', async () => {
    await hatched('Réserver un restaurant', ['Choisir la date du dîner'])
    const { proposal } = await locked('Acheter un 2e écran', ['Comparer les écrans 27 pouces'])
    const calls = t.h.claude.requests.length
    t.fusion.confirm(proposal.id)
    await t.links.settled()
    expect(t.h.claude.requests.length).toBe(calls)
    expect(t.links.list()).toEqual([])
  })

  it('should_suggest_a_labelled_link_sending_only_close_candidates', async () => {
    const wedding = await hatched('Mission photo mariage', ['Livrer les photos du mariage', 'Encaisser l’acompte'])
    await hatched('Réserver un restaurant', ['Choisir la date du dîner'])
    const { root: screen, proposal } = await locked('Acheter un écran pour la retouche photo', ['Commander l’écran'])
    t.h.claude.enqueue(
      linksReply([
        { targetAlias: 'N1', label: 'financement', justification: 'L’acompte du mariage finance l’écran.' },
        { targetAlias: 'N7', label: 'fantôme', justification: 'Alias inconnu.' }
      ])
    )
    t.fusion.confirm(proposal.id)
    await t.links.settled()

    const input = t.h.anonymized.at(-1) ?? ''
    expect(input).toMatch(/\[N1\] Mission photo mariage/)
    expect(input).not.toMatch(/restaurant/)
    expect(t.links.list()).toEqual([
      expect.objectContaining({
        label: 'financement',
        justification: 'L’acompte du mariage finance l’écran.',
        origin: 'ai',
        status: 'suggested'
      })
    ])
    const [link] = t.links.list()
    expect([link?.a.id, link?.b.id].sort()).toEqual([wedding.id, screen.id].sort())
    expect(t.events).toContainEqual({ type: 'links:suggested', rootId: screen.id, count: 1 })
  })

  it('should_accept_or_refuse_and_never_repropose_a_refused_link', async () => {
    await hatched('Mission photo mariage', ['Livrer les photos'])
    const { root: screen, proposal } = await locked('Écran photo', ['Commander l’écran photo'])
    const reply = linksReply([{ targetAlias: 'N1', label: 'Financement', justification: 'L’acompte paie l’écran.' }])
    t.h.claude.enqueue(reply)
    t.fusion.confirm(proposal.id)
    await t.links.settled()
    const [suggested] = t.links.list('suggested')
    expect(t.links.decide({ linkId: suggested?.id ?? '', accept: false }).status).toBe('rejected')
    expect(t.examples.count('suggerer_liens')).toBe(1)
    expect(() => t.links.decide({ linkId: suggested?.id ?? '', accept: true })).toThrow(
      expect.objectContaining({ code: 'INVALID_STATE' })
    )

    // Réouverture puis nouvelle éclosion : l'IA repropose le même lien (libellé reformulé) → ignoré.
    t.fusion.reopen(screen.id)
    t.h.claude.enqueue({
      raw: {
        nodes: [{ ref: 't0', type: 'task', title: 'Commander l’écran photo', sourceRefs: ['s0'] }],
        dependencies: [],
        gaps: []
      }
    })
    const again = await t.fusion.lock({ rootId: screen.id, force: true })
    t.h.claude.enqueue(linksReply([{ targetAlias: 'N1', label: 'financement !', justification: 'Idem.' }]))
    t.fusion.confirm(again.id)
    await t.links.settled()
    expect(t.links.list()).toEqual([])
  })

  it('should_accept_a_suggestion_into_an_accepted_link', async () => {
    await hatched('Mission photo mariage', ['Livrer les photos'])
    const { proposal } = await locked('Écran photo', ['Commander l’écran photo'])
    t.h.claude.enqueue(linksReply([{ targetAlias: 'N1', label: 'photo', justification: 'Même métier.' }]))
    t.fusion.confirm(proposal.id)
    await t.links.settled()
    const [suggested] = t.links.list()
    expect(t.links.decide({ linkId: suggested?.id ?? '', accept: true })).toMatchObject({ status: 'accepted' })
    expect(t.links.list('accepted')).toHaveLength(1)
  })

  it('should_link_two_ideas_without_a_label_and_refuse_the_same_link_twice', async () => {
    const a = await t.neurons.create({ text: 'Vélo électrique' })
    const b = await t.neurons.create({ text: 'Déménagement' })
    expect(t.links.create({ aRootId: a.id, bRootId: b.id, label: '' })).toMatchObject({ label: '', status: 'accepted' })
    expect(() => t.links.create({ aRootId: b.id, bRootId: a.id, label: '  ' })).toThrow(
      expect.objectContaining({ code: 'DUPLICATE' })
    )
  })

  it('should_create_rename_and_delete_a_user_link_and_refuse_duplicates', async () => {
    const a = await t.neurons.create({ text: 'Vélo électrique' })
    const b = await t.neurons.create({ text: 'Déménagement' })
    const created = t.links.create({ aRootId: b.id, bRootId: a.id, label: 'mobilité' })
    expect(created).toMatchObject({ origin: 'user', status: 'accepted', label: 'mobilité' })
    expect(() => t.links.create({ aRootId: a.id, bRootId: b.id, label: 'Mobilité' })).toThrow(
      expect.objectContaining({ code: 'DUPLICATE' })
    )
    expect(() => t.links.create({ aRootId: a.id, bRootId: a.id, label: 'soi' })).toThrow(
      expect.objectContaining({ code: 'VALIDATION' })
    )
    expect(t.links.update({ linkId: created.id, label: 'transport' }).label).toBe('transport')
    expect(t.links.delete(created.id)).toEqual({ ok: true })
    expect(t.links.list()).toEqual([])
    expect(() => t.links.delete(created.id)).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }))
  })
})
