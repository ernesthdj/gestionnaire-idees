import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it } from 'vitest'
import { SkillsPage } from '../../../src/renderer/src/skills/SkillsPage'
import type { SkillDetailView, SkillsView, SkillView } from '../../../src/shared/ipc/skills'
import { expectNoAxeViolations } from '../../support/axe'
import { installFakeApi } from './support/fakeApi'
import { installReactFlowMocks } from './support/reactFlowMocks'

const skill = (id: string, extra: Partial<SkillView> = {}): SkillView => ({
  id,
  family: id.startsWith('plugin') ? 'plugin' : id.startsWith('projet') ? 'projet' : 'perso',
  name: id.split(':').at(-1) ?? id,
  description: `Description fictive de ${id}`,
  origin: 'personnel',
  hasScripts: false,
  damaged: false,
  sameNameAs: [],
  modifiedAt: 1,
  contentHash: 'abc',
  ...extra
})

const VIEW: SkillsView = {
  skills: [
    skill('perso:hub'),
    skill('perso:graphify'),
    skill('perso:outil-script', { hasScripts: true }),
    skill('perso:abime', { damaged: true, description: '' }),
    skill('plugin:m/p:deploy', { origin: 'plugin p 1.2.0' }),
    skill('plugin:m/p:env', { origin: 'plugin p 1.2.0' })
  ],
  links: [{ from: 'perso:hub', to: 'perso:graphify', kind: 'appelle', line: 2 }],
  scannedAt: 1
}

const DETAIL: SkillDetailView = {
  skill: VIEW.skills[0] as SkillView,
  markdown: '# Hub\n\nLance `/graphify`. <img src=x onerror=alert(1)>',
  files: [{ path: 'SKILL.md', size: 2048, executable: false }],
  filesTruncated: false
}

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SkillsPage />
    </QueryClientProvider>
  )

describe('page Skills (spec 020 T010)', () => {
  beforeAll(() => installReactFlowMocks())

  it('should_show_one_node_per_skill_with_family_marks_and_fold_plugins_into_a_cluster', async () => {
    installFakeApi({ 'skills:list': () => VIEW })
    const { container } = renderPage()
    expect(await screen.findByText('hub')).toBeTruthy()
    expect(screen.getByText('⚠ scripts')).toBeTruthy()
    expect(screen.getByText('abîmé')).toBeTruthy()
    // Les skills de plugins sont repliés en une grappe.
    expect(screen.queryByText('deploy')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /2 skills de plugins/ }))
    expect(await screen.findByText('deploy')).toBeTruthy()
    await expectNoAxeViolations(container)
  })

  it('should_filter_by_family_and_by_search', async () => {
    installFakeApi({ 'skills:list': () => VIEW })
    renderPage()
    await screen.findByText('hub')
    await userEvent.click(screen.getByRole('checkbox', { name: /Personnel/ }))
    expect(screen.queryByText('hub')).toBeNull()
    await userEvent.click(screen.getByRole('checkbox', { name: /Personnel/ }))
    await userEvent.type(screen.getByRole('searchbox', { name: 'Chercher un skill' }), 'graph')
    expect(screen.queryByText('hub')).toBeNull()
    expect(screen.getByText('graphify')).toBeTruthy()
  })

  it('should_open_the_sheet_of_a_skill_with_its_links_source_and_files_without_rendering_html', async () => {
    installFakeApi({ 'skills:list': () => VIEW, 'skills:get': () => DETAIL })
    const { container } = renderPage()
    fireEvent.click(await screen.findByText('hub'))
    const sheet = await screen.findByRole('region', { name: 'Fiche du skill' })
    expect(await within(sheet).findByRole('button', { name: 'graphify' })).toBeTruthy()
    await userEvent.click(within(sheet).getByRole('tab', { name: 'SKILL.md' }))
    expect(container.querySelector('img')).toBeNull()
    await userEvent.click(within(sheet).getByRole('tab', { name: 'Fichiers' }))
    expect(within(sheet).getByText('2,0 Ko')).toBeTruthy()
    await expectNoAxeViolations(container)
  })
})
