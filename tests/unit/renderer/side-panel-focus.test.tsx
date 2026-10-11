import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { LivingNode } from '../../../src/renderer/src/canvas/living/LivingNode'
import type { NodeVisual } from '../../../src/renderer/src/canvas/living/nodeVisual'
import { SidePanel } from '../../../src/renderer/src/canvas/side/SidePanel'
import { useSidePanel } from '../../../src/renderer/src/canvas/side/sidePanelStore'
import { focusViewOf } from '../../../src/renderer/src/canvas/side/viewNodes'
import type { IdeasCanvasView } from '../../../src/shared/ipc/canvas'
import { expectNoAxeViolations } from '../../support/axe'
import { canvasView, HATCHED_A_ID } from '../../fixtures/ui/canvas'
import { installFakeApi } from './support/fakeApi'

const sat: NodeVisual = { depth: 2, branch: 3, size: 44, icon: 'step', status: 'doing', orb: false }
const STEP = '00000000-0000-4000-8000-000000002721'
const ELEMENT = '00000000-0000-4000-8000-000000002722'
const DOC = '00000000-0000-4000-8000-000000002723'

const step = (view?: 'workflow' | 'progression' | 'architecture'): IdeasCanvasView['steps'][number] => ({
  id: STEP,
  genesisId: HATCHED_A_ID,
  parentId: HATCHED_A_ID,
  depth: 1,
  rank: 1,
  title: 'Valider le budget',
  status: 'en_cours',
  locked: false,
  lockProposed: false,
  waitsFor: [],
  offset: { x: 0, y: 0 },
  ...(view === undefined ? {} : { view })
})

function viewWith(extra: Partial<IdeasCanvasView>, linked = false): IdeasCanvasView {
  const base = canvasView()
  return {
    ...base,
    ideas: base.ideas.map((idea) => (idea.id === HATCHED_A_ID ? { ...idea, linkedProject: linked } : idea)),
    ...extra
  }
}

const ring = (container: HTMLElement, title: string): string | null =>
  [...container.querySelectorAll('.living')]
    .find((node) => node.textContent?.includes(title))
    ?.getAttribute('data-chat') ?? null

describe('nœud de la conversation affichée (spec 027 US3)', () => {
  beforeEach(() => useSidePanel.getState().reset())

  it('should_ring_only_the_node_of_the_shown_tab_and_follow_the_tab_change', () => {
    const { container } = render(
      <>
        <LivingNode id="a" title="Nœud A" visual={sat} />
        <LivingNode id="b" title="Nœud B" visual={sat} />
      </>
    )
    expect(container.querySelectorAll('[data-chat]')).toHaveLength(0)
    act(() => useSidePanel.getState().openChat({ nodeId: 'a', neuronId: 'a', title: 'A', kindLabel: '' }))
    expect(ring(container, 'Nœud A')).toBe('true')
    expect(ring(container, 'Nœud B')).toBeNull()
    act(() => useSidePanel.getState().openChat({ nodeId: 'b', neuronId: 'b', title: 'B', kindLabel: '' }))
    expect(ring(container, 'Nœud A')).toBeNull()
    expect(ring(container, 'Nœud B')).toBe('true')
    // L'onglet Dépôt affiché : aucun nœud n'a l'anneau.
    act(() => useSidePanel.getState().openRepo('g'))
    expect(container.querySelectorAll('[data-chat]')).toHaveLength(0)
  })

  it('should_ring_a_workflow_node_by_its_key_when_its_tab_is_shown', () => {
    const { container } = render(<LivingNode id="wf:g:task:1" title="Tâche" visual={sat} chatId="neurone" />)
    act(() =>
      useSidePanel.getState().openWorkflowChat({ nodeId: 'wf:g:task:1', genesisId: 'g', title: 'T', kindLabel: '' })
    )
    expect(ring(container, 'Tâche')).toBe('true')
  })

  it('should_request_a_new_focus_each_time_the_center_button_is_clicked', async () => {
    installFakeApi({
      'chat:open': () => ({
        neuronId: 'a',
        title: 'A',
        messages: [],
        sheet: { resume: '', points_cles: [], decisions: [], questions_ouvertes: [], manques: [] },
        maturity: null,
        busy: false,
        partial: '',
        usage: null,
        folder: null
      })
    })
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <SidePanel />
      </QueryClientProvider>
    )
    act(() => useSidePanel.getState().openChat({ nodeId: 'a', neuronId: 'a', title: 'A', kindLabel: '' }))
    fireEvent.click(screen.getByRole('button', { name: 'Centrer sur le nœud' }))
    const first = useSidePanel.getState().focus
    expect(first?.nodeId).toBe('a')
    fireEvent.click(screen.getByRole('button', { name: 'Centrer sur le nœud' }))
    expect(useSidePanel.getState().focus?.nonce).not.toBe(first?.nonce)
    await screen.findByRole('region', { name: 'Conversation : A' })
    await expectNoAxeViolations(container)
    // Le Dépôt n'a pas de nœud : pas de bouton.
    act(() => useSidePanel.getState().openRepo('g'))
    expect(screen.queryByRole('button', { name: 'Centrer sur le nœud' })).toBeNull()
  })
})

describe('vue où un nœud est dessiné (spec 027 R5)', () => {
  it('should_send_a_workflow_task_to_the_workflow_view', () => {
    expect(focusViewOf('wf:g1:task:001:T1', viewWith({}))).toEqual({ genesisId: 'g1', kind: 'workflow' })
  })

  it('should_send_an_element_to_the_progression_view', () => {
    // Seuls l'identifiant et le genesis comptent pour la règle.
    const element = { id: ELEMENT, genesisId: HATCHED_A_ID } as IdeasCanvasView['elements'][number]
    expect(focusViewOf(ELEMENT, viewWith({ elements: [element] }))).toEqual({
      genesisId: HATCHED_A_ID,
      kind: 'progression'
    })
  })

  it('should_send_a_step_and_its_document_to_the_view_where_the_step_was_born', () => {
    const document = {
      id: DOC,
      neuronId: STEP,
      genesisId: HATCHED_A_ID,
      title: 'Doc',
      fileLabel: 'docs/doc.md',
      width: 300,
      height: 200,
      origin: 'user' as const,
      offset: { x: 0, y: 0 }
    }
    const view = viewWith({ steps: [step('architecture')], documents: [document] })
    expect(focusViewOf(STEP, view)).toEqual({ genesisId: HATCHED_A_ID, kind: 'architecture' })
    expect(focusViewOf(`document-${DOC}`, view)).toEqual({ genesisId: HATCHED_A_ID, kind: 'architecture' })
    // Étape d'avant la D19 (sans vue) : Workflow pour un projet lié, Progression sinon.
    expect(focusViewOf(STEP, viewWith({ steps: [step()] }, true))?.kind).toBe('workflow')
    expect(focusViewOf(STEP, viewWith({ steps: [step()] }))?.kind).toBe('progression')
  })

  it('should_return_nothing_for_an_idea_or_an_unknown_node', () => {
    expect(focusViewOf(HATCHED_A_ID, viewWith({}))).toBeNull()
    expect(focusViewOf('inconnu', viewWith({}))).toBeNull()
  })
})
