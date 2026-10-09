import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { BrainstormOpenView } from '../../../src/shared/ipc/brainstorms'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { CloneProject } from '../../../src/renderer/src/home/CloneProject'
import { expectNoAxeViolations } from '../../support/axe'
import { FakeIpcError, installFakeApi } from './support/fakeApi'

const B = '00000000-0000-4000-8000-0000000000e1'

const opened: BrainstormOpenView = {
  brainstorm: {
    id: B,
    slug: 'recettes',
    name: 'recettes',
    description: '',
    location: 'vault',
    folder: 'C:\\coffre\\projects\\recettes',
    genesisId: null
  },
  viewState: null,
  anomalies: [],
  journal: []
}

function renderClone(handlers: Parameters<typeof installFakeApi>[0], root: string | null = 'C:\\coffre\\projects') {
  const fake = installFakeApi({ 'brainstorms:viewState': () => ({ ok: true }), ...handlers })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(
    <QueryClientProvider client={client}>
      <CloneProject root={root} />
    </QueryClientProvider>
  )
  return { ...fake, ...result }
}

describe('depuis un lien Git (spec 024 T029, US5)', () => {
  beforeEach(() => useUiStore.setState({ brainstorm: null, view: 'home' }))

  it('should_check_the_link_while_typing_and_refuse_dangerous_forms', async () => {
    const user = userEvent.setup()
    const { container } = renderClone({})
    const link = screen.getByLabelText('Lien du dépôt')
    await user.type(link, 'file:///C:/secret')
    expect(screen.getByText(/Seuls les liens https/)).toBeDefined()
    await user.clear(link)
    await user.type(link, '--upload-pack=calc')
    expect(screen.getByText(/option de commande/)).toBeDefined()
    expect(screen.getByRole('button', { name: 'Cloner dans le coffre et ouvrir' })).toHaveProperty('disabled', true)
    await expectNoAxeViolations(container)
  })

  it('should_propose_the_name_from_the_link_clone_with_progress_and_open_the_canvas', async () => {
    const user = userEvent.setup()
    let finish: (value: unknown) => void = () => undefined
    const { invoke, emit } = renderClone({
      'brainstorms:clone': () => new Promise((done) => (finish = done)),
      'brainstorms:open': () => opened
    })
    await user.type(screen.getByLabelText('Lien du dépôt'), 'https://user:jeton@github.com/compte/Recettes.git')
    expect(screen.getByText(/l’identifiant du lien ne sera ni affiché ni gardé/)).toBeDefined()
    expect((screen.getByLabelText('Nom') as HTMLInputElement).value).toBe('Recettes')
    expect((screen.getByLabelText('Nom du dossier') as HTMLInputElement).value).toBe('recettes')
    await user.selectOptions(screen.getByLabelText('Type'), 'Web App')
    // La confidentialité se choisit, sans valeur par défaut.
    expect(screen.getByRole('button', { name: 'Cloner dans le coffre et ouvrir' })).toHaveProperty('disabled', true)
    await user.click(screen.getByLabelText(/Local uniquement/))
    await user.click(screen.getByRole('button', { name: 'Cloner dans le coffre et ouvrir' }))
    act(() => emit('brainstorms:cloneProgress', { phase: 'reception', percent: 42 }))
    act(() => emit('brainstorms:cloneLarge', { receivedBytes: 600 * 1024 * 1024 }))
    expect(await screen.findByText(/dépasse 500 Mo \(600 Mo reçus\)/)).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'Continuer' }))
    expect(screen.queryByText(/dépasse 500 Mo/)).toBeNull()
    expect(await screen.findByText('Réception des objets · 42 %')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Annuler le clone' })).toBeDefined()
    act(() => finish({ id: B }))
    await waitFor(() => expect(useUiStore.getState().brainstorm?.id).toBe(B))
    expect(invoke).toHaveBeenCalledWith('brainstorms:clone', {
      url: 'https://user:jeton@github.com/compte/Recettes.git',
      name: 'Recettes',
      slug: 'recettes',
      type: 'Web App',
      full: false,
      confidentiality: 'local'
    })
  })

  it('should_explain_a_failed_clone', async () => {
    const user = userEvent.setup()
    renderClone({
      'brainstorms:clone': () => {
        throw new FakeIpcError('CLONE_NOT_FOUND')
      }
    })
    await user.type(screen.getByLabelText('Lien du dépôt'), 'https://github.com/compte/absent.git')
    await user.selectOptions(screen.getByLabelText('Type'), 'Web App')
    await user.click(screen.getByLabelText(/Claude autorisé/))
    await user.click(screen.getByRole('button', { name: 'Cloner dans le coffre et ouvrir' }))
    expect((await screen.findByRole('alert')).textContent).toBe('CLONE_NOT_FOUND')
  })
})
