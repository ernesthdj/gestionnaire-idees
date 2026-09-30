import { describe, expect, it } from 'vitest'
import { nextStepOf } from '../../../src/main/domain/neurons/nextStep'
import type { HatchedResultView, PlanNodeView } from '../../../src/shared/ipc/neurons'

const reflection = (nextStep: string | null): HatchedResultView => ({
  type: 'reflection_summary',
  overview: null,
  nextStep,
  keyPoints: [],
  decisions: [],
  pros: [],
  cons: [],
  openQuestions: []
})

const task = (title: string, patch: Partial<PlanNodeView> = {}): PlanNodeView => ({
  id: title,
  parentId: null,
  type: 'task',
  title,
  question: null,
  branchLabel: null,
  activeBranch: true,
  amountCents: null,
  dueDate: null,
  status: 'ready',
  investigation: false,
  toSchedule: false,
  ...patch
})

const plan = (nodes: PlanNodeView[]): HatchedResultView => ({ type: 'action_plan', nodes, dependencies: [] })

describe('prochaine étape d’une idée (FR-037)', () => {
  it('should_have_no_step_when_the_idea_has_no_document', () => {
    expect(nextStepOf(null)).toBeNull()
  })

  it('should_take_the_next_step_of_a_reflection_summary', () => {
    expect(nextStepOf(reflection('  Créer une page HTML simple.  '))).toBe('Créer une page HTML simple.')
  })

  it.each([null, '', '   '])('should_have_no_step_when_the_summary_gives_%j', (nextStep) => {
    expect(nextStepOf(reflection(nextStep))).toBeNull()
  })

  it('should_take_the_first_task_that_can_be_done_in_an_action_plan', () => {
    const result = plan([
      task('Déjà fait', { status: 'done' }),
      task('Bloquée', { status: 'blocked' }),
      task('Comparer trois modèles'),
      task('Commander')
    ])
    expect(nextStepOf(result)).toBe('Comparer trois modèles')
  })

  it('should_prefer_a_task_already_in_progress', () => {
    expect(nextStepOf(plan([task('Comparer'), task('Commander', { status: 'in_progress' })]))).toBe('Commander')
  })

  it('should_skip_conditions_and_tasks_of_an_inactive_branch', () => {
    const result = plan([
      task('J’ai le budget ?', { type: 'condition' }),
      task('Acheter neuf', { activeBranch: false }),
      task('Chercher d’occasion')
    ])
    expect(nextStepOf(result)).toBe('Chercher d’occasion')
  })

  it('should_have_no_step_when_every_task_is_done_or_blocked', () => {
    expect(nextStepOf(plan([task('Fait', { status: 'done' }), task('Bloquée', { status: 'blocked' })]))).toBeNull()
  })
})
