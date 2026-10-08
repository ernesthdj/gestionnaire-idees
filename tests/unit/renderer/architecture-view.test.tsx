import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import {
  buildGraph,
  computeLayout,
  type ElementNodeType,
  type LayerBandNodeType,
  type StructureBarNodeType
} from '../../../src/renderer/src/canvas/buildGraph'
import { ElementNode } from '../../../src/renderer/src/canvas/nodes/ElementNode'
import { LayerBandNode } from '../../../src/renderer/src/canvas/nodes/LayerBandNode'
import { StructureBarNode } from '../../../src/renderer/src/canvas/nodes/StructureBarNode'
import type { ElementView, StructureArchitectureView } from '../../../src/shared/ipc/canvas'
import { expectNoAxeViolations } from '../../support/axe'
import { canvasView, RAW_ID } from '../../fixtures/ui/canvas'
import { installFakeApi } from './support/fakeApi'

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
const CLEAN: StructureArchitectureView = { genesisId: RAW_ID, kind: 'clean', reason: 'dossiers', source: 'claude' }

const wrap = (node: React.JSX.Element) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ReactFlowProvider>{node}</ReactFlowProvider>
    </QueryClientProvider>
  )

describe('vue Architecture à l’écran (spec 017 D20)', () => {
  beforeEach(() => useUiStore.setState({ structureViews: {} }))

  it('should_keep_the_progression_view_until_the_map_is_switched_then_draw_bands_and_red_violations', () => {
    const view = {
      ...canvasView(),
      elements: [
        element('core', { layer: 'domaine', layerSource: 'claude' }),
        element('db', { layer: 'infrastructure' })
      ],
      architectures: [CLEAN],
      measuredLinks: [{ from: 'core', to: 'db', count: 3, provenance: 'syntax' } as const]
    }
    const before = buildGraph(view, computeLayout(view))
    expect(before.nodes.some((node) => node.type === 'layerBand')).toBe(false)
    expect(before.nodes.find((node) => node.type === 'structureBar')?.data).toMatchObject({ view: 'progression' })
    const after = buildGraph(view, computeLayout(view), null, new Set(), { [RAW_ID]: 'architecture' })
    expect(after.nodes.filter((node) => node.type === 'layerBand').map((node) => node.ariaLabel)).toEqual([
      'Couche Présentation : 0 élément',
      'Couche Infrastructure : 1 élément',
      'Couche Application : 0 élément',
      'Couche Domaine : 1 élément'
    ])
    const violation = after.mapEdges.find((edge) => edge.source === 'core')
    expect(violation?.data).toMatchObject({ violation: true, label: expect.stringContaining('⚠ sens interdit') })
    expect(after.nodes.find((node) => node.id === 'core')?.ariaLabel).toContain('couche Domaine')
  })

  it('should_switch_views_and_set_the_architecture_from_the_map_bar', async () => {
    const user = userEvent.setup()
    const api = installFakeApi({ 'structure:setArchitecture': () => ({ batchId: 'b1' }) })
    const props = { data: { genesisId: RAW_ID, view: 'progression', architecture: CLEAN } }
    const { container } = wrap(<StructureBarNode {...(props as unknown as NodeProps<StructureBarNodeType>)} />)
    await user.click(screen.getByRole('button', { name: 'Architecture' }))
    expect(useUiStore.getState().structureViews[RAW_ID]).toBe('architecture')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Architecture' }), 'mvvm')
    expect(api.invoke).toHaveBeenCalledWith('structure:setArchitecture', { genesisId: RAW_ID, kind: 'mvvm' })
    expect(screen.getByText('reconnue par Claude')).toBeTruthy()
    await expectNoAxeViolations(container)
  })

  it('should_disable_the_architecture_view_when_no_architecture_is_known', () => {
    const props = { data: { genesisId: RAW_ID, view: 'progression', architecture: null } }
    wrap(<StructureBarNode {...(props as unknown as NodeProps<StructureBarNodeType>)} />)
    expect((screen.getByRole('button', { name: 'Architecture' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('should_label_a_band_with_its_layer_and_count', async () => {
    const band = {
      id: 'b',
      genesisId: RAW_ID,
      layer: null,
      label: 'Non classés',
      count: 2,
      x: 0,
      y: 0,
      width: 800,
      height: 200
    }
    const { container } = wrap(<LayerBandNode {...({ data: { band } } as unknown as NodeProps<LayerBandNodeType>)} />)
    expect(screen.getByText('Non classés')).toBeTruthy()
    expect(screen.getByText('2 éléments')).toBeTruthy()
    await expectNoAxeViolations(container)
  })

  it('should_correct_the_layer_from_the_node_chip_and_say_when_it_was_inferred', async () => {
    const user = userEvent.setup()
    const api = installFakeApi({ 'element:setLayer': () => ({ batchId: 'b2' }) })
    const data = {
      element: element('e1', { layer: 'presentation', layerSource: 'deduite', paths: ['src/ui'] }),
      number: '1',
      architecture: 'clean'
    }
    const { container } = wrap(<ElementNode {...({ data } as unknown as NodeProps<ElementNodeType>)} />)
    expect(screen.getByText('déduite')).toBeTruthy()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Couche de « e1 »' }), 'domaine')
    expect(api.invoke).toHaveBeenCalledWith('element:setLayer', { elementId: 'e1', layer: 'domaine' })
    await expectNoAxeViolations(container)
  })
})
