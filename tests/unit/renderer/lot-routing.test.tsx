import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AgentProfileView } from '../../../src/shared/agents/profile'
import type { AssemblySketchView } from '../../../src/shared/ipc/assemblies'
import { LotRouting } from '../../../src/renderer/src/canvas/agents/LotRouting'
import { expectNoAxeViolations } from '../../support/axe'

const profile = (id: string, name: string): AgentProfileView =>
  ({ id, name, role: 'backend', skills: [] }) as unknown as AgentProfileView

const SKETCH: AssemblySketchView = {
  nodeId: 'wf:g:tgroup:lot1',
  genesisId: 'g',
  taskId: 'T-lot1',
  agents: [
    { id: 'dev', profileId: 'p-dev' },
    { id: 'qa', profileId: 'p-qa' }
  ],
  links: [],
  lot: {
    plan: {
      steps: [
        { task: 'T001', agents: ['Développeur', 'Qualité'], waits: [{ agent: 'Qualité', after: 'Développeur' }] },
        { task: 'T002', agents: ['Développeur', 'Designer'], waits: [] }
      ],
      rhythm: { mode: 'tout', reason: 'deux tris simples' }
    },
    overrides: [{ task: 'T002', agents: ['dev'], links: [] }]
  }
}

describe('aiguillage du lot dans le volet Agents (L1o D25, T023)', () => {
  it('should_show_the_po_routing_and_advice_then_save_a_hand_routing_when_edited', async () => {
    const onRoute = vi.fn()
    const { container } = render(
      <LotRouting
        sketch={SKETCH}
        profiles={[profile('p-dev', 'Développeur'), profile('p-qa', 'Qualité')]}
        disabled={false}
        onRoute={onRoute}
      />
    )
    const section = screen.getByRole('region', { name: 'Aiguillage du lot' })
    expect(section.textContent).toContain('Le PO conseille : tout le lot — deux tris simples')
    expect(section.textContent).toContain('Qualité attend Développeur')
    expect(section.textContent).toContain('✦ plan du PO')
    // T002 retouchée : le Designer manquant n'est plus signalé, la retouche peut être rendue au PO.
    expect(section.textContent).toContain('retouché')
    fireEvent.click(screen.getByRole('button', { name: 'Rendre au PO' }))
    expect(onRoute).toHaveBeenCalledWith('T002', null)
    await expectNoAxeViolations(container)

    fireEvent.click(screen.getAllByRole('button', { name: 'Modifier' })[0] as HTMLElement)
    const editor = screen.getByRole('group', { name: 'Qui intervient, et qui il attend' })
    fireEvent.click(within(editor).getByRole('checkbox', { name: 'attend Développeur' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(onRoute).toHaveBeenLastCalledWith('T001', { agents: ['dev', 'qa'], links: [] })
  })
})
