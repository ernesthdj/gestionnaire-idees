import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import type { StructureBarNodeType } from '../../../src/renderer/src/canvas/buildGraph'
import { useMapping } from '../../../src/renderer/src/canvas/mapping/mappingStore'
import { StructureBarNode } from '../../../src/renderer/src/canvas/nodes/StructureBarNode'
import { expectNoAxeViolations } from '../../support/axe'
import { RAW_ID } from '../../fixtures/ui/canvas'
import { FakeIpcError, installFakeApi } from './support/fakeApi'

const wrap = (hasMap: boolean) => {
  const props = { data: { genesisId: RAW_ID, view: 'progression', hasMap, architecture: null } }
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ReactFlowProvider>
        <StructureBarNode {...(props as unknown as NodeProps<StructureBarNodeType>)} />
      </ReactFlowProvider>
    </QueryClientProvider>
  )
}

describe('« Mettre à jour la carte » (spec 022, 2026-10-10)', () => {
  beforeEach(() => {
    useUiStore.setState({ toast: null })
    useMapping.setState({ phases: {} })
  })

  it('should_send_the_update_instructions_to_the_genesis_conversation_and_show_the_mapping_running', async () => {
    const user = userEvent.setup()
    const api = installFakeApi({
      'structure:updatePlan': () => ({ prompt: 'Mets à jour la carte…', files: 4, since: 'cartographie' }),
      'chat:send': () => ({ ok: true })
    })
    const { container } = wrap(true)
    await expectNoAxeViolations(container)
    await user.click(screen.getByRole('button', { name: 'Mettre à jour la carte' }))
    await waitFor(() =>
      expect(api.invoke).toHaveBeenCalledWith('chat:send', { neuronId: RAW_ID, text: 'Mets à jour la carte…' })
    )
    expect(useMapping.getState().phases[RAW_ID]).toBe('running')
    expect(useUiStore.getState().toast?.text).toMatch(/4 fichier\(s\) changé\(s\)/)
    expect(screen.getByRole('button', { name: 'Mise à jour de la carte en cours' })).toHaveProperty('disabled', true)
  })

  it('should_say_the_map_is_up_to_date_without_calling_claude', async () => {
    const user = userEvent.setup()
    const api = installFakeApi({ 'structure:updatePlan': () => ({ prompt: null, files: 0, since: 'cartographie' }) })
    wrap(true)
    await user.click(screen.getByRole('button', { name: 'Mettre à jour la carte' }))
    await waitFor(() => expect(useUiStore.getState().toast?.text).toMatch(/la carte est à jour/))
    expect(api.invoke).not.toHaveBeenCalledWith('chat:send', expect.anything())
  })

  it('should_explain_a_refusal_and_hide_the_button_without_a_map', async () => {
    const user = userEvent.setup()
    installFakeApi({
      'structure:updatePlan': () => {
        throw new FakeIpcError('LOCAL_ONLY')
      }
    })
    const { unmount } = wrap(true)
    await user.click(screen.getByRole('button', { name: 'Mettre à jour la carte' }))
    await waitFor(() => expect(useUiStore.getState().toast?.text).toBe('LOCAL_ONLY'))
    expect(useMapping.getState().phases[RAW_ID]).toBeUndefined()
    unmount()
    wrap(false)
    expect(screen.queryByRole('button', { name: 'Mettre à jour la carte' })).toBeNull()
  })
})
