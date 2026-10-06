import { describe, expect, it } from 'vitest'
import {
  assembleIdea,
  assembleLegacyStep,
  assemblePlanStep,
  bound,
  DOCUMENT_EXCERPT_CHARS,
  type IdeaFacts,
  type StepFacts
} from '../../../src/main/application/widgets/InputAssembler'
import { buildWidgetDocument, WIDGET_CSP } from '../../../src/main/application/widgets/WidgetDocument'
import { defaultParts, normalizeParts, partsFor } from '../../../src/main/domain/widgets/inputParts'
import { shapeOf, shapeSignature } from '../../../src/main/domain/widgets/shape'
import { IDEA_PARTS, STEP_PARTS } from '../../../src/shared/ipc/widgetIo'

const SHEET = {
  resume: 'Écran pour la retouche',
  points_cles: ['300 € max'],
  decisions: [],
  questions_ouvertes: [],
  manques: []
}
const EMPTY = { resume: '', points_cles: [], decisions: [], questions_ouvertes: [], manques: [] }

const idea: IdeaFacts = {
  id: 'root',
  title: 'Deuxième écran',
  nature: 'action',
  category: 'Achat',
  state: 'hatched',
  originalText: 'Acheter un deuxième écran\npour la retouche.',
  sheet: SHEET,
  plan: [{ id: 's1', parentId: 'root', label: '1', title: 'Comparer', status: 'a_faire' }],
  documents: [{ title: 'Comparatif', content: '# Modèles' }]
}

const step: StepFacts = {
  id: 's2',
  genesisId: 'root',
  title: 'Chiffrer le budget',
  label: '1.2',
  rank: 2,
  depth: 2,
  status: 'en_cours',
  why: 'Avant de commander',
  final: { deliverable: 'budget.md', state: 'a_revoir' },
  sheet: SHEET,
  path: [
    { id: 'root', kind: 'genesis', label: null, title: 'Deuxième écran', sheet: SHEET },
    { id: 's1', kind: 'step', label: '1', title: 'Comparer', sheet: EMPTY }
  ],
  subtree: {
    steps: [{ id: 's3', parentId: 's2', label: '1.2.1', title: 'Devis', status: 'a_faire' }],
    documents: [{ title: 'Notes', content: 'Prix relevés' }],
    deliverable: [{ path: 'docs/budget.md', status: 'cree' }]
  }
}

describe('données d’une idée transmises à un widget (spec 015 US3)', () => {
  it('should_give_every_current_part_when_they_are_all_checked', () => {
    expect(assembleIdea(idea, IDEA_PARTS)).toEqual({
      kind: 'idea',
      id: 'root',
      title: 'Deuxième écran',
      nature: 'action',
      category: 'Achat',
      state: 'hatched',
      originalText: 'Acheter un deuxième écran\npour la retouche.',
      sheet: SHEET,
      plan: idea.plan,
      annexes: { documents: idea.documents }
    })
  })

  it.each(IDEA_PARTS)('should_leave_out_everything_but_%s_when_it_is_the_only_checked_part', (part) => {
    const keys: Record<string, string[]> = {
      identity: ['category', 'id', 'kind', 'nature', 'originalText', 'state', 'title'],
      sheet: ['id', 'kind', 'sheet'],
      plan: ['id', 'kind', 'plan'],
      annexes: ['annexes', 'id', 'kind']
    }
    expect(Object.keys(assembleIdea(idea, [part])).sort()).toEqual(keys[part])
  })

  it('should_give_only_the_identifier_when_nothing_is_checked', () => {
    expect(assembleIdea(idea, [])).toEqual({ kind: 'idea', id: 'root' })
  })

  it('should_still_read_an_old_next_step_or_nothing_when_there_is_none', () => {
    const document = {
      type: 'reflection_summary' as const,
      overview: 'En bref.',
      nextStep: 'Comparer trois modèles.',
      keyPoints: [],
      decisions: [],
      pros: [],
      cons: [],
      openQuestions: []
    }
    expect(assembleLegacyStep({ id: 'root', title: 'Deuxième écran' }, document)).toEqual({
      kind: 'step',
      ideaId: 'root',
      ideaTitle: 'Deuxième écran',
      text: 'Comparer trois modèles.'
    })
    expect(assembleLegacyStep({ id: 'root', title: 'Deuxième écran' }, null)).toBeNull()
  })
})

describe('contexte d’une étape de plan transmis à un widget (spec 015 US2)', () => {
  it('should_give_identity_sheet_path_and_subtree_when_all_parts_are_checked', () => {
    expect(assemblePlanStep(step, STEP_PARTS)).toEqual({
      kind: 'plan_step',
      id: 's2',
      genesisId: 'root',
      title: 'Chiffrer le budget',
      label: '1.2',
      rank: 2,
      depth: 2,
      status: 'en_cours',
      why: 'Avant de commander',
      final: { deliverable: 'budget.md', state: 'a_revoir' },
      sheet: SHEET,
      path: step.path,
      subtree: step.subtree
    })
  })

  it.each(STEP_PARTS)('should_keep_only_the_identifiers_and_%s_when_it_is_the_only_checked_part', (part) => {
    const keys: Record<string, string[]> = {
      identity: ['depth', 'final', 'genesisId', 'id', 'kind', 'label', 'rank', 'status', 'title', 'why'],
      sheet: ['genesisId', 'id', 'kind', 'sheet'],
      path: ['genesisId', 'id', 'kind', 'path'],
      subtree: ['genesisId', 'id', 'kind', 'subtree']
    }
    expect(Object.keys(assemblePlanStep(step, [part])).sort()).toEqual(keys[part])
  })

  it('should_shrink_documents_then_far_sheets_and_flag_it_when_the_context_is_too_big', () => {
    const long = 'x'.repeat(10_000)
    const big: StepFacts = {
      ...step,
      path: [
        { id: 'root', kind: 'genesis', label: null, title: 'G', sheet: { ...EMPTY, resume: 'y'.repeat(900) } },
        { id: 's1', kind: 'step', label: '1', title: 'P', sheet: { ...EMPTY, resume: 'z'.repeat(900) } }
      ],
      subtree: {
        ...step.subtree,
        documents: [
          { title: 'Long', content: long },
          { title: 'Court', content: 'ok' }
        ]
      }
    }
    // Borne choisie pour qu'après l'extrait du document, seule la fiche du genesis doive encore partir.
    const excerpted = assemblePlanStep(
      {
        ...big,
        subtree: {
          ...big.subtree,
          documents: [
            { title: 'Long', content: `${long.slice(0, DOCUMENT_EXCERPT_CHARS)}…` },
            { title: 'Court', content: 'ok' }
          ]
        }
      },
      STEP_PARTS
    )
    const shrunk = bound(assemblePlanStep(big, STEP_PARTS), JSON.stringify(excerpted).length - 500)
    if (shrunk.kind !== 'plan_step') throw new Error('kind')
    expect(shrunk.truncated).toBe(true)
    expect(shrunk.subtree?.documents[0]?.content).toHaveLength(DOCUMENT_EXCERPT_CHARS + 1)
    expect(shrunk.subtree?.documents[1]?.content).toBe('ok')
    // Le genesis (le plus éloigné) perd sa fiche avant le parent direct.
    expect(shrunk.path?.[0]?.sheet.resume).toBe('')
    expect(shrunk.path?.[1]?.sheet.resume).toHaveLength(900)
    expect(assemblePlanStep(step, STEP_PARTS)).not.toHaveProperty('truncated')
  })
})

describe('parties d’un branchement (spec 015 R1)', () => {
  it('should_convert_old_idea_parts_to_the_current_ones', () => {
    expect(normalizeParts('idea', ['identity', 'original', 'answers', 'tree', 'document'])).toEqual([
      'identity',
      'sheet',
      'plan',
      'annexes'
    ])
    expect(normalizeParts('idea', ['answers'])).toEqual([])
    expect(normalizeParts('idea', ['tree'])).toEqual(['plan'])
    expect(normalizeParts('idea', ['sheet', 'plan'])).toEqual(['sheet', 'plan'])
    // Un branchement récent réduit à l'identité ne reçoit pas la fiche en plus.
    expect(normalizeParts('idea', ['identity'])).toEqual(['identity'])
    expect(normalizeParts('idea', ['identity', 'original'])).toEqual(['identity', 'sheet'])
  })

  it('should_keep_only_known_parts_for_each_kind_of_source', () => {
    expect(normalizeParts('plan_step', ['path', 'tree', 42, 'identity'])).toEqual(['identity', 'path'])
    expect(normalizeParts('step', ['identity'])).toEqual([])
    expect(normalizeParts('idea', 'abîmé')).toEqual([])
    expect(partsFor('idea', ['path', 'plan'])).toEqual(['plan'])
    expect(partsFor('plan_step', ['plan', 'subtree'])).toEqual(['subtree'])
    expect(defaultParts('plan_step')).toEqual([...STEP_PARTS])
    expect(defaultParts('step')).toEqual([])
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
