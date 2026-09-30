import { screen, waitFor, within } from '@testing-library/react'
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
  overview: 'L’écran rentre dans le budget ; reste à choisir la taille.',
  nextStep: 'Mesurer le bureau ce soir',
  keyPoints: [
    {
      headline: 'Budget tenu',
      text: 'Les 200 € prévus suffisent.',
      sources: [{ id: CHILD_ID, title: 'budget : 200 €' }]
    }
  ],
  decisions: [],
  pros: [{ headline: null, text: 'Travail plus confortable', sources: [] }],
  cons: [{ headline: null, text: 'Moins de place sur le bureau', sources: [] }],
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
    'fusion:reopen': () => hatchedTree,
    'growth:develop': () => ({ tree: developingTree() })
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

  it('should_present_the_summary_as_an_editorial_sheet', async () => {
    renderHatched(SUMMARY)
    const brief = await screen.findByRole('region', { name: 'En bref' })
    expect(within(brief).getByText('L’écran rentre dans le budget ; reste à choisir la taille.')).toBeDefined()
    const points = screen.getByRole('region', { name: 'Points clés' })
    expect(within(points).getByText('Budget tenu')).toBeDefined()
    expect(within(points).getByText('Les 200 € prévus suffisent.')).toBeDefined()
    expect(within(screen.getByRole('region', { name: 'Pour' })).getByText('Travail plus confortable')).toBeDefined()
    expect(
      within(screen.getByRole('region', { name: 'Contre' })).getByText('Moins de place sur le bureau')
    ).toBeDefined()
    const next = screen.getByRole('region', { name: 'Prochaine étape' })
    expect(within(next).getByText('Mesurer le bureau ce soir')).toBeDefined()
  })

  it('should_read_as_a_clean_document_with_its_origins_folded', async () => {
    const user = userEvent.setup()
    renderHatched(SUMMARY)
    const points = await screen.findByRole('region', { name: 'Points clés' })
    expect(within(points).getByText('Budget tenu')).toBeDefined()
    const origin = within(points).getByText('budget : 200 €')
    expect(origin.closest('details')?.open).toBe(false)
    await user.click(within(points).getByText('D’où ça vient'))
    expect(origin.closest('details')?.open).toBe(true)
  })

  it('should_start_a_new_cycle_of_questions_when_deepened', async () => {
    const user = userEvent.setup()
    const api = renderHatched(PLAN)
    await user.click(await screen.findByRole('button', { name: 'Approfondir' }))
    expect(api.invoke).toHaveBeenCalledWith('fusion:reopen', { rootId: ROOT_ID })
    await waitFor(() => expect(api.invoke).toHaveBeenCalledWith('growth:develop', { rootId: ROOT_ID }))
  })

  it('should_have_no_accessibility_violation_in_the_editorial_sheet', async () => {
    renderHatched(SUMMARY)
    await screen.findByRole('region', { name: 'En bref' })
    await expectNoAxeViolations(document.body)
  })

  it('should_have_no_accessibility_violation', async () => {
    renderHatched(PLAN)
    const panel = await screen.findByRole('region', { name: 'Plan de l’idée éclose' })
    await within(panel).findByText('Commander maintenant')
    await expectNoAxeViolations(document.body)
  })
})
