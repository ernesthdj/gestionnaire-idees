import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { ExplorerPage } from '../../../src/renderer/src/explorer/ExplorerPage'
import type { ExplorerNodeDetailView, ExplorerView, RepriseProjectView } from '../../../src/shared/ipc/reprise'
import { expectNoAxeViolations } from '../../support/axe'
import { installFakeApi } from './support/fakeApi'
import { installReactFlowMocks } from './support/reactFlowMocks'

const GENESIS = '00000000-0000-4000-8000-0000000000f5'
const SYMBOL = 'a'.repeat(32)

const project = (extra: Partial<RepriseProjectView['analysis']> = {}): RepriseProjectView => ({
  genesisId: GENESIS,
  name: 'cs-app',
  source: 'folder',
  confidentiality: 'local',
  remote: null,
  folderMissing: false,
  analysis: { state: 'idle', progress: null, stats: null, analyzedAt: '2026-10-07T08:00:00.000Z', ...extra }
})

const top: ExplorerView = {
  level: 1,
  breadcrumb: [{ key: '', title: 'Projet' }],
  nodes: [
    {
      key: 'm:dir:Controllers',
      level: 1,
      kind: 'module',
      title: 'Controllers',
      category: 'orchestration',
      lang: null,
      childCount: 1,
      x: 0,
      y: 0
    },
    {
      key: 'm:dir:Domain',
      level: 1,
      kind: 'module',
      title: 'Domain',
      category: 'domain',
      lang: null,
      childCount: 2,
      x: 280,
      y: 0
    }
  ],
  edges: [{ from: 'm:dir:Controllers', to: 'm:dir:Domain', count: 3, provenance: 'syntax' }],
  grouped: [],
  hidden: { plumbingCalls: 4, nodes: 1 },
  confidentiality: 'local',
  folderMissing: false
}
const domain: ExplorerView = {
  ...top,
  level: 2,
  breadcrumb: [
    { key: '', title: 'Projet' },
    { key: 'm:dir:Domain', title: 'Domain' }
  ],
  nodes: [
    {
      key: `s:${SYMBOL}`,
      level: 2,
      kind: 'method',
      title: 'Place',
      category: 'domain',
      lang: 'cs',
      childCount: 0,
      x: 0,
      y: 0
    }
  ],
  edges: []
}
const detail: ExplorerNodeDetailView = {
  key: `s:${SYMBOL}`,
  parentKey: 'm:dir:Domain',
  kind: 'method',
  title: 'Place',
  path: 'Domain/OrderService.cs',
  category: 'domain',
  categorySource: 'rules',
  lang: 'cs',
  lines: 8,
  summary: null,
  analogy: null,
  callers: [{ key: 's:b', title: 'Shop.Controllers.OrdersController.Post', provenance: 'syntax', reason: null }],
  callees: [{ key: 's:c', title: 'Shop.Domain.Stores.Resolve', provenance: 'uncertain', reason: '4 cibles possibles' }],
  error: null
}

function renderExplorer(projectView: RepriseProjectView = project()) {
  const api = installFakeApi({
    'reprise:get': () => projectView,
    'explorer:state': () => ({
      parentKey: '',
      filters: { categories: ['domain', 'orchestration', 'infrastructure'], langs: [], hideUncertain: false }
    }),
    'explorer:view': (payload) => ((payload as { parentKey: string }).parentKey === '' ? top : domain),
    'explorer:node': () => detail,
    'explorer:code': () => ({
      path: 'Domain/OrderService.cs',
      startLine: 20,
      lines: ['public decimal Place()', '{'],
      lang: 'cs'
    }),
    'explorer:search': () => ({
      results: [{ key: `s:${SYMBOL}`, parentKey: 'm:dir:Domain', title: 'Place', path: 'Domain' }]
    }),
    'explorer:saveState': () => ({ ok: true }),
    'reprise:setCategory': () => ({ ok: true }),
    'reprise:analyze': () => ({ runId: 'r1' })
  })
  const onClose = vi.fn()
  const result = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ExplorerPage genesisId={GENESIS} onClose={onClose} />
    </QueryClientProvider>
  )
  return { api, onClose, ...result }
}

describe('explorateur d’un projet repris (spec 017 US2)', () => {
  beforeAll(() => installReactFlowMocks())

  it('should_show_the_modules_the_level_the_hidden_counts_and_the_confidentiality', async () => {
    const { container } = renderExplorer()
    expect(await screen.findByText('Controllers')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Local uniquement/ })).toBeTruthy()
    expect(screen.getByLabelText('Niveau 1 sur 4').textContent).toContain('1 Modules')
    expect(await screen.findByText(/1 masqués par les filtres · 4 appels de plomberie masqués/)).toBeTruthy()
    await expectNoAxeViolations(container)
  })

  it('should_open_a_module_from_the_list_view_and_remember_it', async () => {
    const user = userEvent.setup()
    const { api } = renderExplorer()
    await user.click(await screen.findByRole('button', { name: 'Vue liste' }))
    const list = screen.getByRole('region', { name: 'Éléments de ce niveau' })
    expect(screen.getByRole('region', { name: 'Appels entre ces éléments' }).textContent).toContain(
      'Controllers → Domain : 3 appels, sûr'
    )
    await user.click(within(list).getByRole('button', { name: 'Ouvrir (2)' }))
    expect(api.invoke).toHaveBeenCalledWith('explorer:view', expect.objectContaining({ parentKey: 'm:dir:Domain' }))
    expect(api.invoke).toHaveBeenCalledWith(
      'explorer:saveState',
      expect.objectContaining({ parentKey: 'm:dir:Domain' })
    )
    expect(await screen.findByRole('button', { name: 'Projet' })).toBeTruthy()
  })

  it('should_show_who_calls_an_element_its_code_and_let_mentalyas_correct_its_category', async () => {
    const user = userEvent.setup()
    const { api, container } = renderExplorer()
    await user.click(await screen.findByRole('button', { name: 'Vue liste' }))
    await user.click(
      within(screen.getByRole('region', { name: 'Éléments de ce niveau' })).getByRole('button', { name: 'Ouvrir (2)' })
    )
    await user.click(
      within(await screen.findByRole('region', { name: 'Éléments de ce niveau' })).getByRole('button', {
        name: /Place/
      })
    )
    const panel = await screen.findByRole('complementary', { name: 'Élément choisi' })
    expect(await within(panel).findByText('Shop.Controllers.OrdersController.Post')).toBeTruthy()
    expect(within(panel).getByText(/incertain — 4 cibles possibles/)).toBeTruthy()
    await user.selectOptions(within(panel).getByLabelText('Corriger la catégorie'), 'infrastructure')
    expect(api.invoke).toHaveBeenCalledWith('reprise:setCategory', {
      genesisId: GENESIS,
      symbolId: SYMBOL,
      category: 'infrastructure'
    })
    await user.click(within(panel).getByRole('tab', { name: 'Code' }))
    expect((await within(panel).findByText(/lecture seule/)).textContent).toContain('lignes 20 à 21')
    await expectNoAxeViolations(container)
  })

  it('should_filter_categories_and_jump_to_a_search_result', async () => {
    const user = userEvent.setup()
    const { api } = renderExplorer()
    await screen.findByText('Controllers')
    await user.click(screen.getByRole('checkbox', { name: /Plomberie/ }))
    expect(api.invoke).toHaveBeenCalledWith(
      'explorer:view',
      expect.objectContaining({
        filters: expect.objectContaining({ categories: expect.arrayContaining(['plumbing']) })
      })
    )
    await user.type(screen.getByLabelText('Rechercher un élément'), 'Pla')
    await user.click(await screen.findByRole('button', { name: /^Place/ }))
    expect(api.invoke).toHaveBeenCalledWith('explorer:view', expect.objectContaining({ parentKey: 'm:dir:Domain' }))
  })

  it('should_offer_to_analyze_a_project_never_analyzed_and_go_back_to_the_map', async () => {
    const user = userEvent.setup()
    const { api, onClose } = renderExplorer(project({ analyzedAt: null }))
    await user.click(await screen.findByRole('button', { name: 'Analyser' }))
    expect(api.invoke).toHaveBeenCalledWith('reprise:analyze', { genesisId: GENESIS })
    await user.click(screen.getByRole('button', { name: '← Carte' }))
    expect(onClose).toHaveBeenCalled()
  })
})
