import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AgentProfilesPanel } from '../../../src/renderer/src/skills/AgentProfilesPanel'
import type { SkillsView } from '../../../src/shared/ipc/skills'
import { expectNoAxeViolations } from '../../support/axe'
import { installFakeApi } from './support/fakeApi'

const VIEW = {
  skills: [
    { id: 'perso:tests', name: 'tests', family: 'perso' },
    { id: 'perso:revue', name: 'revue', family: 'perso' }
  ],
  links: []
} as unknown as SkillsView

const setup = () => {
  const api = installFakeApi({
    'agents:list': () => [],
    'agents:conversation': () => ({ neuronId: 'n1' })
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={client}>
      <AgentProfilesPanel view={VIEW} onClose={() => undefined} />
    </QueryClientProvider>
  )
  return { api, view }
}

describe('agent minté à la création (L1o D21)', () => {
  it('should_show_the_minted_agent_and_create_it_with_the_previewed_id', async () => {
    const saved: unknown[] = []
    installFakeApi({
      'agents:list': () => [],
      'agents:save': (payload) => {
        saved.push(payload)
        return payload
      }
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <AgentProfilesPanel view={VIEW} onClose={() => undefined} />
      </QueryClientProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Nouveau profil' }))
    const card = screen.getByRole('region', { name: /^Agent minté : sans nom, .+, rang / })
    expect(card.textContent).toContain('Univers')
    fireEvent.change(screen.getByRole('textbox', { name: /Nom/ }), { target: { value: 'Thor' } })
    expect(screen.getByRole('region', { name: /^Agent minté : Thor, / })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: '✦ Créer l’agent' }))
    await waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0]).toMatchObject({ name: 'Thor', isNew: true, id: expect.stringMatching(/^[0-9a-f-]{36}$/) })
  })
})

describe('créer un profil d’agent avec Claude (L1o D15)', () => {
  it('should_fill_the_form_with_marked_fields_when_claude_proposes_then_unmark_a_field_touched_by_hand', async () => {
    const { api, view } = setup()
    fireEvent.click(screen.getByRole('button', { name: '✦ Créer avec Claude' }))
    // La conversation s'ouvre à côté de la fiche.
    await screen.findByRole('region', { name: /^Conversation/ })
    // La fiche s'abonne aux propositions de cette conversation au rendu suivant.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(api.invoke).toHaveBeenCalledWith('agents:conversation', {})
    // La proposition d'une autre conversation est ignorée.
    act(() => api.emit('agents:proposal', { neuronId: 'autre', fields: { name: 'Intrus' }, why: null }))
    act(() =>
      api.emit('agents:proposal', {
        neuronId: 'n1',
        fields: { name: 'Chef QA', role: 'qa', skills: ['perso:tests'] },
        why: 'Il relit les tests avant la fusion.'
      })
    )
    const name = screen.getByRole('textbox', { name: /Nom/ })
    expect((name as HTMLInputElement).value).toBe('Chef QA')
    expect((screen.getByRole('checkbox', { name: 'tests' }) as HTMLInputElement).checked).toBe(true)
    expect(screen.getByText('Il relit les tests avant la fusion.')).toBeDefined()
    expect(screen.getAllByText('proposé par Claude')).toHaveLength(3)
    // mentalyas retouche le nom : la marque ✦ s'en va, les autres restent.
    fireEvent.change(name, { target: { value: 'Chef qualité' } })
    expect(screen.getAllByText('proposé par Claude')).toHaveLength(2)
    expect(within(name.closest('label') as HTMLElement).queryByText('proposé par Claude')).toBeNull()
    await expectNoAxeViolations(view.container)
  })
})
