import { describe, expect, it } from 'vitest'
import type { ActionPlanOut, ReflectionSummaryOut } from '../../../src/shared/ai/neurons'
import { checkPlan, checkReflection, isAcyclic } from '../../../src/main/domain/neurons/planChecks'

type PlanNode = ActionPlanOut['nodes'][number]

const KNOWN = new Set(['s0', 's1', 's2'])

function node(ref: string, extra: Partial<PlanNode> = {}): PlanNode {
  return { ref, type: 'task', title: `Étape ${ref}`, sourceRefs: ['s0'], ...extra }
}

function plan(nodes: PlanNode[], dependencies: ActionPlanOut['dependencies'] = []): ActionPlanOut {
  return { nodes, dependencies, gaps: [] }
}

/** Plan « 2e écran » : condition « J'ai l'argent ? » et ses deux branches. */
const SCREEN_PLAN = plan(
  [
    node('c1', { type: 'condition', title: 'J’ai l’argent ?', question: 'Budget disponible ?', sourceRefs: ['s1'] }),
    node('t1', { parentRef: 'c1', branchLabel: 'Oui', title: 'Commander l’écran' }),
    node('t2', { parentRef: 'c1', branchLabel: 'Non', title: 'Attendre la mission mariage' }),
    node('t3', { title: 'Installer l’écran' })
  ],
  [{ fromRef: 't1', toRef: 't3', kind: 'after_done' }]
)

describe('contrôles du plan (P1–P5)', () => {
  it('should_accept_a_valid_plan_with_condition_and_two_branches', () => {
    expect(checkPlan(SCREEN_PLAN, KNOWN)).toBeNull()
  })

  it('should_reject_when_refs_are_duplicated', () => {
    expect(checkPlan(plan([node('t1'), node('t1')]), KNOWN)?.code).toBe('AI_INVALID_OUTPUT')
  })

  it('should_reject_when_parent_ref_is_unknown_or_self', () => {
    expect(checkPlan(plan([node('t1', { parentRef: 'zz' })]), KNOWN)?.code).toBe('AI_INVALID_OUTPUT')
    expect(checkPlan(plan([node('t1', { parentRef: 't1' })]), KNOWN)?.code).toBe('AI_INVALID_OUTPUT')
  })

  it('should_reject_when_dependency_targets_unknown_step_or_itself_or_is_duplicated', () => {
    const base = [node('t1'), node('t2')]
    expect(checkPlan(plan(base, [{ fromRef: 't1', toRef: 'zz', kind: 'after_done' }]), KNOWN)?.code).toBe(
      'AI_INVALID_OUTPUT'
    )
    expect(checkPlan(plan(base, [{ fromRef: 't1', toRef: 't1', kind: 'after_done' }]), KNOWN)?.code).toBe(
      'AI_INVALID_OUTPUT'
    )
    const twice = { fromRef: 't1', toRef: 't2', kind: 'after_done' as const }
    expect(checkPlan(plan(base, [twice, twice]), KNOWN)?.code).toBe('AI_INVALID_OUTPUT')
  })

  it('should_reject_condition_with_one_or_five_branches', () => {
    const condition = node('c1', { type: 'condition' })
    const branches = (count: number) =>
      Array.from({ length: count }, (_, index) => node(`b${index}`, { parentRef: 'c1', branchLabel: `B${index}` }))
    expect(checkPlan(plan([condition, ...branches(1)]), KNOWN)?.code).toBe('AI_INVALID_OUTPUT')
    expect(checkPlan(plan([condition, ...branches(5)]), KNOWN)?.code).toBe('AI_INVALID_OUTPUT')
    expect(checkPlan(plan([condition, ...branches(4)]), KNOWN)).toBeNull()
  })

  it('should_reject_branch_without_label', () => {
    const nodes = [
      node('c1', { type: 'condition' }),
      node('t1', { parentRef: 'c1', branchLabel: 'Oui' }),
      node('t2', { parentRef: 'c1' })
    ]
    expect(checkPlan(plan(nodes), KNOWN)?.code).toBe('AI_INVALID_OUTPUT')
  })

  it('should_reject_plan_deeper_than_five_levels', () => {
    const chain = (length: number) =>
      Array.from({ length }, (_, index) => node(`t${index}`, index === 0 ? {} : { parentRef: `t${index - 1}` }))
    expect(checkPlan(plan(chain(5)), KNOWN)).toBeNull()
    expect(checkPlan(plan(chain(6)), KNOWN)?.code).toBe('DEPTH_EXCEEDED')
  })

  it('should_detect_cycle_in_hierarchy', () => {
    const nodes = [node('t1', { parentRef: 't2' }), node('t2', { parentRef: 't1' })]
    expect(checkPlan(plan(nodes), KNOWN)?.code).toBe('CYCLE_DETECTED')
  })

  it('should_detect_cycle_in_dependencies_with_kahn', () => {
    const nodes = [node('t1'), node('t2'), node('t3')]
    const loop = plan(nodes, [
      { fromRef: 't1', toRef: 't2', kind: 'after_done' },
      { fromRef: 't2', toRef: 't3', kind: 'after_done' },
      { fromRef: 't3', toRef: 't1', kind: 'on_trigger', triggerLabel: 'Paie reçue' }
    ])
    expect(checkPlan(loop, KNOWN)?.code).toBe('CYCLE_DETECTED')
  })

  it('should_reject_unknown_source_ref', () => {
    expect(checkPlan(plan([node('t1', { sourceRefs: ['s9'] })]), KNOWN)?.code).toBe('AI_INVALID_OUTPUT')
  })
})

describe('tri de Kahn', () => {
  it('should_accept_diamond_and_reject_loop', () => {
    const ids = ['a', 'b', 'c', 'd']
    expect(
      isAcyclic(ids, [
        ['a', 'b'],
        ['a', 'c'],
        ['b', 'd'],
        ['c', 'd']
      ])
    ).toBe(true)
    expect(
      isAcyclic(ids, [
        ['a', 'b'],
        ['b', 'c'],
        ['c', 'a']
      ])
    ).toBe(false)
  })
})

describe('contrôle de la synthèse Réflexion (S1)', () => {
  const summary = (sourceRefs: string[]): ReflectionSummaryOut => ({
    keyPoints: [{ text: 'Le 35 mm couvre le reportage', sourceRefs }],
    decisions: [],
    pros: [{ text: 'Plus léger', sourceRefs: ['s2'] }],
    cons: [],
    openQuestions: [{ text: 'Garder le 24-70 ?' }]
  })

  it('should_accept_known_sources', () => {
    expect(checkReflection(summary(['s1']), KNOWN)).toBeNull()
  })

  it('should_reject_unknown_sources', () => {
    expect(checkReflection(summary(['s7']), KNOWN)?.code).toBe('AI_INVALID_OUTPUT')
  })
})
