import { describe, expect, it } from 'vitest'
import {
  lotGroups,
  lotInstructions,
  lotLabel,
  parseLotPlan,
  routeLot,
  stagesOf
} from '../../../src/shared/agents/lotPlan'

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
          waits: [{ agent: 'Qualité', after: 'Développeur' }],
          after: []
        },
        {
          task: 'T002',
          agents: ['Développeur', 'Designer', 'Qualité'],
          waits: [
            { agent: 'Qualité', after: 'Développeur' },
            { agent: 'Qualité', after: 'Designer' }
          ],
          after: []
        },
        // Une attente qui nomme un agent absent de sa tâche, ou un agent qui s'attend lui-même, est ignorée.
        { task: '#3', agents: ['Développeur'], waits: [], after: [] }
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
    // L1o D28 : en même temps par défaut, une attente seulement quand un agent a besoin du résultat d'un autre.
    expect(text).toContain('EN MÊME TEMPS sauf si tu écris une attente')
    expect(text).toContain('Le QA, s’il y en a un, attend tous ceux qui codent')
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
      after: [],
      unknownAfter: [],
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
    expect(routes[0]).toEqual({
      task: 'T001',
      agents: ['qa'],
      links: [],
      after: [],
      unknownAfter: [],
      byHand: true,
      missing: []
    })
  })
})

describe('étages d’une tâche (L1o D28, T031)', () => {
  it('should_group_independent_agents_and_put_the_qa_after_them_when_it_waits_for_both', () => {
    const links = [
      { from: 'front', to: 'qa' },
      { from: 'back', to: 'qa' }
    ]
    expect(stagesOf(['front', 'back', 'qa'], links)).toEqual([['front', 'back'], ['qa']])
  })

  it('should_place_an_agent_after_the_latest_one_it_waits_for_when_chains_differ', () => {
    const links = [
      { from: 'archi', to: 'back' },
      { from: 'back', to: 'qa' },
      { from: 'front', to: 'qa' }
    ]
    expect(stagesOf(['archi', 'back', 'front', 'qa'], links)).toEqual([['archi', 'front'], ['back'], ['qa']])
  })

  it('should_ignore_links_to_absent_agents_and_never_loop_when_links_cycle', () => {
    expect(stagesOf(['a'], [{ from: 'ghost', to: 'a' }])).toEqual([['a']])
    const cycle = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'a' }
    ]
    expect(stagesOf(['a', 'b'], cycle).flat().sort()).toEqual(['a', 'b'])
  })
})

describe('tâches d’un lot en même temps (L1o D28, T032)', () => {
  const LOT = `AIGUILLAGE: T001 | Back, QA | QA attend Back | rien
AIGUILLAGE: T002 | Front, QA | QA attend Front | après T001, T009
AIGUILLAGE: T003 | Back, QA | QA attend Back
AIGUILLAGE: T004 | Front | | après: T002, T004`
  const team = [
    { id: 'back', name: 'Back' },
    { id: 'front', name: 'Front' },
    { id: 'qa', name: 'QA' }
  ]

  it('should_read_the_tasks_a_task_needs_when_the_fourth_field_says_apres', () => {
    const plan = parseLotPlan(LOT)
    expect(plan.steps.map((step) => step.after)).toEqual([[], ['T001', 'T009'], [], ['T002']])
    expect(lotInstructions([{ id: 'T001', key: 'a', text: 'Trier', done: false }])).toContain(
      'Les TÂCHES sans « après » partent EN MÊME TEMPS'
    )
  })

  it('should_flag_unknown_tasks_and_group_independent_ones_when_routing_the_lot', () => {
    const routes = routeLot({ plan: parseLotPlan(LOT), overrides: [] }, team)
    expect(routes[1]).toMatchObject({ after: ['T001'], unknownAfter: ['T009'] })
    expect(lotGroups(routes)).toEqual({ groups: [['T001', 'T003'], ['T002'], ['T004']], cycles: [] })
  })

  it('should_prefer_the_hand_dependencies_and_keep_the_plan_ones_when_a_retouch_has_none', () => {
    const plan = parseLotPlan(LOT)
    const routes = routeLot(
      {
        plan,
        overrides: [
          { task: 'T002', agents: ['front'], links: [], after: [] },
          { task: 'T004', agents: ['front'], links: [] }
        ]
      },
      team
    )
    expect(routes[1]?.after).toEqual([])
    expect(routes[3]?.after).toEqual(['T002'])
  })

  it('should_ignore_and_report_a_dependency_that_closes_a_loop', () => {
    const { groups, cycles } = lotGroups([
      { task: 'T001', after: ['T002'] },
      { task: 'T002', after: ['T001'] }
    ])
    expect(groups.flat().sort()).toEqual(['T001', 'T002'])
    expect(cycles).toHaveLength(1)
  })
})
