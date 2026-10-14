import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import type { Strays, StructureBarNodeType } from '../../../src/renderer/src/canvas/buildGraph'
import { StructureBarNode } from '../../../src/renderer/src/canvas/nodes/StructureBarNode'
import { expectNoAxeViolations } from '../../support/axe'
import { RAW_ID } from '../../fixtures/ui/canvas'
import { installFakeApi } from './support/fakeApi'

const STEP = '00000000-0000-4000-8000-0000000000a1'
const TASK = '00000000-0000-4000-8000-0000000000a2'
const CHILD = '00000000-0000-4000-8000-0000000000a3'
const NONE: Strays = { steps: [], elements: [] }

const wrap = (view: 'workflow' | 'progression' | 'architecture', strays: Strays = NONE) => {
  const props = { data: { genesisId: RAW_ID, view, hasMap: true, architecture: null, strays } }
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ReactFlowProvider>
        <StructureBarNode {...(props as unknown as NodeProps<StructureBarNodeType>)} />
      </ReactFlowProvider>
    </QueryClientProvider>
  )
}

describe('barre de la carte : le travail se fait dans le Workflow (spec 023 D26 à D28)', () => {
  const seed = vi.fn()
  const openChat = vi.fn()
  beforeEach(() => {
    seed.mockClear()
    openChat.mockClear()
    useUiStore.setState({ toast: null, seedChatDraft: seed, openChat })
  })

  it('should_start_a_new_brainstorm_from_the_workflow_view_in_the_genesis_chat', async () => {
    const user = userEvent.setup()
    installFakeApi({})
    const { container } = wrap('workflow')
    await user.click(screen.getByRole('button', { name: '✦ Nouveau brainstorm' }))
    const field = screen.getByLabelText('Sujet du brainstorm')
    expect(screen.getByRole('button', { name: 'Lancer' })).toHaveProperty('disabled', true)
    await user.type(field, '  Agents   qui « communiquent »  ')
    await expectNoAxeViolations(container)
    await user.click(screen.getByRole('button', { name: 'Lancer' }))
    expect(seed).toHaveBeenCalledWith(
      RAW_ID,
      expect.stringContaining('Lance /brainstorm sur « Agents qui communiquent »')
    )
    expect(seed.mock.calls[0]?.[1]).toContain('docs/TACHES-<Sujet>.md')
    expect(openChat).toHaveBeenCalledWith(RAW_ID)
    // Le champ se referme ; Échap le referme aussi sans rien envoyer.
    await user.click(screen.getByRole('button', { name: '✦ Nouveau brainstorm' }))
    await user.keyboard('x{Escape}')
    expect(screen.queryByLabelText('Sujet du brainstorm')).toBeNull()
    expect(seed).toHaveBeenCalledTimes(1)
  })

  it('should_offer_the_new_brainstorm_only_in_the_workflow_view', () => {
    installFakeApi({})
    wrap('progression')
    expect(screen.queryByRole('button', { name: '✦ Nouveau brainstorm' })).toBeNull()
  })

  it('should_flag_the_steps_tasks_and_decisions_put_in_progression_and_report_them_in_the_files', async () => {
    const user = userEvent.setup()
    installFakeApi({})
    const { container } = wrap('progression', {
      steps: [{ id: STEP, parentId: RAW_ID, title: 'Valider le budget', rank: 1 }],
      elements: [
        { id: TASK, parentId: RAW_ID, title: 'Profils d’agents', type: 'tache' },
        { id: CHILD, parentId: TASK, title: 'File simple', type: 'decision' }
      ]
    })
    expect(screen.getByRole('status').textContent).toMatch(
      /1 étape et 2 tâches ou décisions à reporter dans le Workflow/
    )
    await expectNoAxeViolations(container)
    await user.click(screen.getByRole('button', { name: 'Les reporter dans les fichiers' }))
    const prompt = String(seed.mock.calls[0]?.[1])
    expect(prompt).toContain('- Valider le budget')
    expect(prompt).toContain('- Tâche : Profils d’agents\n  - Décision : File simple')
    expect(prompt).toContain('les décisions dans sa doc')
    expect(openChat).toHaveBeenCalledWith(RAW_ID)
  })

  it('should_remove_the_steps_and_the_elements_in_undoable_batches', async () => {
    const user = userEvent.setup()
    const api = installFakeApi({
      'plan:removeSteps': () => ({ batchId: 'b1' }),
      'structure:removeElements': () => ({ batchId: 'b2', count: 2 })
    })
    wrap('architecture', {
      steps: [{ id: STEP, parentId: RAW_ID, title: 'Valider le budget', rank: 1 }],
      elements: [
        { id: TASK, parentId: RAW_ID, title: 'Profils d’agents', type: 'tache' },
        { id: CHILD, parentId: TASK, title: 'File simple', type: 'decision' }
      ]
    })
    await user.click(screen.getByRole('button', { name: 'Les retirer' }))
    await waitFor(() =>
      expect(api.invoke).toHaveBeenCalledWith('structure:removeElements', { genesisId: RAW_ID, elementIds: [TASK] })
    )
    expect(api.invoke).toHaveBeenCalledWith('plan:removeSteps', { stepIds: [STEP] })
    expect(useUiStore.getState().toast).toMatchObject({ undoBatchId: 'b2' })
  })

  it('should_say_nothing_when_nothing_was_put_outside_the_workflow', () => {
    installFakeApi({})
    wrap('progression')
    expect(screen.queryByRole('button', { name: 'Les retirer' })).toBeNull()
  })
})
