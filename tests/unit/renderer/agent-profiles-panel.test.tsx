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

describe('fenêtre de l’agent (L1o D21, D22)', () => {
  it('should_hide_the_agent_until_created_then_reveal_it_in_a_window_and_chat_with_it', async () => {
    const saved: unknown[] = []
    const api = installFakeApi({
      'agents:list': () => saved.map((entry) => ({ ...(entry as object), updatedAt: 0, delivered: 0 })),
      'agents:save': (payload) => {
        saved.push(payload)
        return { ...(payload as object), updatedAt: 0, delivered: 0 }
      },
      'agents:chat': () => ({ neuronId: 'tete-a-tete' })
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <AgentProfilesPanel view={VIEW} onClose={() => undefined} />
      </QueryClientProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Nouveau profil' }))
    // L'effet de surprise : rien du personnage avant le clic.
    expect(screen.queryByRole('region', { name: /^Agent minté/ })).toBeNull()
    fireEvent.change(screen.getByRole('textbox', { name: /Nom/ }), { target: { value: 'Thor' } })
    fireEvent.click(screen.getByRole('button', { name: '✦ Créer l’agent' }))
    const dialog = await screen.findByRole('dialog', { name: '« Thor » rejoint l’équipe' })
    expect(saved[0]).toMatchObject({ name: 'Thor', isNew: true, id: expect.stringMatching(/^[0-9a-f-]{36}$/) })
    expect(within(dialog).getByText('Félicitations !')).toBeDefined()
    expect(within(dialog).getByRole('region', { name: /^Agent minté : Thor, / })).toBeDefined()
    await expectNoAxeViolations(dialog)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Discuter avec lui' }))
    await waitFor(() =>
      expect(api.invoke).toHaveBeenCalledWith('agents:chat', { profileId: (saved[0] as { id: string }).id })
    )
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('should_open_the_same_window_without_celebration_when_clicking_an_agent_of_the_list', async () => {
    const thor = {
      id: '5a6b7c8d-1e2f-4a3b-8c4d-5e6f7a8b9c0d',
      name: 'Thor',
      role: 'backend',
      instructions: '',
      permissionMode: 'default',
      model: 'claude-sonnet-5-5',
      effort: 'medium',
      skills: [],
      updatedAt: 0,
      delivered: 0
    }
    installFakeApi({ 'agents:list': () => [thor] })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <AgentProfilesPanel view={VIEW} onClose={() => undefined} />
      </QueryClientProvider>
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Voir l’agent Thor' }))
    const dialog = screen.getByRole('dialog', { name: 'Thor' })
    expect(within(dialog).queryByText('Félicitations !')).toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Modifier le profil' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect((screen.getByRole('textbox', { name: /Nom/ }) as HTMLInputElement).value).toBe('Thor')
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
