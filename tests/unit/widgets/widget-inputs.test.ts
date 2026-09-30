import { describe, expect, it } from 'vitest'
import { assembleIdea, assembleStep, type IdeaFacts } from '../../../src/main/application/widgets/InputAssembler'
import { buildWidgetDocument, WIDGET_CSP } from '../../../src/main/application/widgets/WidgetDocument'
import { shapeOf, shapeSignature } from '../../../src/main/domain/widgets/shape'
import { IDEA_PARTS } from '../../../src/shared/ipc/widgetIo'

const facts: IdeaFacts = {
  tree: {
    root: {
      id: 'root',
      title: 'Deuxième écran',
      content: 'Acheter un deuxième écran\npour la retouche.',
      nature: 'action',
      natureSource: 'user',
      category: { id: 'c', slug: 'achat', label: 'Achat', color: '#b45309' },
      categorySource: 'ai',
      state: 'hatched',
      version: 4,
      position: null,
      pinned: false,
      createdAt: '2026-09-30T00:00:00.000Z',
      updatedAt: '2026-09-30T00:00:00.000Z'
    },
    neurons: [
      {
        id: 'n1',
        parentId: 'root',
        depth: 1,
        kind: 'answer',
        title: 'Budget : 300 €',
        content: null,
        amountCents: 30_000,
        dueDate: null,
        origin: 'user'
      }
    ],
    extensions: [],
    suggestions: [],
    gauge: null
  },
  answers: [{ question: 'Quel budget ?', answer: 'Budget : 300 €' }],
  document: {
    type: 'reflection_summary',
    overview: 'En bref.',
    nextStep: 'Comparer trois modèles.',
    keyPoints: [],
    decisions: [],
    pros: [],
    cons: [],
    openQuestions: []
  }
}

describe('données d’une idée transmises à un widget (spec 005 FR-003)', () => {
  it('should_give_every_part_when_they_are_all_checked', () => {
    expect(assembleIdea(facts, IDEA_PARTS)).toEqual({
      kind: 'idea',
      id: 'root',
      title: 'Deuxième écran',
      nature: 'action',
      category: 'Achat',
      state: 'hatched',
      originalText: 'Acheter un deuxième écran\npour la retouche.',
      answers: [{ question: 'Quel budget ?', answer: 'Budget : 300 €' }],
      tree: [
        {
          id: 'n1',
          parentId: 'root',
          kind: 'answer',
          title: 'Budget : 300 €',
          content: null,
          amountCents: 30_000,
          dueDate: null
        }
      ],
      document: facts.document,
      nextStep: 'Comparer trois modèles.'
    })
  })

  it.each(IDEA_PARTS)('should_leave_out_everything_but_%s_when_it_is_the_only_checked_part', (part) => {
    const keys: Record<string, string[]> = {
      identity: ['category', 'id', 'kind', 'nature', 'state', 'title'],
      original: ['id', 'kind', 'originalText'],
      answers: ['answers', 'id', 'kind'],
      tree: ['id', 'kind', 'tree'],
      document: ['document', 'id', 'kind', 'nextStep']
    }
    expect(Object.keys(assembleIdea(facts, [part])).sort()).toEqual(keys[part])
  })

  it('should_give_only_the_identifier_when_nothing_is_checked', () => {
    expect(assembleIdea(facts, [])).toEqual({ kind: 'idea', id: 'root' })
  })

  it('should_transmit_a_next_step_with_the_title_of_its_idea_or_nothing_when_there_is_none', () => {
    expect(assembleStep(facts)).toEqual({
      kind: 'step',
      ideaId: 'root',
      ideaTitle: 'Deuxième écran',
      text: 'Comparer trois modèles.'
    })
    expect(assembleStep({ ...facts, document: null })).toBeNull()
  })
})

describe('structure d’une donnée décrite à Claude (spec 005 FR-012)', () => {
  it('should_describe_fields_types_and_sizes_without_any_value', () => {
    const shape = shapeOf([
      {
        total: 1250,
        lignes: [
          { libelle: 'Traiteur', montant: 900 },
          { libelle: 'DJ', montant: 350 }
        ]
      }
    ])
    expect(shape).toBe('[{ lignes: [{ libelle: string, montant: number }] × 2, total: number }] × 1')
    expect(shape).not.toMatch(/Traiteur|DJ|900|350|1250/)
  })

  it('should_handle_empty_mixed_and_null_values', () => {
    expect(shapeOf({ a: [], b: [1, 'x'], c: null, d: true })).toBe(
      '{ a: [], b: [(number | string)] × 2, c: null, d: boolean }'
    )
  })

  it('should_give_the_same_signature_to_data_of_the_same_shape_whatever_its_size', () => {
    expect(shapeSignature({ lignes: [{ m: 1 }] })).toBe(shapeSignature({ lignes: [{ m: 2 }, { m: 3 }] }))
    expect(shapeSignature({ lignes: [{ m: 1 }] })).not.toBe(shapeSignature({ lignes: [{ m: 'x' }] }))
  })
})

describe('pont des entrées dans le document isolé (spec 005 FR-004)', () => {
  const document = buildWidgetDocument(
    { title: 'Budget', html: '<main></main>', css: '', js: 'gi.onInputs(render)' },
    { scheme: 'light', colors: {} }
  )

  it('should_expose_a_frozen_bridge_before_the_widget_code_runs', () => {
    expect(document.indexOf("Object.defineProperty(window, 'gi'")).toBeGreaterThan(-1)
    expect(document.indexOf("Object.defineProperty(window, 'gi'")).toBeLessThan(document.indexOf('gi.onInputs(render)'))
    expect(document).toContain('Object.freeze({')
    expect(document).toContain('{ value: gi, writable: false, configurable: false }')
  })

  it('should_accept_inputs_only_from_the_application_window', () => {
    expect(document).toContain('if (event.source !== window.parent) return')
    expect(document).toContain("data.type !== 'gi:inputs' || !Array.isArray(data.inputs)")
  })

  it('should_still_open_no_network_access', () => {
    // postMessage n'est pas une connexion : la politique du document ne change pas.
    expect(WIDGET_CSP).toContain("default-src 'none'")
    expect(WIDGET_CSP).not.toMatch(/connect-src|frame-src/)
  })
})
