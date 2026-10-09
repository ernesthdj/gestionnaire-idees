import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { BrainstormOpenView, ExistingPreview } from '../../../src/shared/ipc/brainstorms'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { ExistingProject } from '../../../src/renderer/src/home/ExistingProject'
import { expectNoAxeViolations } from '../../support/axe'
import { installFakeApi } from './support/fakeApi'

const PICK = '00000000-0000-4000-8000-0000000000d1'
const B = '00000000-0000-4000-8000-0000000000d2'

const preview = (extra: Partial<ExistingPreview> = {}): ExistingPreview => ({
  pickId: PICK,
  folder: 'D:\\travail\\projet-groupe',
  suggestedName: 'projet-groupe',
  writes: ['.brainstormer/brainstorm.json', '.brainstormer/sessions.json', '.gitignore (créé)'],
  vault: 'none',
  isRepo: true,
  branch: 'dev',
  problem: null,
  ...extra
})

const opened: BrainstormOpenView = {
  brainstorm: {
    id: B,
    slug: 'projet-groupe',
    name: 'Projet de groupe',
    description: '',
    location: 'external',
    folder: 'D:\\travail\\projet-groupe',
    genesisId: null
  },
  viewState: null,
  anomalies: [],
  journal: []
}

function renderExisting(handlers: Parameters<typeof installFakeApi>[0]) {
  const api = installFakeApi({ 'brainstorms:viewState': () => ({ ok: true }), ...handlers })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(
    <QueryClientProvider client={client}>
      <ExistingProject />
    </QueryClientProvider>
  )
  return { api, ...result }
}

describe('projet en chantier (spec 024 T026, US4)', () => {
  beforeEach(() => useUiStore.setState({ brainstorm: null, view: 'home' }))

  it('should_show_the_writes_before_anything_then_adopt_with_the_chosen_role', async () => {
    const user = userEvent.setup()
    const { api, container } = renderExisting({
      'brainstorms:pickExisting': () => preview(),
      'brainstorms:adoptExisting': () => ({ id: B }),
      'brainstorms:open': () => opened
    })
    await user.click(screen.getByRole('button', { name: 'Choisir le dossier du projet…' }))
    expect(await screen.findByText('Dépôt git · branche dev')).toBeDefined()
    expect(screen.getByRole('list', { name: 'Écritures prévues' }).textContent).toContain('.gitignore (créé)')
    expect((screen.getByLabelText('Mon propre dépôt') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText(/Collaborateur/) as HTMLInputElement).disabled).toBe(true)
    await expectNoAxeViolations(container)
    await user.clear(screen.getByLabelText('Nom'))
    await user.type(screen.getByLabelText('Nom'), 'Projet de groupe')
    expect(api.invoke).not.toHaveBeenCalledWith('brainstorms:adoptExisting', expect.anything())
    await user.click(screen.getByRole('button', { name: 'Poser le vault et ouvrir' }))
    await waitFor(() => expect(useUiStore.getState().brainstorm?.id).toBe(B))
    expect(api.invoke).toHaveBeenCalledWith('brainstorms:adoptExisting', {
      pickId: PICK,
      name: 'Projet de groupe',
      description: '',
      role: 'owner'
    })
  })

  it('should_explain_a_refused_folder_and_offer_no_adoption', async () => {
    const user = userEvent.setup()
    renderExisting({
      'brainstorms:pickExisting': () =>
        preview({ problem: 'Un dossier système ne peut pas être un projet.', writes: [] })
    })
    await user.click(screen.getByRole('button', { name: 'Choisir le dossier du projet…' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/dossier système/)
    expect(screen.queryByRole('button', { name: 'Poser le vault et ouvrir' })).toBeNull()
  })

  it('should_preselect_no_repo_for_a_folder_without_git', async () => {
    const user = userEvent.setup()
    renderExisting({ 'brainstorms:pickExisting': () => preview({ isRepo: false, branch: null }) })
    await user.click(screen.getByRole('button', { name: 'Choisir le dossier du projet…' }))
    expect(await screen.findByText('Pas de dépôt git')).toBeDefined()
    expect((screen.getByLabelText('Pas de dépôt git pour l’instant') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('Mon propre dépôt') as HTMLInputElement).disabled).toBe(true)
  })
})
