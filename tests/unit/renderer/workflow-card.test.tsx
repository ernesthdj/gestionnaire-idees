import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { useCards, type OpenCard } from '../../../src/renderer/src/canvas/cards/cardsStore'
import { promptFor } from '../../../src/renderer/src/canvas/workflow/prompts'
import { discussWorkflow, WorkflowCard } from '../../../src/renderer/src/canvas/workflow/WorkflowCard'
import { workflowKey, workflowTree, type WorkflowItem } from '../../../src/renderer/src/canvas/workflow/workflowTree'
import type { ElementView } from '../../../src/shared/ipc/canvas'
import type { SpecView, TaskView, WorkflowView } from '../../../src/shared/ipc/workflow'
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

function renderCard(key: string, elements: readonly ElementView[] = [], missingFiles: readonly string[] = []) {
  useCards.setState({ cards: [card(key)], activeId: key })
  const api = installFakeApi({
    'workflow:file': (payload) => ({
      path: (payload as { path: string }).path,
      lang: 'other',
      lines: ['# Spec', '<script>alert(1)</script>']
    })
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
    expect(promptFor(item(workflowKey(G, 'spec', '022')))).toBeNull()
  })
})

describe('carte d’un nœud Workflow (spec 023 US2, US3)', () => {
  beforeEach(() => useUiStore.setState({ chatDrafts: {} }))

  it('should_open_the_project_conversation_with_the_instruction_prefilled_when_discussing_a_task', async () => {
    const user = userEvent.setup()
    const { container } = renderCard(workflowKey(G, 'task', '022', 'T011'))
    expect(screen.getByText('Tâche T011')).toBeDefined()
    expect(screen.getByText('US1 · Spec 022 · à faire')).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'Discuter' }))
    expect(useUiStore.getState().chatDrafts[G]).toContain('Implémente la tâche T011')
    expect(useCards.getState().cards.find((entry) => entry.id === G)).toMatchObject({ side: 'chat' })
    await expectNoAxeViolations(container)
  })

  it('should_show_stories_and_origin_docs_and_read_a_file_as_plain_text_when_a_spec_card_is_open', async () => {
    const user = userEvent.setup()
    const { api } = renderCard(workflowKey(G, 'spec', '022'))
    expect(screen.getByText('Spec 022')).toBeDefined()
    expect(screen.getByText('en cours · créée le 2026-10-08 · 29 décisions')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Discuter' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Détail' }))
    expect(screen.getByRole('region', { name: 'User stories' }).textContent).toContain('US1 · P1 Carte des idées')
    await user.click(screen.getByRole('button', { name: 'L1f-reprise-projet.md' }))
    await waitFor(() =>
      expect(api.invoke).toHaveBeenCalledWith('workflow:file', {
        genesisId: G,
        path: 'docs/brainstorm/L1f-reprise-projet.md'
      })
    )
    expect(await screen.findByText('<script>alert(1)</script>')).toBeDefined()
    expect(document.querySelector('script')).toBeNull()
  })

  it('should_list_the_family_docs_of_an_idea_to_brainstorm', async () => {
    const user = userEvent.setup()
    renderCard(workflowKey(G, 'doc', 'L1j-carte'))
    expect(screen.getByText('À brainstormer')).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'Détail' }))
    expect(screen.getByRole('button', { name: 'L2-carte-ecran.md' })).toBeDefined()
  })

  it('should_list_cited_files_read_their_code_grey_missing_ones_and_lead_to_the_structure', async () => {
    const user = userEvent.setup()
    useUiStore.setState({ structureViews: { [G]: 'workflow' } })
    const element: ElementView = {
      id: 'element-src',
      genesisId: G,
      parentId: G,
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
    const { api, container } = renderCard(workflowKey(G, 'story', '022', '1'), [element], ['src/T010.ts'])
    expect(screen.getByText('Fichiers (2)')).toBeDefined()
    expect(screen.getByTitle('src/T010.ts : introuvable dans le dossier du projet')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Lire src/T010.ts' })).toBeNull()
    await user.click(screen.getByTitle('Lire src/T011.ts'))
    await waitFor(() => expect(api.invoke).toHaveBeenCalledWith('workflow:file', { genesisId: G, path: 'src/T011.ts' }))
    await expectNoAxeViolations(container)
    await user.click(screen.getByRole('button', { name: 'Voir « Sources » dans la structure' }))
    expect(useUiStore.getState().structureViews[G]).toBe('progression')
    expect(useCards.getState().cards.some((entry) => entry.id === 'element-src')).toBe(true)
  })

  it('should_do_nothing_when_discussing_a_node_without_instruction', () => {
    useCards.setState({ cards: [], activeId: null })
    expect(discussWorkflow(item(workflowKey(G, 'spec', '022')), G)).toBe(false)
    expect(useCards.getState().cards).toEqual([])
  })
})
