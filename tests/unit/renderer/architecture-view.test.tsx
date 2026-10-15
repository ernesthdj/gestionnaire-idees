import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { ArchitectureView } from '../../../src/renderer/src/canvas/ArchitectureView'
import { buildGraph, computeLayout, type StructureBarNodeType } from '../../../src/renderer/src/canvas/buildGraph'
import { ElementLayerSelect } from '../../../src/renderer/src/canvas/nodes/ElementNode'
import { StructureBar, StructureBarNode } from '../../../src/renderer/src/canvas/nodes/StructureBarNode'
import { ArchitectureDetector } from '../../../src/renderer/src/explorer/ArchitectureDetector'
import type { ElementView } from '../../../src/shared/ipc/canvas'
import type { ExplorerMapView, MapFileView } from '../../../src/shared/ipc/reprise'
import { expectNoAxeViolations } from '../../support/axe'
import { canvasView, RAW_ID } from '../../fixtures/ui/canvas'
import { FakeIpcError, installFakeApi } from './support/fakeApi'

const element = (id: string, extra: Partial<ElementView> = {}): ElementView => ({
  id,
  genesisId: RAW_ID,
  parentId: RAW_ID,
  key: id,
  type: 'module',
  title: id,
  status: null,
  summary: null,
  paths: [],
  collapsed: true,
  childCount: 0,
  order: null,
  ...extra
})
const file = (path: string): MapFileView => ({
  key: `f:${path}`,
  path,
  moduleKey: 'm:dir:',
  title: path.split('/').at(-1) ?? path,
  folder: '',
  lang: 'cs',
  lines: 10,
  role: null,
  functions: [],
  depth: 0,
  external: false,
  plumbing: false
})
/** Carte d'un projet Clean dont le domaine appelle l'infrastructure (une violation). */
const MAP: ExplorerMapView = {
  modules: [],
  files: [file('Domain/OrderService.cs'), file('Infrastructure/SqlOrderRepository.cs')],
  calls: [
    {
      from: 'f:Domain/OrderService.cs',
      to: 'f:Infrastructure/SqlOrderRepository.cs',
      count: 1,
      provenance: 'syntax',
      sentences: []
    }
  ],
  truncated: false,
  confidentiality: 'local',
  folderMissing: false
}

const wrap = (node: React.JSX.Element) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ReactFlowProvider>{node}</ReactFlowProvider>
    </QueryClientProvider>
  )
const bar = (hasMap: boolean) =>
  ({
    data: { genesisId: RAW_ID, view: 'workflow', hasMap, strays: { steps: [], elements: [] } }
  }) as unknown as NodeProps<StructureBarNodeType>

describe('position Architecture = l’explorateur dans la carte (spec 032 D14, D15)', () => {
  beforeEach(() => useUiStore.setState({ structureViews: {} }))

  it('should_draw_no_layer_band_and_keep_the_map_below_when_switched_to_architecture', () => {
    const view = {
      ...canvasView(),
      elements: [element('core', { layer: 'domaine' }), element('db', { layer: 'infrastructure' })],
      architectures: [{ genesisId: RAW_ID, kind: 'clean', reason: null, source: 'claude' } as const]
    }
    const graph = buildGraph(view, computeLayout(view), null, new Set(), { [RAW_ID]: 'architecture' })
    expect(graph.nodes.find((node) => node.type === 'structureBar')?.data).toMatchObject({ view: 'architecture' })
    // Les bandes de couches (spec 017 D20) sont retirées : la carte dessous garde sa Progression.
    expect(graph.nodes.filter((node) => node.type === 'element').map((node) => node.id)).toEqual(['core', 'db'])
  })

  it('should_offer_architecture_without_a_drawn_map_and_keep_a_single_map_in_that_position', async () => {
    const user = userEvent.setup()
    installFakeApi()
    useUiStore.setState({ structureViews: { other: 'architecture' } })
    const { container } = wrap(<StructureBarNode {...bar(false)} />)
    // Progression et Architecture lisent la doc et le code : aucune ne demande de carte dessinée (spec 032 Q3).
    expect((screen.getByRole('button', { name: 'Progression' }) as HTMLButtonElement).disabled).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Architecture' }))
    expect(useUiStore.getState().structureViews).toEqual({ other: 'workflow', [RAW_ID]: 'architecture' })
    // Le choix de l'architecture a quitté la barre : il est en tête de l'explorateur.
    expect(screen.queryByRole('combobox', { name: 'Architecture' })).toBeNull()
    await expectNoAxeViolations(container)
  })

  it('should_say_the_detected_architecture_and_its_reason_and_let_mentalyas_correct_it', async () => {
    const user = userEvent.setup()
    const api = installFakeApi({ 'structure:setArchitecture': () => ({ batchId: 'b1' }) })
    const { container } = wrap(<ArchitectureDetector genesisId={RAW_ID} map={MAP} stored={null} />)
    const select = screen.getByRole('combobox', { name: 'Architecture' }) as HTMLSelectElement
    expect(select.value).toBe('clean')
    expect(screen.getByText('reconnue par l’app')).toBeTruthy()
    expect(
      screen.getByText('· Dossiers « Domain » et « Infrastructure » ; 1 appel sort du cœur vers l’extérieur.')
    ).toBeTruthy()
    await user.selectOptions(select, 'hexagonale')
    expect(api.invoke).toHaveBeenCalledWith('structure:setArchitecture', { genesisId: RAW_ID, kind: 'hexagonale' })
    await expectNoAxeViolations(container)
  })

  it('should_put_the_choice_of_mentalyas_first_and_still_say_what_the_app_sees', () => {
    wrap(
      <ArchitectureDetector
        genesisId={RAW_ID}
        map={MAP}
        stored={{ kind: 'hexagonale', reason: null, source: 'user' }}
      />
    )
    expect((screen.getByRole('combobox', { name: 'Architecture' }) as HTMLSelectElement).value).toBe('hexagonale')
    expect(screen.getByText('choisie par toi')).toBeTruthy()
    expect(screen.getByText(/L’app y voit : Clean Architecture\./)).toBeTruthy()
  })

  it('should_offer_to_analyse_the_code_when_the_project_has_no_analysis', async () => {
    const user = userEvent.setup()
    const api = installFakeApi({
      'reprise:get': () => {
        throw new FakeIpcError('NOT_FOUND')
      },
      'reprise:adopt': () => ({ genesisId: RAW_ID })
    })
    const { container } = wrap(<ArchitectureView genesisId={RAW_ID} />)
    expect(await screen.findByRole('heading', { name: 'Le code de ce projet n’est pas encore analysé' })).toBeTruthy()
    // La bascule des vues est dans la barre fine (spec 033 D10), plus dans le panneau.
    expect(screen.queryByRole('group', { name: 'Vue de la carte' })).toBeNull()
    await user.click(screen.getByLabelText('Local uniquement : rien ne part chez Claude'))
    await user.click(screen.getByRole('button', { name: 'Analyser' }))
    expect(api.invoke).toHaveBeenCalledWith('reprise:adopt', { genesisId: RAW_ID, confidentiality: 'local' })
    await expectNoAxeViolations(container)
  })

  it('should_correct_the_layer_from_the_detail_card_and_say_when_it_was_inferred', async () => {
    const user = userEvent.setup()
    const api = installFakeApi({ 'element:setLayer': () => ({ batchId: 'b2' }) })
    const { container } = wrap(
      <ElementLayerSelect
        element={element('e1', { layer: 'presentation', layerSource: 'deduite', paths: ['src/ui'] })}
        architecture="clean"
      />
    )
    expect(screen.getByText('déduite')).toBeTruthy()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Couche de « e1 »' }), 'domaine')
    expect(api.invoke).toHaveBeenCalledWith('element:setLayer', { elementId: 'e1', layer: 'domaine' })
    await expectNoAxeViolations(container)
  })

  it('should_sit_in_the_thin_bar_as_rounded_pills_with_what_to_report_behind_a_warning_pill', async () => {
    const user = userEvent.setup()
    installFakeApi()
    const { container } = wrap(
      <StructureBar
        genesisId={RAW_ID}
        view="progression"
        hasMap
        strays={{ steps: [], elements: [{ id: 'e1', parentId: RAW_ID, title: 'Tâche posée', type: 'tache' }] }}
        inHeader
      />
    )
    // Barre fine (spec 033 D10) : une ligne de pastilles ; ce qui est à reporter attend derrière une pastille ⚠.
    expect(screen.getByRole('group', { name: 'Vue de la carte' }).className).toContain('rounded-full')
    expect(screen.queryByRole('button', { name: 'Les retirer' })).toBeNull()
    await user.click(screen.getByRole('button', { name: /1 à reporter/ }))
    expect(screen.getByRole('button', { name: 'Les reporter dans les fichiers' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Les retirer' })).toBeTruthy()
    await expectNoAxeViolations(container)
  })
})
