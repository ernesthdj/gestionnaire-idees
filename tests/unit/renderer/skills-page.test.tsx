import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it } from 'vitest'
import { SkillsPage } from '../../../src/renderer/src/skills/SkillsPage'
import type { LibraryRepoView, SkillDetailView, SkillsView, SkillView } from '../../../src/shared/ipc/skills'
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
  filesTruncated: false,
  versions: 0
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
  it('should_show_library_repos_as_clusters_that_unfold_into_available_skills', async () => {
    const repoId = '9b1f0c1e-9a4b-4c3d-8e2f-0a1b2c3d4e5f'
    const library: LibraryRepoView[] = [
      {
        repoId,
        repo: 'https://github.com/demo/skills',
        commit: 'b'.repeat(40),
        updatedAt: 1,
        truncated: false,
        skippedCopies: 0,
        skills: [
          {
            candidateId: '1b1f0c1e-9a4b-4c3d-8e2f-0a1b2c3d4e5f',
            repoId,
            name: 'resume-reunion',
            description: 'Résume une réunion fictive.',
            files: [{ path: 'SKILL.md', size: 10, executable: false }],
            verdict: 'a_revoir',
            reasons: [],
            auditedByClaude: false,
            installed: false
          }
        ]
      }
    ]
    installFakeApi({ 'skills:list': () => VIEW, 'skills:library': () => library })
    const { container } = renderPage()
    expect(await screen.findByText(/Bibliothèque \(1\)/)).toBeTruthy()
    expect(screen.queryByText('resume-reunion')).toBeNull()
    fireEvent.click(screen.getByText('demo/skills'))
    expect(await screen.findByRole('region', { name: 'Dépôt de la bibliothèque' })).toBeTruthy()
    expect(await screen.findByText('resume-reunion')).toBeTruthy()
    expect(screen.getByText(/à revoir \(règles\)/)).toBeTruthy()
    await expectNoAxeViolations(container)
    await userEvent.click(screen.getByRole('checkbox', { name: /Bibliothèque/ }))
    expect(screen.queryByText('resume-reunion')).toBeNull()
  })
})
