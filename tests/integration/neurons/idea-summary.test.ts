import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { IdeaSummaryService } from '../../../src/main/application/neurons/IdeaSummaryService'
import { HatchedRepository } from '../../../src/main/infrastructure/db/repositories/HatchedRepository'
import { createNeuronHarness, etendreReply, type NeuronHarness } from '../../support/neurons'

describe('résumé de l’idée de départ (fiche de la graine)', () => {
  let t: NeuronHarness
  let summaries: IdeaSummaryService
  beforeEach(() => {
    t = createNeuronHarness()
    const hatched = new HatchedRepository(t.handle.db)
    summaries = new IdeaSummaryService({
      repository: t.growthRepository,
      gateway: t.h.gateway,
      document: (rootId) => hatched.result(rootId)
    })
  })
  afterEach(() => t.dispose())

  async function developed() {
    const root = await t.neurons.create({ text: 'Acheter un 2e écran', nature: 'action' })
    t.h.claude.enqueue(etendreReply(['Pour quand ?', 'Quel budget ?', 'Quel modèle ?']))
    const tree = (await t.growth.develop(root.id)).tree
    t.growth.addBranch({ parentId: root.id, title: 'Budget : 300 €' })
    t.h.ollama.setAvailable(true)
    return tree.root.id
  }

  it('should_not_call_the_ai_when_the_idea_has_nothing_but_its_original_text', async () => {
    const root = await t.neurons.create({ text: 'Acheter un 2e écran', nature: 'action' })
    t.h.ollama.setAvailable(true)
    expect(await summaries.get(root.id)).toEqual({ summary: null, stale: false })
    expect(t.h.ollama.requests).toHaveLength(0)
  })

  it('should_summarize_locally_what_the_brainstorming_brought_and_remember_it', async () => {
    const rootId = await developed()
    const claudeCalls = t.h.claude.requests.length
    t.h.ollama.enqueue({ raw: { summary: 'Tu veux un second écran pour 300 €.' } })
    expect(await summaries.get(rootId)).toEqual({ summary: 'Tu veux un second écran pour 300 €.', stale: false })
    expect(t.h.ollama.requests).toHaveLength(1)
    expect(t.h.claude.requests).toHaveLength(claudeCalls)
    // Même idée, inchangée : le résumé mémorisé est rendu sans nouvel appel.
    expect((await summaries.get(rootId)).summary).toBe('Tu veux un second écran pour 300 €.')
    expect(t.h.ollama.requests).toHaveLength(1)
  })

  it('should_summarize_again_only_when_the_idea_has_changed', async () => {
    const rootId = await developed()
    t.h.ollama.enqueue({ raw: { summary: 'Premier résumé.' } })
    await summaries.get(rootId)
    t.growth.addBranch({ parentId: rootId, title: 'Un modèle mat de 27 pouces' })
    t.h.ollama.enqueue({ raw: { summary: 'Second résumé.' } })
    expect(await summaries.get(rootId)).toEqual({ summary: 'Second résumé.', stale: false })
    expect(t.h.ollama.requests).toHaveLength(2)
  })

  it('should_keep_the_last_summary_and_flag_it_when_the_ai_is_down', async () => {
    const rootId = await developed()
    t.h.ollama.enqueue({ raw: { summary: 'Premier résumé.' } })
    await summaries.get(rootId)
    t.growth.addBranch({ parentId: rootId, title: 'Un modèle mat de 27 pouces' })
    t.h.ollama.setAvailable(false)
    expect(await summaries.get(rootId)).toEqual({ summary: 'Premier résumé.', stale: true })
  })

  it('should_ask_the_ai_once_when_the_summary_is_requested_twice_at_the_same_time', async () => {
    const rootId = await developed()
    t.h.ollama.enqueue({ raw: { summary: 'Un seul appel.' } })
    const [first, second] = await Promise.all([summaries.get(rootId), summaries.get(rootId)])
    expect(first).toEqual(second)
    expect(t.h.ollama.requests).toHaveLength(1)
  })

  it('should_refuse_an_unknown_idea', async () => {
    await expect(summaries.get('00000000-0000-4000-8000-00000000dead')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
