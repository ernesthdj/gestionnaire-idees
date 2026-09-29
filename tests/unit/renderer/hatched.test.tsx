import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it } from 'vitest'
import type { HatchedResultView } from '../../../src/shared/ipc/neurons'
import { expectNoAxeViolations } from '../../support/axe'
import { CHILD_ID, developingTree, ROOT, ROOT_ID } from '../../fixtures/ui/dive'
import { renderOpenIdea } from './support/openIdea'
import { installReactFlowMocks } from './support/reactFlowMocks'

const PLAN: HatchedResultView = {
  type: 'action_plan',
  nodes: [
    {
      id: 'c1',
      parentId: null,
      type: 'condition',
      title: 'J’ai le budget ?',
      question: 'Budget disponible ?',
      branchLabel: null,
      activeBranch: true,
      amountCents: null,
      dueDate: null,
      status: 'ready',
      investigation: false,
      toSchedule: false
    },
    {
      id: 't1',
      parentId: 'c1',
      type: 'task',
      title: 'Commander maintenant',
      question: null,
      branchLabel: 'Oui',
      activeBranch: true,
      amountCents: 25000,
      dueDate: null,
      status: 'done',
      investigation: false,
      toSchedule: false
    },
    {
      id: 't2',
      parentId: 'c1',
      type: 'task',
      title: 'Attendre la mission',
      question: null,
      branchLabel: 'Non',
      activeBranch: false,
      amountCents: null,
      dueDate: null,
      status: 'blocked',
      investigation: false,
      toSchedule: false
    },
    {
      id: 't3',
      parentId: null,
      type: 'task',
      title: 'Installer et tester',
      question: null,
      branchLabel: null,
      activeBranch: true,
      amountCents: null,
      dueDate: '2026-10-31',
      status: 'ready',
      investigation: false,
      toSchedule: false
    },
    {
      id: 't4',
      parentId: null,
      type: 'task',
      title: 'Commander après la mission',
      question: null,
      branchLabel: null,
      activeBranch: true,
      amountCents: null,
      dueDate: null,
      status: 'blocked',
      investigation: false,
      toSchedule: false
    }
  ],
  dependencies: [
    { id: 'd1', fromNodeId: 't1', toNodeId: 't3', kind: 'after_done', triggerLabel: null, triggerReachedAt: null },
    {
      id: 'd2',
      fromNodeId: 't2',
      toNodeId: 't4',
      kind: 'on_trigger',
      triggerLabel: 'mission payée',
      triggerReachedAt: null
    }
  ]
}

const SUMMARY: HatchedResultView = {
  type: 'reflection_summary',
  keyPoints: [{ text: 'Le budget tient', sources: [{ id: CHILD_ID, title: 'budget : 200 €' }] }],
  decisions: [],
  pros: [],
  cons: [],
  openQuestions: [{ text: 'Quelle taille ?' }]
}

function renderHatched(result: HatchedResultView) {
  const hatchedTree = {
    ...developingTree(),
    root: { ...ROOT, state: 'hatched' as const },
    extensions: [],
    suggestions: []
  }
  return renderOpenIdea(() => hatchedTree, {
    'fusion:getProposed': () => null,
    'hatched:get': () => result,
    'fusion:reopen': () => hatchedTree
  })
}

describe('idée éclose', () => {
  beforeAll(() => installReactFlowMocks())

  it('should_show_the_plan_with_statuses_branches_and_what_each_task_waits_for', async () => {
    renderHatched(PLAN)
    const panel = await screen.findByRole('region', { name: 'Plan de l’idée éclose' })
    expect(await within(panel).findByText('Commander maintenant')).toBeDefined()
    expect(within(panel).getByText('Faite')).toBeDefined()
    expect(within(panel).getByText(/branche écartée/)).toBeDefined()
    expect(within(panel).getByText('après « Commander maintenant »')).toBeDefined()
    expect(within(panel).getByText('quand : mission payée (pas encore)')).toBeDefined()
  })

  it('should_open_the_source_sub_neuron_of_a_reflection_point', async () => {
    const user = userEvent.setup()
    renderHatched(SUMMARY)
    await user.click(await screen.findByRole('button', { name: 'Voir la source : budget : 200 €' }))
    const crumbs = screen.getByRole('navigation', { name: 'Fil d’Ariane' })
    expect(within(crumbs).getByText('budget : 200 €').getAttribute('aria-current')).toBe('page')
  })

  it('should_reopen_the_idea_only_after_confirmation', async () => {
    const user = userEvent.setup()
    const api = renderHatched(PLAN)
    await user.click(await screen.findByRole('button', { name: 'Rouvrir l’idée' }))
    expect(api.invoke).not.toHaveBeenCalledWith('fusion:reopen', expect.anything())
    await user.click(screen.getByRole('button', { name: 'Confirmer la réouverture' }))
    expect(api.invoke).toHaveBeenCalledWith('fusion:reopen', { rootId: ROOT_ID })
  })

  it('should_have_no_accessibility_violation', async () => {
    renderHatched(PLAN)
    const panel = await screen.findByRole('region', { name: 'Plan de l’idée éclose' })
    await within(panel).findByText('Commander maintenant')
    await expectNoAxeViolations(document.body)
  })
})
