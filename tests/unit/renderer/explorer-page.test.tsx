import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { ExplorerPage } from '../../../src/renderer/src/explorer/ExplorerPage'
import type { ExplorerMarks } from '../../../src/renderer/src/app/uiStore'
import type {
  ExplorerMapView,
  ExplorerNodeDetailView,
  ExplorerView,
  FileCodeView,
  MapFileView,
  RepriseProjectView
} from '../../../src/shared/ipc/reprise'
import { expectNoAxeViolations } from '../../support/axe'
import { FakeIpcError, installFakeApi } from './support/fakeApi'
import { installReactFlowMocks } from './support/reactFlowMocks'

const GENESIS = '00000000-0000-4000-8000-0000000000f5'
const SYMBOL = 'a'.repeat(32)

const project = (
  extra: Partial<RepriseProjectView['analysis']> = {},
  guide: RepriseProjectView['guide'] = { documentId: null, running: false },
  resolution: RepriseProjectView['resolution'] = { running: false, pending: 0 }
): RepriseProjectView => ({
  genesisId: GENESIS,
  name: 'cs-app',
  source: 'folder',
  confidentiality: 'local',
  remote: null,
  folderMissing: false,
  analysis: { state: 'idle', progress: null, stats: null, analyzedAt: '2026-10-07T08:00:00.000Z', ...extra },
  guide,
  resolution,
  architecture: null
})
const GUIDE = [
  '# Guide de reprise — cs-app',
  '',
  '## 1. En une phrase',
  '',
  '*Comme une boutique et son arrière-boutique.*',
  '',
  'Lance `npm start`.',
  '',
  '**Sources :** `Domain/OrderService.cs`',
  '',
  '> ⚠️ Introuvables dans le projet, retirées des sources : `src/Invente.cs`'
].join('\n')

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
      files: [],
      hiddenFiles: 0,
      folders: [],
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
      files: [],
      hiddenFiles: 0,
      folders: [{ key: 'd:Domain/Stores', title: 'Stores' }],
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
const mapFile = (path: string, extra: Partial<MapFileView> = {}): MapFileView => ({
  key: `f:${path}`,
  path,
  moduleKey: `m:dir:${path.split('/')[0] ?? ''}`,
  title: path.split('/').at(-1) ?? path,
  folder: '',
  lang: 'cs',
  lines: 20,
  role: null,
  functions: [],
  depth: 0,
  external: false,
  plumbing: false,
  ...extra
})
/** Carte en boîtes (spec 031) : contrôleur → domaine (deux fichiers qui s'appellent), journal en plomberie. */
const MAP: ExplorerMapView = {
  modules: [
    {
      key: 'm:dir:Controllers',
      title: 'Controllers',
      layer: 'entry',
      plumbing: false,
      role: 'Reçoit les commandes.',
      column: 0,
      files: 1,
      lines: 24
    },
    {
      key: 'm:dir:Domain',
      title: 'Domain',
      layer: 'rules',
      plumbing: false,
      role: 'Le cœur métier.',
      column: 1,
      files: 2,
      lines: 35
    },
    {
      key: 'm:dir:Logging',
      title: 'Logging',
      layer: 'data',
      plumbing: true,
      role: null,
      column: 2,
      files: 1,
      lines: 12
    }
  ],
  files: [
    mapFile('Controllers/OrdersController.cs', { functions: ['Post'], external: true }),
    mapFile('Domain/OrderService.cs', { role: 'Passe la commande.', functions: ['Place'], external: true }),
    mapFile('Domain/Stores.cs', { functions: ['Resolve'], depth: 1 }),
    mapFile('Logging/AuditLog.cs', { plumbing: true })
  ],
  calls: [
    {
      from: 'f:Controllers/OrdersController.cs',
      to: 'f:Domain/OrderService.cs',
      count: 3,
      provenance: 'syntax',
      sentences: [
        { from: 'OrdersController.Post', to: 'OrderService.Place', kind: 'call', provenance: 'syntax', alternatives: 0 }
      ]
    },
    {
      from: 'f:Domain/OrderService.cs',
      to: 'f:Domain/Stores.cs',
      count: 1,
      provenance: 'syntax',
      sentences: [
        { from: 'OrderService.Archive', to: 'Stores.Resolve', kind: 'call', provenance: 'syntax', alternatives: 0 }
      ]
    }
  ],
  truncated: false,
  confidentiality: 'local',
  folderMissing: false
}
const detail: ExplorerNodeDetailView = {
  key: 'm:dir:Domain',
  parentKey: '',
  kind: 'module',
  title: 'Domain',
  path: 'Domain',
  category: 'domain',
  categorySource: 'rules',
  lang: null,
  lines: null,
  summary: null,
  analogy: null,
  callers: [
    {
      key: 's:b',
      title: 'Shop.Controllers.OrdersController.Post',
      path: 'Controllers/OrdersController.cs',
      provenance: 'syntax',
      reason: null
    }
  ],
  callees: [
    {
      key: 's:c',
      title: 'Shop.Infrastructure.Stores.Resolve',
      path: 'Infrastructure/Stores.cs',
      provenance: 'uncertain',
      reason: '4 cibles possibles'
    }
  ],
  error: null
}
const ORDER_SERVICE: FileCodeView = {
  path: 'Domain/OrderService.cs',
  lang: 'cs',
  lines: [
    'namespace Shop.Domain;',
    'public class OrderService',
    '{',
    '  public decimal Place()',
    '  {',
    '    Save();',
    '  }',
    '}'
  ],
  truncated: false,
  error: null,
  place: { parentKey: 'm:dir:Domain', nodeKey: 'r:m:dir:Domain', path: 'Domain/OrderService.cs', symbolId: null },
  blocks: [
    {
      symbolId: SYMBOL,
      kind: 'method',
      name: 'Place',
      startLine: 4,
      endLine: 7,
      category: 'domain',
      corrected: false,
      callers: [
        {
          symbolId: 'b'.repeat(32),
          title: 'Shop.Controllers.OrdersController.Post',
          path: 'Controllers/OrdersController.cs',
          line: 12,
          kind: 'call',
          provenance: 'syntax',
          reason: null,
          count: 1,
          at: null
        }
      ],
      callees: [
        {
          symbolId: 'c'.repeat(32),
          title: 'Shop.Infrastructure.SqlOrderRepository.Save',
          path: 'Infrastructure/SqlOrderRepository.cs',
          line: 8,
          kind: 'call',
          provenance: 'deduced',
          reason: 'le champ _repository est typé IOrderRepository',
          count: 2,
          at: 6
        }
      ],
      external: 1
    }
  ]
}

function renderExplorer(
  projectView: RepriseProjectView = project(),
  nodeDetail: ExplorerNodeDetailView = detail,
  extra: Parameters<typeof installFakeApi>[0] = {},
  marks: ExplorerMarks | null = null
) {
  const api = installFakeApi({
    'document:get': () => ({ id: 'd1', content: GUIDE, hash: 'h', missing: false }),
    'explorer:locate': () => ({
      results: [
        {
          source: 'Domain/OrderService.cs',
          key: 'r:m:dir:Domain',
          parentKey: 'm:dir:Domain',
          nodeKey: 'r:m:dir:Domain',
          path: 'Domain/OrderService.cs',
          symbolId: null
        }
      ]
    }),
    'explorer:file': (payload) => ({
      ...ORDER_SERVICE,
      path: (payload as { path: string }).path,
      place: { ...ORDER_SERVICE.place, path: (payload as { path: string }).path }
    }),
    'reprise:guide': () => ({ documentId: 'd1' }),
    'reprise:get': () => projectView,
    'explorer:state': () => ({
      parentKey: '',
      filters: { categories: ['domain', 'orchestration', 'infrastructure'], langs: [], hideUncertain: false }
    }),
    'explorer:view': () => top,
    'explorer:map': () => MAP,
    'explorer:node': () => nodeDetail,
    'explorer:code': () => ({
      path: 'Domain/OrderService.cs',
      startLine: 20,
      lines: ['public decimal Place()', '{'],
      lang: 'cs'
    }),
    'explorer:search': () => ({
      results: [
        {
          key: 'r:m:dir:Domain',
          nodeKey: 'r:m:dir:Domain',
          parentKey: 'm:dir:Domain',
          path: 'Domain/OrderService.cs',
          symbolId: SYMBOL,
          title: 'Place',
          where: 'Domain › OrderService.cs'
        }
      ]
    }),
    'explorer:saveState': () => ({ ok: true }),
    'reprise:setCategory': () => ({ ok: true }),
    'reprise:analyze': () => ({ runId: 'r1' }),
    ...extra
  })
  const onClose = vi.fn()
  const result = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ExplorerPage genesisId={GENESIS} marks={marks} onClose={onClose} />
    </QueryClientProvider>
  )
  return { api, onClose, ...result }
}

describe('explorateur d’un projet repris, en boîtes (spec 017 US2, spec 031 lot 2)', () => {
  beforeAll(() => installReactFlowMocks())

  it('should_show_each_module_as_a_box_with_its_layer_and_role_and_hide_the_plumbing', async () => {
    const { container } = renderExplorer()
    expect(await screen.findByText('Controllers')).toBeTruthy()
    expect(screen.getByText('Reçoit les commandes.')).toBeTruthy()
    expect(screen.getByLabelText(/^module Domain, Règles\. Le cœur métier\., 2 fichiers, fermé/)).toBeTruthy()
    expect(screen.queryByText('Logging')).toBeNull()
    expect(screen.getByText(/2 modules · 3 fichiers/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Local uniquement/ })).toBeTruthy()
    await expectNoAxeViolations(container)
  })

  it('should_open_a_module_in_place_show_its_files_and_close_it_by_clicking_the_empty_map', async () => {
    const { api, container } = renderExplorer()
    // Nœud déplaçable : un clic simple (sans « mousedown », que le glisser de React Flow lit sur la fenêtre).
    fireEvent.click(await screen.findByText('Domain'))
    const fileNode = await screen.findByLabelText(/^fichier OrderService\.cs\. Passe la commande\./)
    expect(screen.getByLabelText(/^module Domain.*ouvert/)).toBeTruthy()
    // Le trait arrive sur le fichier exact, et se dit en mots au survol.
    expect(screen.getByLabelText('OrdersController.Post appelle OrderService.Place')).toBeTruthy()
    await expectNoAxeViolations(container)
    // La fiche du module choisi, à droite, dit ce qu'il contient.
    expect(within(screen.getByRole('region', { name: 'Contenu' })).getByText('OrderService.cs')).toBeTruthy()
    fireEvent.click(within(fileNode).getByText('OrderService.cs'))
    expect(api.invoke).toHaveBeenCalledWith('explorer:file', { genesisId: GENESIS, path: 'Domain/OrderService.cs' })
    expect(await screen.findByRole('complementary', { name: 'Code du fichier' })).toBeTruthy()
    // Le code chargé, le fichier lu est montré sur la carte ; un clic dans le vide referme ensuite tout.
    expect(await screen.findByRole('region', { name: /^Code de Domain\/OrderService\.cs/ })).toBeTruthy()
    const pane = container.querySelector('.react-flow__pane')
    if (pane === null) throw new Error('fond de carte introuvable')
    fireEvent.click(pane)
    expect(screen.queryByLabelText(/^fichier OrderService\.cs/)).toBeNull()
    expect(screen.getByLabelText(/^module Domain.*fermé/)).toBeTruthy()
  })

  it('should_enter_a_module_by_double_click_show_only_its_inside_go_through_a_stub_and_leave_with_escape', async () => {
    const user = userEvent.setup()
    const { container } = renderExplorer()
    fireEvent.doubleClick(await screen.findByText('Domain'))
    // Dedans : le cadre, ses fichiers avec leurs fonctions, une amorce vers qui l'appelle ; plus les autres modules.
    expect(await screen.findByLabelText(/^intérieur du module Domain, Règles\. Le cœur métier\./)).toBeTruthy()
    expect(screen.getByLabelText(/^fichier OrderService\.cs\. Passe la commande\., fonctions Place/)).toBeTruthy()
    expect(screen.getByLabelText('appelé par le module Controllers : entrer dedans')).toBeTruthy()
    await waitFor(() => expect(container.querySelector('.scene-ghost')).toBeNull())
    expect(screen.queryByLabelText(/^module Controllers,/)).toBeNull()
    // L'appel interne (OrderService → Stores) relie les deux fichiers ; l'appel entrant part de l'amorce.
    expect(screen.getByLabelText('OrderService.Archive appelle Stores.Resolve')).toBeTruthy()
    expect(screen.getByLabelText('OrdersController.Post appelle OrderService.Place')).toBeTruthy()
    await expectNoAxeViolations(container)
    // L'amorce mène au voisin : on est dans Controllers, avec une amorce vers Domain.
    fireEvent.click(screen.getByLabelText('appelé par le module Controllers : entrer dedans'))
    expect(await screen.findByLabelText(/^intérieur du module Controllers/)).toBeTruthy()
    expect(screen.getByLabelText('appelle le module Domain : entrer dedans')).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(await screen.findByLabelText(/^module Controllers, Entrée/)).toBeTruthy()
    await waitFor(() => expect(container.querySelector('.scene-ghost')).toBeNull())
    expect(screen.queryByLabelText(/^intérieur du module/)).toBeNull()
  })

  it('should_list_modules_and_files_and_show_a_file_with_who_calls_each_block_and_follow_a_call', async () => {
    const user = userEvent.setup()
    const { api, container } = renderExplorer()
    await user.click(await screen.findByRole('button', { name: 'Vue liste' }))
    const list = screen.getByRole('region', { name: 'Modules et fichiers' })
    await user.click(within(list).getByRole('button', { name: /^Domain\/OrderService\.cs/ }))

    const pane = await screen.findByRole('complementary', { name: 'Code du fichier' })
    const block = await within(pane).findByRole('group', { name: 'méthode Place' })
    expect(within(block).getByText('← appelé par :')).toBeTruthy()
    expect(within(block).getByText('→ appelle :')).toBeTruthy()
    expect(within(block).getByText(/1 appel hors du projet/)).toBeTruthy()
    expect(within(pane).getByTitle('Appel repéré sur cette ligne')).toBeTruthy()
    await user.selectOptions(within(block).getByLabelText('Catégorie de Place'), 'infrastructure')
    expect(api.invoke).toHaveBeenCalledWith('reprise:setCategory', {
      genesisId: GENESIS,
      symbolId: SYMBOL,
      category: 'infrastructure'
    })
    await user.click(
      within(block).getByRole('button', {
        name: 'Shop.Controllers.OrdersController.Post (Controllers/OrdersController.cs), sûr : ouvrir'
      })
    )
    expect(api.invoke).toHaveBeenCalledWith('explorer:file', {
      genesisId: GENESIS,
      path: 'Controllers/OrdersController.cs'
    })
    expect(await screen.findByRole('region', { name: 'Code de Controllers/OrdersController.cs' })).toBeTruthy()
    await expectNoAxeViolations(container)
  })

  it('should_show_the_plumbing_on_demand_and_jump_to_an_element_found_by_the_analysis', async () => {
    const user = userEvent.setup()
    const { api } = renderExplorer(project(), detail, {
      'explorer:search': () => ({
        results: [
          {
            key: 'r:m:dir:Domain',
            nodeKey: 'r:m:dir:Domain',
            parentKey: 'm:dir:Domain',
            path: 'Domain/OrderService.cs',
            symbolId: SYMBOL,
            title: 'OrderRules',
            where: 'Domain › OrderService.cs'
          }
        ]
      })
    })
    await screen.findByText('Controllers')
    await user.click(screen.getByText('Filtres'))
    await user.click(screen.getByRole('checkbox', { name: 'Masquer la plomberie' }))
    expect(api.invoke).toHaveBeenCalledWith(
      'explorer:saveState',
      expect.objectContaining({
        filters: expect.objectContaining({ categories: expect.arrayContaining(['plumbing']) })
      })
    )
    expect(await screen.findByText('Logging')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Rechercher un fichier, une fonction/ }))
    // Une classe que la carte ne nomme pas : l'analyse la trouve.
    await user.type(screen.getByRole('combobox', { name: 'Fichier ou fonction' }), 'OrderR')
    const found = await screen.findByRole('option', { name: /OrderRules\s+Domain › OrderService\.cs/ })
    await user.click(found)
    expect(api.invoke).toHaveBeenCalledWith('explorer:file', { genesisId: GENESIS, path: 'Domain/OrderService.cs' })
    expect(await screen.findByRole('complementary', { name: 'Code du fichier' })).toBeTruthy()
    // On est entré dans son module.
    expect(await screen.findByLabelText(/^intérieur du module Domain/)).toBeTruthy()
  })

  it('should_find_a_file_with_ctrl_k_enter_its_module_and_open_its_code_in_two_gestures', async () => {
    const user = userEvent.setup()
    const { api, container } = renderExplorer()
    await screen.findByText('Controllers')
    await user.keyboard('{Control>}k{/Control}')
    const input = await screen.findByRole('combobox', { name: 'Fichier ou fonction' })
    await user.type(input, 'stores')
    expect(screen.getByRole('option', { name: /Stores\.cs/ }).getAttribute('aria-selected')).toBe('true')
    await expectNoAxeViolations(container)
    await user.keyboard('{Enter}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(api.invoke).toHaveBeenCalledWith('explorer:file', { genesisId: GENESIS, path: 'Domain/Stores.cs' })
    expect(await screen.findByLabelText(/^intérieur du module Domain/)).toBeTruthy()
    // La fiche du fichier, au-dessus de son code : qui l'appelle, en mots.
    const pane = await screen.findByRole('complementary', { name: 'Code du fichier' })
    const callers = within(pane).getByRole('region', { name: 'Qui l’appelle' })
    expect(within(callers).getByText('OrderService.Archive appelle Stores.Resolve')).toBeTruthy()
  })

  it('should_find_a_function_with_the_arrow_keys_and_close_the_search_with_escape', async () => {
    const user = userEvent.setup()
    const { api } = renderExplorer()
    await screen.findByText('Controllers')
    await user.keyboard('{Control>}k{/Control}')
    await user.type(await screen.findByRole('combobox', { name: 'Fichier ou fonction' }), 'o')
    // « o » : des fichiers et des fonctions ; Échap ferme sans rien ouvrir.
    expect(screen.getAllByRole('option').length).toBeGreaterThan(1)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(api.invoke).not.toHaveBeenCalledWith('explorer:file', expect.anything())
    await user.keyboard('{Control>}k{/Control}')
    await user.type(await screen.findByRole('combobox', { name: 'Fichier ou fonction' }), 'resolve')
    expect(await screen.findByRole('option', { name: /Resolve\s+Stores\.cs/ })).toBeTruthy()
    await user.keyboard('{ArrowDown}{ArrowUp}{Enter}')
    expect(api.invoke).toHaveBeenCalledWith('explorer:file', { genesisId: GENESIS, path: 'Domain/Stores.cs' })
  })

  it('should_open_the_guide_and_turn_each_cited_name_of_the_project_into_a_link_to_the_explorer', async () => {
    const user = userEvent.setup()
    const { api, container } = renderExplorer(project({}, { documentId: 'd1', running: false }))
    const guide = await screen.findByRole('complementary', { name: 'Guide de reprise' })
    expect(await within(guide).findByText('Comme une boutique et son arrière-boutique.')).toBeTruthy()
    expect(within(guide).getByText('npm start').closest('button')).toBeNull()
    expect(within(guide).getByText('src/Invente.cs').closest('button')).toBeNull()
    await user.click(
      await within(guide).findByRole('button', { name: 'Voir Domain/OrderService.cs dans l’explorateur' })
    )
    expect(api.invoke).toHaveBeenCalledWith('explorer:locate', {
      genesisId: GENESIS,
      sources: ['npm start', 'Domain/OrderService.cs', 'src/Invente.cs']
    })
    // Le fichier cité s'ouvre sur la carte (son module) et dans l'onglet « Code ».
    expect(await screen.findByRole('tab', { name: 'Code · OrderService.cs' })).toBeTruthy()
    await user.click(within(guide).getByRole('button', { name: 'Régénérer' }))
    expect(api.invoke).toHaveBeenCalledWith('reprise:guide', { genesisId: GENESIS })
    await expectNoAxeViolations(container)
  })

  it('should_offer_to_write_the_guide_once_analyzed_and_show_the_module_analogy_in_the_element_panel', async () => {
    const user = userEvent.setup()
    renderExplorer(project(), {
      ...detail,
      key: 'm:dir:Domain',
      kind: 'module',
      title: 'Domain',
      summary: 'Le cœur métier.',
      analogy: 'La cuisine du restaurant.'
    })
    await user.click(await screen.findByRole('tab', { name: 'Guide de reprise' }))
    expect(await screen.findByRole('button', { name: 'Rédiger le guide' })).toBeTruthy()
    await user.click(screen.getByRole('tab', { name: 'Élément' }))
    await user.click(await screen.findByRole('button', { name: 'Vue liste' }))
    await user.click(
      within(screen.getByRole('region', { name: 'Modules et fichiers' })).getByRole('button', {
        name: /Règles\s*Domain/
      })
    )
    const panel = await screen.findByRole('complementary', { name: 'Élément choisi' })
    expect(await within(panel).findByText('« La cuisine du restaurant. »')).toBeTruthy()
    expect(within(panel).getByText('Le cœur métier.')).toBeTruthy()
  })

  it('should_offer_to_analyze_a_project_never_analyzed_and_go_back_to_the_map', async () => {
    const user = userEvent.setup()
    const { api, onClose } = renderExplorer(project({ analyzedAt: null }))
    await user.click(await screen.findByRole('button', { name: 'Analyser' }))
    expect(api.invoke).toHaveBeenCalledWith('reprise:analyze', { genesisId: GENESIS })
    await user.click(screen.getByRole('button', { name: '← Carte' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('should_run_the_resolution_from_the_button_and_say_what_became_deduced_and_what_stays_uncertain', async () => {
    const user = userEvent.setup()
    const { api, container } = renderExplorer(project({}, undefined, { running: false, pending: 3 }), detail, {
      'reprise:resolve': () => ({ runId: 'r2', deduced: 2, undecided: 1, remaining: 0, stopped: false })
    })
    const button = await screen.findByRole('button', { name: /Préciser les liens avec l’IA \(3\)/ })
    expect(button.getAttribute('aria-describedby')).toBeTruthy()
    expect(document.getElementById(button.getAttribute('aria-describedby') ?? '')?.textContent).toMatch(
      /3 liens incertains\. Le modèle local lit quelques lignes.*rien ne part vers Claude/
    )
    await user.click(button)
    expect(api.invoke).toHaveBeenCalledWith('reprise:resolve', { genesisId: GENESIS })
    expect(
      await screen.findByText(/2 liens précisés \(« déduit », avec sa raison\)\. 1 lien reste incertain/)
    ).toBeTruthy()
    await expectNoAxeViolations(container)
  })

  it('should_leave_the_button_unavailable_when_no_uncertain_link_is_left_or_the_project_is_not_analyzed', async () => {
    renderExplorer(project({}, undefined, { running: false, pending: 0 }))
    const none = await screen.findByRole('button', { name: 'Préciser les liens avec l’IA' })
    expect((none as HTMLButtonElement).disabled).toBe(true)
  })

  it('should_tell_when_the_ai_stopped_and_the_links_were_left_uncertain', async () => {
    const user = userEvent.setup()
    renderExplorer(project({}, undefined, { running: false, pending: 120 }), detail, {
      'reprise:resolve': () => ({ runId: 'r3', deduced: 50, undecided: 0, remaining: 70, stopped: true })
    })
    await user.click(await screen.findByRole('button', { name: /Préciser les liens/ }))
    expect(await screen.findByText(/L’IA est devenue indisponible : 70 liens sont laissés incertains/)).toBeTruthy()
  })

  it('should_show_a_clear_error_when_the_ai_is_unavailable', async () => {
    const user = userEvent.setup()
    renderExplorer(project({}, undefined, { running: false, pending: 2 }), detail, {
      'reprise:resolve': () => {
        throw new FakeIpcError('AI_UNAVAILABLE')
      }
    })
    await user.click(await screen.findByRole('button', { name: /Préciser les liens/ }))
    expect(await screen.findByRole('alert')).toBeTruthy()
  })

  it('should_describe_a_module_in_words_what_it_uses_who_uses_it_and_its_files', async () => {
    const user = userEvent.setup()
    const { api, container } = renderExplorer()
    await user.click(await screen.findByRole('button', { name: 'Vue liste' }))
    await user.click(
      within(screen.getByRole('region', { name: 'Modules et fichiers' })).getByRole('button', {
        name: /Règles\s*Domain/
      })
    )
    const panel = await screen.findByRole('complementary', { name: 'Élément choisi' })
    expect(within(panel).getByText('Le cœur métier.')).toBeTruthy()
    const usedBy = within(panel).getByRole('region', { name: 'Utilisé par' })
    expect(within(usedBy).getByRole('button', { name: 'Controllers' })).toBeTruthy()
    expect(within(usedBy).getByText('OrdersController.Post appelle OrderService.Place')).toBeTruthy()
    expect(within(within(panel).getByRole('region', { name: 'Utilise' })).getByText('rien dans le projet')).toBeTruthy()
    // Les appels internes (OrderService → Stores) ne sont pas des voisins ; le contenu ouvre le code.
    await expectNoAxeViolations(container)
    await user.click(
      within(within(panel).getByRole('region', { name: 'Contenu' })).getByRole('button', { name: /Stores\.cs/ })
    )
    expect(api.invoke).toHaveBeenCalledWith('explorer:file', { genesisId: GENESIS, path: 'Domain/Stores.cs' })
  })

  it('should_replay_who_touched_each_module_move_the_cursor_and_quit_with_escape', async () => {
    const user = userEvent.setup()
    const alice = {
      key: 'a'.repeat(16),
      name: 'Alice Fictive',
      email: 'a@example.invalid',
      initials: 'AF',
      color: '#2563eb'
    }
    const bob = {
      key: 'b'.repeat(16),
      name: 'Bob Fictif',
      email: 'b@example.invalid',
      initials: 'BF',
      color: '#ea580c'
    }
    const [first, second] = ['1'.repeat(40), '2'.repeat(40)]
    const { api, container } = renderExplorer(project(), detail, {
      'git:replaySteps': () => ({
        commits: [
          { hash: first, date: '2026-10-01T10:00:00Z', authorKey: alice.key },
          { hash: second, date: '2026-10-02T10:00:00Z', authorKey: bob.key }
        ],
        authors: [alice, bob],
        weight: 'commits',
        more: false
      }),
      'git:replay': (payload) =>
        (payload as { at: string }).at === second
          ? {
              nodes: [
                {
                  key: 'm:dir:Domain',
                  main: alice.key,
                  last: bob.key,
                  shares: [
                    { authorKey: alice.key, percent: 67 },
                    { authorKey: bob.key, percent: 33 }
                  ]
                }
              ]
            }
          : { nodes: [] }
    })
    await screen.findByText('Controllers')
    await user.click(screen.getByRole('button', { name: 'Rediffusion' }))
    const bar = await screen.findByRole('region', { name: 'Rediffusion' })
    expect(await within(bar).findByText(/2\/2/)).toBeTruthy()
    expect(within(bar).getByText('par commits')).toBeTruthy()
    expect(within(bar).getByRole('button', { name: 'Tout télécharger' })).toBeTruthy()
    expect(api.invoke).toHaveBeenCalledWith('git:replay', {
      genesisId: GENESIS,
      at: second,
      keys: expect.arrayContaining(['m:dir:Controllers', 'm:dir:Domain'])
    })
    await expectNoAxeViolations(container)
    await user.click(within(bar).getByRole('radio', { name: 'dernier' }))
    await user.click(within(bar).getByRole('button', { name: 'Premier commit' }))
    expect(await within(bar).findByText(/1\/2/)).toBeTruthy()
    expect(api.invoke).toHaveBeenCalledWith('git:replay', expect.objectContaining({ at: first }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('region', { name: 'Rediffusion' })).toBeNull()
  })

  it('should_highlight_the_modules_touched_since_the_last_visit_then_quit', async () => {
    const user = userEvent.setup()
    const colleague = {
      key: 'c'.repeat(16),
      name: 'Collègue Fictif',
      email: 'c@example.invalid',
      initials: 'CF',
      color: '#0f766e'
    }
    const [seen, head] = ['3'.repeat(40), '4'.repeat(40)]
    const { api, container } = renderExplorer(
      project(),
      detail,
      {
        'git:updates': () => ({ lastSeen: seen, upstreamHead: head, commits: [], authors: [] }),
        'git:touched': () => ({
          nodes: [
            {
              key: 'm:dir:Domain',
              main: colleague.key,
              last: colleague.key,
              shares: [{ authorKey: colleague.key, percent: 100 }]
            }
          ],
          authors: [colleague],
          commits: 2
        })
      },
      'updates'
    )
    const bar = await screen.findByRole('region', { name: 'Depuis ta dernière visite' })
    expect(
      await within(bar).findByText(/2 commits depuis ta dernière visite : 1 élément touché à ce niveau/)
    ).toBeTruthy()
    expect(within(bar).getByText('Collègue Fictif')).toBeTruthy()
    expect(api.invoke).toHaveBeenCalledWith('git:touched', {
      genesisId: GENESIS,
      from: seen,
      to: head,
      keys: expect.arrayContaining(['m:dir:Controllers', 'm:dir:Domain'])
    })
    expect(await screen.findByLabelText(/Domain.*nouveauté de Collègue Fictif/)).toBeTruthy()
    await expectNoAxeViolations(container)
    await user.click(within(bar).getByRole('button', { name: 'Quitter les nouveautés' }))
    expect(screen.queryByRole('region', { name: 'Depuis ta dernière visite' })).toBeNull()
  })

  it('should_say_nothing_is_new_when_the_last_seen_commit_is_the_remote_head', async () => {
    const head = '4'.repeat(40)
    const { api } = renderExplorer(
      project(),
      detail,
      { 'git:updates': () => ({ lastSeen: head, upstreamHead: head, commits: [], authors: [] }) },
      'updates'
    )
    expect(await screen.findByText('Rien de nouveau depuis ta dernière visite.')).toBeTruthy()
    expect(api.invoke).not.toHaveBeenCalledWith('git:touched', expect.anything())
  })
})
