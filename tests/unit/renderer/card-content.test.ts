import { describe, expect, it } from 'vitest'
import { canChat, cardHead, STEP_PROGRESS } from '../../../src/renderer/src/canvas/cards/cardContent'
import { canvasView, DEVELOPING_ID, HATCHED_A_ID } from '../../fixtures/ui/canvas'
import type { StepView } from '../../../src/shared/ipc/canvas'

const idea = (id: string) => {
  const found = canvasView().ideas.find((entry) => entry.id === id)
  if (found === undefined) throw new Error('fixture')
  return found
}

const step: StepView = {
  id: 's1',
  genesisId: HATCHED_A_ID,
  parentId: HATCHED_A_ID,
  depth: 1,
  rank: 1,
  title: 'Valider le budget',
  status: 'en_cours',
  locked: true,
  lockProposed: false,
  waitsFor: [],
  offset: { x: 0, y: 0 }
}

describe('contenu d’une carte de détails (spec 022 D6, D7)', () => {
  it('should_show_maturity_nature_and_category_when_the_node_is_an_idea', () => {
    const head = cardHead({ kind: 'idea', neuron: idea(DEVELOPING_ID) })
    expect(head).toMatchObject({ badge: 'En développement', title: 'Deuxième écran', meta: 'Action · Achat' })
    expect(head.gauge).toEqual({ label: 'Maturité', value: 35, text: 'Contexte insuffisant' })
  })

  it('should_leave_out_an_empty_summary_when_there_is_no_sheet', () => {
    expect(cardHead({ kind: 'idea', neuron: { ...idea(DEVELOPING_ID), sheetSummary: '  ' } }).summary).toBeNull()
  })

  it('should_show_progress_rank_and_lock_when_the_node_is_a_step', () => {
    const head = cardHead({ kind: 'step', step, label: '①', genesisTitle: 'Mission mariage' })
    expect(head).toMatchObject({
      badge: 'Étape',
      meta: '① · Mission mariage · verrouillée',
      gauge: STEP_PROGRESS.en_cours
    })
  })

  it('should_announce_a_final_action_and_its_deliverable_when_the_step_has_one', () => {
    const head = cardHead({
      kind: 'step',
      step: { ...step, final: { state: 'prete', deliverable: 'src/Contact.tsx', reason: 'r', projectLinked: false } },
      label: '①',
      genesisTitle: 'G'
    })
    expect(head).toMatchObject({ badge: 'Action finale', summary: 'src/Contact.tsx' })
  })

  it('should_show_the_reason_and_no_gauge_when_the_node_is_a_ghost', () => {
    const head = cardHead({
      kind: 'ghost',
      ghost: { id: 'g', title: 'Choisir le lieu', why: 'Après le budget', rank: 1, waitsFor: [] },
      label: '②',
      proposalId: 'p'
    })
    expect(head).toMatchObject({ badge: 'Étape proposée par Claude', summary: 'Après le budget', gauge: null })
  })

  it('should_count_files_and_say_when_claude_writes_when_the_node_is_a_deliverable', () => {
    const head = cardHead({
      kind: 'deliverable',
      deliverable: {
        neuronId: 's1',
        genesisId: HATCHED_A_ID,
        files: [{ path: 'a.ts', status: 'cree' }],
        executing: true,
        width: 1,
        height: 1,
        offset: { x: 0, y: 0 }
      },
      stepTitle: 'Valider le budget'
    })
    expect(head).toMatchObject({ meta: '1 fichier · Claude écrit…', title: 'Livrable de « Valider le budget »' })
  })

  it('should_offer_a_conversation_only_when_the_node_has_one', () => {
    expect(canChat({ kind: 'idea', neuron: idea(DEVELOPING_ID) })).toBe(true)
    expect(canChat({ kind: 'step', step, label: '①', genesisTitle: 'G' })).toBe(true)
    expect(
      canChat({
        kind: 'document',
        document: {
          id: 'd',
          neuronId: 's1',
          genesisId: HATCHED_A_ID,
          title: 'Doc',
          fileLabel: 'docs/d.md',
          width: 1,
          height: 1,
          origin: 'user',
          offset: { x: 0, y: 0 }
        }
      })
    ).toBe(false)
  })
})
