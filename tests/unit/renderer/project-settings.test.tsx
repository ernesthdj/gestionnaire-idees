import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ProjectSettings } from '../../../src/renderer/src/pages/settings/ProjectSettings'
import { expectNoAxeViolations } from '../../support/axe'
import { installFakeApi } from './support/fakeApi'

describe('Réglages › Projets (spec 016 US3)', () => {
  it('should_choose_the_root_with_the_native_picker_and_say_when_it_is_a_projectmaster_workspace', async () => {
    const user = userEvent.setup()
    const api = installFakeApi({
      'project:settings': () => ({ root: null, hub: false }),
      'project:chooseRoot': () => ({ root: 'C:/ProjectsMaster/projects', hub: true })
    })
    const { container } = render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ProjectSettings />
      </QueryClientProvider>
    )
    expect(await screen.findByText(/Aucune racine choisie/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Choisir la racine…' }))
    expect(api.invoke).toHaveBeenCalledWith('project:chooseRoot', undefined)
    expect(await screen.findByText('C:/ProjectsMaster/projects')).toBeTruthy()
    expect(screen.getByText(/Workspace ProjectMaster détecté/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Changer la racine…' })).toBeTruthy()
    await expectNoAxeViolations(container)
  })
})
