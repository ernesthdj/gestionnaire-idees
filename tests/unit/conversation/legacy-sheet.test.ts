import { describe, expect, it } from 'vitest'
import {
  legacyNextStep,
  legacySheet,
  type LegacyAnswer,
  type LegacyDocument,
  type LegacyIdea
} from '../../../src/main/domain/conversation/legacySheet'
import { isEmptySheet, Sheet, SHEET_MAX_CHARS } from '../../../src/main/domain/conversation/sheet'

const reflection = (
  overrides: Partial<Extract<LegacyDocument, { type: 'reflection_summary' }>> = {}
): LegacyDocument => ({
  type: 'reflection_summary',
  overview: 'Un studio photo à Liège, rentable en deux ans.',
  nextStep: 'Visiter trois locaux',
  keyPoints: [{ headline: 'Lieu', text: 'Liège, près de la gare' }],
  decisions: [{ headline: null, text: 'Commencer en location' }],
  pros: [{ headline: null, text: 'Clientèle mariage existante' }],
  cons: [{ headline: null, text: 'Loyer élevé' }],
  openQuestions: ['Quel budget d’éclairage ?'],
  ...overrides
})

const idea = (overrides: Partial<LegacyIdea> = {}): LegacyIdea => ({
  id: 'i1',
  answers: [],
  document: null,
  ...overrides
})

const answer = (overrides: Partial<LegacyAnswer> = {}): LegacyAnswer => ({
  kind: 'answer',
  title: 'Budget : 5 000 €',
  content: '5 000 €',
  question: 'Quel budget de départ ?',
  ...overrides
})

describe('fiche d’une idée de l’ancien moteur (spec 010 US3)', () => {
  it('should_map_the_reflection_document_to_the_sheet_sections_when_the_idea_was_hatched', () => {
    const sheet = legacySheet(idea({ document: reflection() }))
    expect(sheet).toEqual({
      resume: 'Un studio photo à Liège, rentable en deux ans.',
      points_cles: [
        'Prochaine étape : Visiter trois locaux',
        'Lieu : Liège, près de la gare',
        'Pour : Clientèle mariage existante',
        'Contre : Loyer élevé'
      ],
      decisions: ['Commencer en location'],
      questions_ouvertes: ['Quel budget d’éclairage ?'],
      manques: []
    })
  })

  it('should_list_the_active_plan_and_its_next_task_when_the_document_is_an_action_plan', () => {
    const document: LegacyDocument = {
      type: 'action_plan',
      nodes: [
        { type: 'task', title: 'Comparer les boîtiers', status: 'done', activeBranch: true },
        { type: 'condition', title: 'Budget validé ?', status: 'ready', activeBranch: true },
        { type: 'task', title: 'Commander le 70-200', status: 'ready', activeBranch: true },
        { type: 'task', title: 'Louer un 70-200', status: 'ready', activeBranch: false }
      ]
    }
    const sheet = legacySheet(idea({ document }))
    expect(sheet.resume).toBe('')
    expect(sheet.points_cles).toEqual([
      'Prochaine étape : Commander le 70-200',
      'Tâche (faite) : Comparer les boîtiers',
      'Condition : Budget validé ?',
      'Tâche (à faire) : Commander le 70-200'
    ])
  })

  it('should_prefer_the_task_in_progress_as_next_step_when_the_plan_has_one', () => {
    expect(
      legacyNextStep({
        type: 'action_plan',
        nodes: [
          { type: 'task', title: 'A', status: 'ready', activeBranch: true },
          { type: 'task', title: 'B', status: 'in_progress', activeBranch: true }
        ]
      })
    ).toBe('B')
  })

  it('should_turn_answers_into_question_arrow_answer_points_and_investigations_into_gaps_when_the_idea_grew', () => {
    const sheet = legacySheet(
      idea({
        answers: [
          answer(),
          answer({ kind: 'investigation', title: 'À trouver : local', content: null, question: 'Quel local ?' }),
          answer({ kind: 'user_branch', title: 'Faire aussi de la vidéo', content: null, question: null }),
          answer({ kind: 'idea', title: 'Partenariat', content: 'Avec un fleuriste', question: null })
        ]
      })
    )
    expect(sheet.points_cles).toEqual([
      'Quel budget de départ ? → 5 000 €',
      'Faire aussi de la vidéo',
      'Partenariat : Avec un fleuriste'
    ])
    expect(sheet.manques).toEqual(['À trouver : Quel local ?'])
  })

  it('should_put_the_document_before_the_answers_when_both_exist', () => {
    const sheet = legacySheet(idea({ document: reflection(), answers: [answer()] }))
    expect(sheet.points_cles.at(-1)).toBe('Quel budget de départ ? → 5 000 €')
    expect(sheet.points_cles[0]).toBe('Prochaine étape : Visiter trois locaux')
  })

  it('should_return_an_empty_sheet_when_the_idea_has_neither_answers_nor_document', () => {
    expect(isEmptySheet(legacySheet(idea()))).toBe(true)
  })

  it('should_read_older_syntheses_without_overview_nor_next_step', () => {
    const sheet = legacySheet(idea({ document: reflection({ overview: null, nextStep: null }) }))
    expect(sheet.resume).toBe('')
    expect(sheet.points_cles[0]).toBe('Lieu : Liège, près de la gare')
  })

  it('should_stay_within_the_sheet_bounds_when_the_old_idea_is_huge', () => {
    const long = 'x'.repeat(900)
    const sheet = legacySheet(
      idea({
        document: reflection({
          overview: long.repeat(2),
          keyPoints: Array.from({ length: 40 }, (_, i) => ({ headline: null, text: `${i} ${long}` })),
          decisions: Array.from({ length: 40 }, () => ({ headline: null, text: long })),
          openQuestions: Array.from({ length: 40 }, () => long)
        }),
        answers: Array.from({ length: 60 }, () => answer({ content: long }))
      })
    )
    expect(Sheet.safeParse(sheet).success).toBe(true)
    expect(JSON.stringify(sheet).length).toBeLessThanOrEqual(SHEET_MAX_CHARS)
    expect(sheet.resume.length).toBeLessThanOrEqual(1000)
    expect(sheet.resume.endsWith('…')).toBe(true)
    // Pertes réparties entre les sections ; la prochaine étape, en tête, est gardée.
    expect(sheet.decisions.length).toBeGreaterThan(0)
    expect(sheet.questions_ouvertes.length).toBeGreaterThan(0)
    expect(sheet.points_cles[0]).toBe('Prochaine étape : Visiter trois locaux')
  })

  it('should_skip_blank_points_when_the_stored_document_has_empty_entries', () => {
    const sheet = legacySheet(idea({ document: reflection({ decisions: [{ headline: null, text: '   ' }] }) }))
    expect(sheet.decisions).toEqual([])
  })
})
