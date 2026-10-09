import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { useCards, type OpenCard } from '../../../src/renderer/src/canvas/cards/cardsStore'
import { promptFor } from '../../../src/renderer/src/canvas/workflow/prompts'
import { discussWorkflow, WorkflowCard } from '../../../src/renderer/src/canvas/workflow/WorkflowCard'
import { workflowKey, workflowTree, type WorkflowItem } from '../../../src/renderer/src/canvas/workflow/workflowTree'
import type { ElementView } from '../../../src/shared/ipc/canvas'
import type { ChatView } from '../../../src/shared/ipc/chat'
import type {
  SpecView,
  TaskView,
  WorkflowAnatomyView,
  WorkflowBlockView,
  WorkflowFileSummaryView,
  WorkflowSavedSummaryView,
  WorkflowView
} from '../../../src/shared/ipc/workflow'
import { expectNoAxeViolations } from '../../support/axe'
import { installFakeApi } from './support/fakeApi'

const G = '00000000-0000-4000-8000-0000000000b1'
const task = (id: string, done: boolean, story: number | null): TaskView => ({
  id,
  done,
  story,
  text: `Faire ${id} dans \`src/${id}.ts\``,
  files: [`src/${id}.ts`]
})
const tasks = [task('T001', true, null), task('T002', false, null), task('T010', true, 1), task('T011', false, 1)]
const SPEC: SpecView = {
  number: '022',
  dir: 'specs/022-noeuds-vivants',
  title: 'Nœuds vivants',
  statusLine: 'Draft — à valider',
  marker: null,
  status: 'active',
  createdAt: '2026-10-08',
  decisions: 29,
  stories: [
    {
      number: 1,
      title: 'Carte des idées',
      priority: 1,
      described: true,
      tasks: tasks.filter((entry) => entry.story === 1),
      done: 1,
      total: 2,
      delivered: false,
      files: ['src/T010.ts', 'src/T011.ts']
    }
  ],
  socle: tasks.filter((entry) => entry.story === null),
  done: 2,
  total: 4,
  leftovers: [],
  citedDocs: ['L1f-reprise-projet.md'],
  partial: false
}
const VIEW: WorkflowView = {
  genesisId: G,
  foundation: null,
  specs: [SPEC],
  brainstorm: [
    { name: 'L1j-carte.md', level: 1, title: 'Carte workflow', family: null, coveredBy: [] },
    { name: 'L2-carte-ecran.md', level: 2, title: 'Écran', family: 'L1j-carte.md', coveredBy: [] }
  ],
  folded: {},
  empty: false,
  readAt: '2026-10-09T10:00:00.000Z',
  missingFiles: []
}
const CHAT_ID = '00000000-0000-4000-8000-0000000000b9'
const CHAT: ChatView = {
  neuronId: CHAT_ID,
  title: 'gestionnaire-idees',
  messages: [{ id: 'm1', role: 'assistant', text: 'Bonjour.', createdAt: '' }],
  pending: [],
  git: true,
  sheet: { resume: '', points_cles: [], decisions: [], questions_ouvertes: [], manques: [] },
  maturity: null,
  busy: false,
  partial: '',
  usage: {
    account: null,
    app: { weekTokens: 0, weekTurns: 0, totalTokens: 0, totalTurns: 0, neuronTokens: 0, neuronTurns: 0 }
  },
  folder: null,
  role: 'workflow',
  elementType: null,
  stepLabel: null,
  model: 'claude-opus-5-5',
  modelChoice: null,
  permissionMode: 'default',
  reprise: null
}
const item = (key: string): WorkflowItem => {
  const found = workflowTree({ view: VIEW }, G).items.find((entry) => entry.key === key)
  if (found === undefined) throw new Error(`nœud ${key} absent`)
  return found
}
const card = (id: string): OpenCard => ({
  id,
  offset: { x: 0, y: 0 },
  sheet: false,
  side: null,
  reader: null,
  z: 1,
  pinned: false
})

const block = (
  id: number,
  name: string,
  kind: WorkflowBlockView['kind'],
  line: number,
  extra: Partial<WorkflowBlockView> = {}
): WorkflowBlockView => ({
  id,
  parent: null,
  kind,
  name,
  startLine: line,
  endLine: line,
  complexity: 1,
  exported: false,
  maybeUnused: false,
  doc: null,
  ...extra
})
// Anatomie du fichier `src/T011.ts` simulé : `Faire` est nommé par la tâche T011 (« Faire T011 dans … »).
const ANATOMY: WorkflowAnatomyView = {
  blocks: [
    block(0, 'Carte', 'class', 1, { endLine: 3, exported: true }),
    block(1, 'lire', 'method', 2, { parent: 0, exported: true }),
    block(2, 'ranger', 'function', 4, { exported: true }),
    block(3, 'Faire', 'function', 5),
    block(4, 'aide', 'function', 6, { maybeUnused: true })
  ],
  imports: [{ source: './store', names: 2, line: 1 }],
  calls: [{ from: 2, to: 3, line: 4, ambiguous: false }],
  truncated: false
}

// Explication simulée : `inventé` a déjà été écarté par le main (seuls les blocs existants arrivent).
const SUMMARY: WorkflowFileSummaryView = {
  role: 'Range les cartes du projet.',
  receives: 'La liste des cartes.',
  produces: 'Des cartes rangées.',
  parts: [
    { name: 'ranger', why: 'Le point de départ.', startLine: 4, endLine: 4 },
    { name: 'Faire', why: 'Fait le travail.', startLine: 5, endLine: 5 }
  ],
  flow: [
    { from: 'in', to: 'ranger', label: 'reçoit' },
    { from: 'ranger', to: 'Faire', label: 'appelle' },
    { from: 'Faire', to: 'out', label: 'renvoie' }
  ],
  engine: 'claude',
  model: 'claude-sonnet-5-5'
}
let summaries = 0
let failFirstSummary = false
let saved: WorkflowSavedSummaryView = { summary: null, outdated: false }

function renderCard(key: string, elements: readonly ElementView[] = [], missingFiles: readonly string[] = []) {
  useCards.setState({ cards: [card(key)], activeId: key })
  const api = installFakeApi({
    'workflow:file': (payload) => {
      const path = (payload as { path: string }).path
      if (path.endsWith('tasks.md')) {
        return { path, lang: 'other', lines: ['## Phase 1', '- [ ] T037 [US4] Test guidé', '- [x] T006 [P] Pur'] }
      }
      return path.endsWith('.ts')
        ? {
            path,
            lang: 'ts',
            lines: [
              'export class Carte {',
              '  lire(): void {}',
              '}',
              'export function ranger(): void { Faire() }',
              'function Faire(): void {}',
              'function aide(): void {}'
            ]
          }
        : { path, lang: 'other', lines: ['# Spec', '<script>alert(1)</script>', '', '[le site](https://example.com)'] }
    },
    'workflow:chat': () => ({ neuronId: CHAT_ID }),
    'chat:open': () => CHAT,
    'chat:close': () => ({ ok: true }),
    'workflow:anatomy': () => ANATOMY,
    'workflow:savedSummary': () => saved,
    'workflow:summary': () => {
      summaries += 1
      if (summaries === 1 && failFirstSummary) throw new Error('panne')
      return SUMMARY
    }
  })
  const Current = (): React.JSX.Element => {
    const current = useCards((state) => state.cards.find((entry) => entry.id === key)) ?? card(key)
    return (
      <WorkflowCard
        card={current}
        active
        anchor={{ x: 0, y: 0, width: 44, height: 44 }}
        zoom={1}
        item={item(key)}
        genesisId={G}
        elements={elements}
        onGoto={() => undefined}
      />
    )
  }
  const client = new QueryClient()
  client.setQueryData(['workflow', G], { ...VIEW, missingFiles })
  const result = render(
    <QueryClientProvider client={client}>
      <Current />
    </QueryClientProvider>
  )
  return { api, ...result }
}

describe('consignes de « Discuter » (spec 023 US2)', () => {
  it('should_ask_to_implement_a_task_lead_a_story_or_brainstorm_an_idea_and_nothing_for_a_spec', () => {
    expect(promptFor(item(workflowKey(G, 'task', '022', 'T011')))).toBe(
      'Implémente la tâche T011 de la spec specs/022-noeuds-vivants (specs/022-noeuds-vivants/tasks.md) en suivant /speckit-implement : lis la spec et le plan, fais la tâche, vérifie (typecheck, lint, tests), puis coche sa case.'
    )
    expect(promptFor(item(workflowKey(G, 'story', '022', '1')))).toContain(
      "Mène les tâches restantes de l'US1 « Carte des idées » de la spec specs/022-noeuds-vivants, dans l'ordre : T011."
    )
    expect(promptFor(item(workflowKey(G, 'socle', '022')))).toContain('du socle')
    expect(promptFor(item(workflowKey(G, 'doc', 'L1j-carte')))).toBe(
      'Lance /brainstorm à partir de docs/brainstorm/L1j-carte.md (idée à brainstormer de ce projet).'
    )
    expect(promptFor(item(workflowKey(G, 'spec', '022')))).toContain('Parlons de la spec specs/022-noeuds-vivants')
    expect(promptFor(item(workflowKey(G, 'branch', 'active')))).toBeNull()
    // Tâche faite (D16) : on la relit, on ne la refait pas ; le groupe « Faites » n'a pas de conversation.
    expect(promptFor(item(workflowKey(G, 'task', '022', 'T010')))).toBe(
      "Relis la tâche T010 (faite) de la spec specs/022-noeuds-vivants (specs/022-noeuds-vivants/tasks.md) : explique ce qu'elle a changé et vérifie qu'elle est complète (fichiers cités, tests)."
    )
    expect(promptFor(item(workflowKey(G, 'done', '022', '1')))).toBeNull()
  })
})

describe('carte d’un nœud Workflow (spec 023 US2, US3)', () => {
  beforeEach(() => useUiStore.setState({ chatDrafts: {} }))

  it('should_open_the_task_own_conversation_in_its_card_with_the_instruction_prefilled_when_discussing', async () => {
    const user = userEvent.setup()
    const { container, api } = renderCard(workflowKey(G, 'task', '022', 'T011'))
    expect(screen.getByText('Tâche T011')).toBeDefined()
    expect(screen.getByText('US1 · Spec 022 · à faire')).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'Discuter' }))
    // La carte de la tâche elle-même s'étire avec la conversation du projet, la consigne dans le champ.
    const key = workflowKey(G, 'task', '022', 'T011')
    expect(useCards.getState().cards.find((entry) => entry.id === key)).toMatchObject({ side: 'chat' })
    expect(useCards.getState().cards.some((entry) => entry.id === G)).toBe(false)
    const field = (await screen.findByLabelText('Message à Claude')) as HTMLTextAreaElement
    expect(field.value).toContain('Implémente la tâche T011')
    expect(useUiStore.getState().chatDrafts[key]).toBeUndefined()
    // Conversation propre à la tâche (créée au premier « Discuter »), pas celle du genesis.
    expect(api.invoke).toHaveBeenCalledWith('workflow:chat', {
      genesisId: G,
      key,
      title: expect.stringContaining('Tâche T011')
    })
    expect(api.invoke).toHaveBeenCalledWith('chat:open', { neuronId: CHAT_ID })
    expect(api.invoke).not.toHaveBeenCalledWith('chat:send', expect.anything())
    await expectNoAxeViolations(container)
  })

  it('should_show_markdown_formatted_without_html_and_as_plain_text_on_demand_when_a_spec_card_is_open', async () => {
    const user = userEvent.setup()
    const { api } = renderCard(workflowKey(G, 'spec', '022'))
    expect(screen.getByText('Spec 022')).toBeDefined()
    expect(screen.getByText('en cours · créée le 2026-10-08 · 29 décisions')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Discuter' })).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'Détail' }))
    expect(screen.getByRole('region', { name: 'User stories' }).textContent).toContain('US1 · P1 Carte des idées')
    await user.click(screen.getByRole('button', { name: 'L1f-reprise-projet.md' }))
    await waitFor(() =>
      expect(api.invoke).toHaveBeenCalledWith('workflow:file', {
        genesisId: G,
        path: 'docs/brainstorm/L1f-reprise-projet.md'
      })
    )
    // Mis en forme (D13) : le titre est un titre, le HTML brut n'est ni rendu ni exécuté.
    expect(await screen.findByRole('heading', { name: 'Spec' })).toBeDefined()
    expect(screen.queryByText('<script>alert(1)</script>')).toBeNull()
    expect(document.querySelector('script')).toBeNull()
    // Lien inerte (FR-003) : affiché, jamais actif.
    expect(screen.getByText('le site').closest('a')).toBeNull()
    expect(screen.getByTitle('https://example.com').textContent).toBe('le site')
    await user.click(screen.getByRole('button', { name: 'Texte brut' }))
    expect(screen.getByText('<script>alert(1)</script>')).toBeDefined()
    expect(document.querySelector('script')).toBeNull()
  })

  it('should_show_tasks_with_boxes_bold_ids_and_tag_chips_when_reading_tasks_md', async () => {
    const user = userEvent.setup()
    const { container } = renderCard(workflowKey(G, 'task', '022', 'T011'))
    await user.click(screen.getByRole('button', { name: 'Lire les tâches' }))
    expect(await screen.findByRole('heading', { name: 'Phase 1' })).toBeDefined()
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(boxes.map((box) => box.checked)).toEqual([false, true])
    expect(screen.getByText('T037').tagName).toBe('STRONG')
    expect(screen.getByText('US4').tagName).toBe('CODE')
    expect(screen.getByRole('button', { name: 'Mis en forme' }).getAttribute('aria-pressed')).toBe('true')
    await expectNoAxeViolations(container)
  })

  it('should_open_the_done_tasks_group_with_its_tasks_and_their_files', async () => {
    const user = userEvent.setup()
    const { container } = renderCard(workflowKey(G, 'done', '022', '1'))
    expect(screen.getByText('Tâches faites')).toBeDefined()
    expect(screen.getByText('US1 · Spec 022')).toBeDefined()
    expect(screen.getByText('Fichiers (1)')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Discuter' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Détail' }))
    expect(container.textContent).toContain('T010')
    await expectNoAxeViolations(container)
  })

  it('should_mark_a_done_task_as_done_in_its_card', () => {
    renderCard(workflowKey(G, 'task', '022', 'T010'))
    expect(screen.getByText('US1 · Spec 022 · faite')).toBeDefined()
  })

  it('should_list_the_family_docs_of_an_idea_to_brainstorm', async () => {
    const user = userEvent.setup()
    renderCard(workflowKey(G, 'doc', 'L1j-carte'))
    expect(screen.getByText('À brainstormer')).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'Détail' }))
    expect(screen.getByRole('button', { name: 'L2-carte-ecran.md' })).toBeDefined()
  })

  it('should_list_cited_files_read_their_code_grey_missing_ones_and_show_their_module_in_place', async () => {
    const user = userEvent.setup()
    useUiStore.setState({ structureViews: { [G]: 'workflow' } })
    const element: ElementView = {
      id: 'element-src',
      genesisId: G,
      parentId: 'element-app',
      key: 'element-src',
      type: 'module',
      title: 'Sources',
      status: null,
      summary: null,
      paths: ['src'],
      collapsed: false,
      childCount: 0,
      order: null
    }
    const app: ElementView = {
      ...element,
      id: 'element-app',
      key: 'element-app',
      parentId: G,
      title: 'Application',
      paths: ['docs']
    }
    const { api, container } = renderCard(workflowKey(G, 'story', '022', '1'), [app, element], ['src/T010.ts'])
    expect(screen.getByText('Fichiers (2)')).toBeDefined()
    expect(screen.getByTitle('src/T010.ts : introuvable dans le dossier du projet')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Lire src/T010.ts' })).toBeNull()
    await user.click(screen.getByTitle('Lire src/T011.ts'))
    await waitFor(() => expect(api.invoke).toHaveBeenCalledWith('workflow:file', { genesisId: G, path: 'src/T011.ts' }))
    // Raccourcis (tree-sitter) : un clic surligne le code de la méthode.
    const shortcut = await screen.findByRole('button', { name: /lire.*méthode.*ligne 2/ })
    await user.click(shortcut)
    expect(shortcut.getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('[data-line="2"]')?.className).toContain('bg-accent/15')
    expect(container.querySelector('[data-line="4"]')?.className).not.toContain('bg-accent/15')
    expect(screen.queryByRole('navigation', { name: 'Raccourcis du fichier' })).not.toBeNull()
    await expectNoAxeViolations(container)
    // Module couvrant affiché sur place (D9 révisé) : aucune bascule de vue, aucune carte d'élément ouverte.
    expect(screen.getByTitle('Module de la structure : Application › Sources').textContent).toBe(
      '· Application › Sources'
    )
    expect(screen.queryByRole('button', { name: /dans la structure/ })).toBeNull()
    expect(useUiStore.getState().structureViews[G]).toBe('workflow')
    expect(useCards.getState().cards.some((entry) => entry.id === 'element-src')).toBe(false)
  })

  it('should_offer_no_explanation_when_the_file_is_markdown', async () => {
    const user = userEvent.setup()
    renderCard(workflowKey(G, 'task', '022', 'T011'))
    await user.click(screen.getByRole('button', { name: 'Lire les tâches' }))
    expect(await screen.findByRole('button', { name: 'Mis en forme' })).toBeDefined()
    expect(screen.queryByRole('button', { name: /Expliquer ce fichier/ })).toBeNull()
  })

  it('should_do_nothing_when_discussing_a_branch', () => {
    useCards.setState({ cards: [], activeId: null })
    expect(discussWorkflow(item(workflowKey(G, 'branch', 'active')))).toBe(false)
    expect(useCards.getState().cards).toEqual([])
  })
})

describe('« Que fait ce fichier ? » dans le lecteur (spec 023 D15)', () => {
  beforeEach(() => {
    summaries = 0
    failFirstSummary = false
    saved = { summary: null, outdated: false }
  })

  it('should_show_the_saved_explanation_at_once_without_asking_the_ai_again', async () => {
    saved = { summary: SUMMARY, outdated: false }
    const user = userEvent.setup()
    const { api } = renderCard(workflowKey(G, 'task', '022', 'T011'))
    await user.click(screen.getByTitle('Lire src/T011.ts'))
    expect(await screen.findByText('Range les cartes du projet.')).toBeDefined()
    expect(api.invoke).toHaveBeenCalledWith('workflow:savedSummary', { genesisId: G, path: 'src/T011.ts' })
    expect(summaries).toBe(0)
    expect(screen.queryByRole('button', { name: /Expliquer ce fichier/ })).toBeNull()
  })

  it('should_offer_to_explain_again_when_the_code_changed_since', async () => {
    saved = { summary: null, outdated: true }
    const user = userEvent.setup()
    renderCard(workflowKey(G, 'task', '022', 'T011'))
    await user.click(screen.getByTitle('Lire src/T011.ts'))
    expect(await screen.findByRole('button', { name: /Réexpliquer \(le code a changé\)/ })).toBeDefined()
    expect(screen.queryByText('Range les cartes du projet.')).toBeNull()
  })

  const openFile = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
    await user.click(screen.getByTitle('Lire src/T011.ts'))
    await screen.findByRole('navigation', { name: 'Raccourcis du fichier' })
  }

  it('should_explain_the_file_only_on_demand_and_highlight_an_important_part', async () => {
    const user = userEvent.setup()
    const { api, container } = renderCard(workflowKey(G, 'task', '022', 'T011'))
    await openFile(user)
    expect(api.invoke).not.toHaveBeenCalledWith('workflow:summary', expect.anything())
    await user.click(screen.getByRole('button', { name: /Expliquer ce fichier/ }))
    const panel = await screen.findByRole('region', { name: /Que fait ce fichier/ })
    expect(await within(panel).findByText('Range les cartes du projet.')).toBeDefined()
    expect(panel.textContent).toContain('ReçoitLa liste des cartes.')
    expect(panel.textContent).toContain('ProduitDes cartes rangées.')
    expect(panel.textContent).toContain('Expliqué par Claude (claude-sonnet-5-5)')
    expect(api.invoke).toHaveBeenCalledWith('workflow:summary', { genesisId: G, path: 'src/T011.ts' })
    await user.click(within(panel).getByRole('button', { name: 'Faire' }))
    expect(container.querySelector('[data-line="5"]')?.className).toContain('bg-accent/15')
    await expectNoAxeViolations(container)
    // Masquer puis rouvrir : l'explication reste en cache, sans nouvel appel.
    await user.click(within(panel).getByRole('button', { name: 'Masquer' }))
    await user.click(screen.getByRole('button', { name: /Expliquer ce fichier/ }))
    expect(await screen.findByText('Range les cartes du projet.')).toBeDefined()
    expect(summaries).toBe(1)
  })

  it('should_draw_the_small_diagram_highlight_a_part_on_click_and_copy_it_as_mermaid', async () => {
    // Après `userEvent.setup()`, qui installe son propre presse-papiers.
    const user = userEvent.setup()
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const { container } = renderCard(workflowKey(G, 'task', '022', 'T011'))
    await openFile(user)
    await user.click(screen.getByRole('button', { name: /Expliquer ce fichier/ }))
    const figure = await screen.findByRole('figure')
    expect(figure.textContent).toContain('l’entrée reçoit ranger ; ranger appelle Faire ; Faire renvoie la sortie')
    const box = [...figure.querySelectorAll('svg g')].find((group) => group.textContent?.endsWith('2. Faire'))
    fireEvent.click(box as Element)
    expect(container.querySelector('[data-line="5"]')?.className).toContain('bg-accent/15')
    await user.click(within(figure).getByRole('button', { name: 'Copier en Mermaid' }))
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('p1 -->|appelle| p2'))
    expect(await within(figure).findByRole('button', { name: 'Copié ✓' })).toBeDefined()
    await expectNoAxeViolations(container)
  })

  it('should_put_explanation_and_code_side_by_side_and_open_the_reader_full_screen', async () => {
    const user = userEvent.setup()
    const { container } = renderCard(workflowKey(G, 'task', '022', 'T011'))
    await openFile(user)
    const reader = (): Element | null => container.querySelector('section.workflow-reader-wide')
    expect(reader()).toBeNull()
    await user.click(screen.getByRole('button', { name: /Expliquer ce fichier/ }))
    await screen.findByText('Range les cartes du projet.')
    // Colonnes côte à côte (D17) : le lecteur s'élargit, l'explication et le code sont voisins.
    expect(reader()).not.toBeNull()
    await user.click(screen.getByRole('button', { name: /Agrandir/ }))
    const dialog = await screen.findByRole('dialog', { name: 'src/T011.ts' })
    expect(within(dialog).getByText('Range les cartes du projet.')).toBeDefined()
    expect(within(dialog).getByRole('navigation', { name: 'Raccourcis du fichier' })).toBeDefined()
    expect(screen.getByText(/est ouvert en grand/)).toBeDefined()
    await expectNoAxeViolations(document.body)
    // Échap réduit sans fermer la carte ni le lecteur.
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'src/T011.ts' })).toBeNull()
    const key = workflowKey(G, 'task', '022', 'T011')
    expect(useCards.getState().cards.find((entry) => entry.id === key)?.side).toBe('reader')
    expect(reader()).not.toBeNull()
  })

  it('should_say_it_failed_and_retry_on_demand', async () => {
    failFirstSummary = true
    const user = userEvent.setup()
    renderCard(workflowKey(G, 'task', '022', 'T011'))
    await openFile(user)
    await user.click(screen.getByRole('button', { name: /Expliquer ce fichier/ }))
    expect(await screen.findByRole('alert')).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByText('Range les cartes du projet.')).toBeDefined()
    expect(summaries).toBe(2)
  })
})
