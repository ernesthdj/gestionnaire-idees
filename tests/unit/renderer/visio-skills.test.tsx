import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { applySkills, SkillsCards, useSkillsOfVisio } from '../../../src/renderer/src/canvas/agents/VisioSkills'
import type { AgentProfileView, AgentSkillsProposal } from '../../../src/shared/agents/profile'
import { expectNoAxeViolations } from '../../support/axe'
import { installFakeApi } from './support/fakeApi'

const PROFILE: AgentProfileView = {
  id: '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f',
  name: 'Qualité',
  role: 'qa',
  instructions: 'Relis les tests.',
  permissionMode: 'acceptEdits',
  model: 'claude-sonnet-5-5',
  effort: 'medium',
  skills: ['perso:revue'],
  updatedAt: 0,
  delivered: 0
}
const PROPOSAL: AgentSkillsProposal = {
  neuronId: 'visio',
  profileId: PROFILE.id,
  add: ['perso:tests'],
  remove: ['perso:revue'],
  why: 'Il lance les tests e2e.'
}

function Harness(): React.JSX.Element {
  const skills = useSkillsOfVisio('visio', PROFILE, 1_000)
  return <SkillsCards skills={skills} onOpenDraft={() => undefined} />
}

describe('skills d’un agent peaufinés en visio (L1o D16)', () => {
  it('should_replace_removed_skills_and_add_new_ones_once_when_applying_a_proposal', () => {
    expect(applySkills(['perso:revue', 'perso:a'], PROPOSAL)).toEqual(['perso:a', 'perso:tests'])
    expect(applySkills(['perso:tests'], { ...PROPOSAL, remove: [] })).toEqual(['perso:tests'])
  })

  it('should_show_the_proposal_and_save_the_profile_only_when_accepted', async () => {
    const saved: unknown[] = []
    const api = installFakeApi({
      'skills:list': () => ({
        skills: [
          { id: 'perso:tests', name: 'tests', family: 'perso' },
          { id: 'perso:revue', name: 'revue', family: 'perso' }
        ],
        links: []
      }),
      'skills:drafts': () => [
        { id: 'd1', skillId: 'perso:tests', name: 'tests', origin: 'claude', isNew: false, updatedAt: 2_000 },
        { id: 'd2', skillId: 'perso:autre', name: 'autre', origin: 'claude', isNew: false, updatedAt: 10 }
      ],
      'agents:save': (payload) => {
        saved.push(payload)
        return payload
      }
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const view = render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>
    )
    // Le brouillon déposé pendant l'appel est proposé ; l'ancien d'un autre skill ne l'est pas.
    await screen.findByText(/Brouillon de/)
    expect(screen.getAllByRole('button', { name: 'Voir et installer' })).toHaveLength(1)
    act(() => api.emit('agents:skillsProposal', { ...PROPOSAL, neuronId: 'autre-appel' }))
    act(() => api.emit('agents:skillsProposal', PROPOSAL))
    await screen.findByText(/Ajouter tests · Retirer revue/)
    expect(screen.getByText('Il lance les tests e2e.')).toBeDefined()
    expect(saved).toEqual([])
    await expectNoAxeViolations(view.container)
    fireEvent.click(screen.getByRole('button', { name: 'Accepter' }))
    await waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0]).toMatchObject({ id: PROFILE.id, name: 'Qualité', skills: ['perso:tests'] })
    await waitFor(() => expect(screen.queryByText(/Ajouter tests/)).toBeNull())
  })
})
