import { describe, expect, it } from 'vitest'
import { lotInstructions, lotLabel, parseLotPlan, routeLot } from '../../../src/shared/agents/lotPlan'

const SPEC = `# Spec du lot Tri

## T001 — Trier par date
Complexité : basse.

## T002 — Trier par titre
Complexité : haute.

RECOMMANDÉ: Développeur — il connaît src/a.ts
RECOMMANDÉ: Qualité — relit les tests
AIGUILLAGE: T001 | Développeur, Qualité | Qualité attend Développeur
- AIGUILLAGE: T002 | Développeur, Designer, Qualité | Qualité attend Développeur, Qualité attend Designer
AIGUILLAGE: T001 | Intrus | rien
AIGUILLAGE: #3 | Développeur | Fantôme attend Développeur, Développeur attend Développeur
AIGUILLAGE: T004 |  |
RYTHME: une à une — T002 touche le tri partagé
RYTHME: tout le lot — ignorée, la première compte
`

describe('spec de lot du PO (L1o D25, T021)', () => {
  it('should_read_each_task_routing_and_the_rhythm_advice_when_the_lines_are_well_formed', () => {
    expect(parseLotPlan(SPEC)).toEqual({
      steps: [
        {
          task: 'T001',
          agents: ['Développeur', 'Qualité'],
          waits: [{ agent: 'Qualité', after: 'Développeur' }]
        },
        {
          task: 'T002',
          agents: ['Développeur', 'Designer', 'Qualité'],
          waits: [
            { agent: 'Qualité', after: 'Développeur' },
            { agent: 'Qualité', after: 'Designer' }
          ]
        },
        // Une attente qui nomme un agent absent de sa tâche, ou un agent qui s'attend lui-même, est ignorée.
        { task: '#3', agents: ['Développeur'], waits: [] }
      ],
      rhythm: { mode: 'une-a-une', reason: 'T002 touche le tri partagé' }
    })
  })

  it('should_return_an_empty_plan_when_the_spec_is_for_a_single_task', () => {
    expect(parseLotPlan('# Spec\n\nRECOMMANDÉ: Développeur — ok\n')).toEqual({ steps: [], rhythm: null })
    expect(parseLotPlan('RYTHME: tout le lot').rhythm).toEqual({ mode: 'tout', reason: '' })
    expect(parseLotPlan('RYTHME: au feeling — ?').rhythm).toBeNull()
    // Le PO de Bike_cycle a écrit « à la chaîne » (2026-10-17) : c'est enchaîner tout le lot.
    expect(parseLotPlan('RYTHME: à la chaîne, Thor puis QA — rien à relire').rhythm).toEqual({
      mode: 'tout',
      reason: 'rien à relire'
    })
  })

  it('should_list_only_the_open_tasks_with_their_label_when_instructing_the_po', () => {
    const text = lotInstructions([
      { id: 'T001', key: 'a', text: 'Trier par date', done: true },
      { id: 'T002', key: 'b', text: 'Trier par titre', done: false },
      { id: '', key: 'c', text: 'État vide', done: false }
    ])
    expect(text).toContain('LOT de 2 tâche(s)')
    expect(text).not.toContain('Trier par date')
    expect(text).toContain('- T002 · Trier par titre')
    expect(text).toContain('- #3 · État vide')
    expect(text).toContain('AIGUILLAGE:')
    expect(text).toContain('RYTHME:')
    expect(lotLabel({ id: '' }, 0)).toBe('#1')
    // Le fichier du lot est nommé : on y coche, on n'en crée pas d'autre (retour du lot de Bike_cycle, 2026-10-17).
    const named = lotInstructions([{ id: 'T001', key: 'a', text: 'Trier', done: false }], 'docs/TACHES-TRI.md')
    expect(named).toContain('Ces tâches vivent dans docs/TACHES-TRI.md : ne crée AUCUN autre fichier de tâches.')
  })
})

describe('aiguillage automatique du lot (L1o D25, T023)', () => {
  const team = [
    { id: 'dev', name: 'Développeur' },
    { id: 'qa', name: 'Qualité' }
  ]
  const plan = parseLotPlan(SPEC)

  it('should_turn_the_po_profile_names_into_team_agents_and_flag_the_missing_ones', () => {
    const routes = routeLot({ plan, overrides: [] }, team)
    expect(routes[0]).toEqual({
      task: 'T001',
      agents: ['dev', 'qa'],
      links: [{ from: 'dev', to: 'qa' }],
      byHand: false,
      missing: []
    })
    // Le Designer n'est pas dans l'équipe : signalé, et son attente tombe.
    expect(routes[1]).toMatchObject({
      agents: ['dev', 'qa'],
      links: [{ from: 'dev', to: 'qa' }],
      missing: ['Designer']
    })
  })

  it('should_prefer_the_hand_routing_without_agents_that_left_the_team', () => {
    const routes = routeLot(
      {
        plan,
        overrides: [{ task: 'T001', agents: ['qa', 'parti'], links: [{ from: 'parti', to: 'qa' }] }]
      },
      team
    )
    expect(routes[0]).toEqual({ task: 'T001', agents: ['qa'], links: [], byHand: true, missing: [] })
  })
})
