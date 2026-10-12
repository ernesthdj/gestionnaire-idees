import { describe, expect, it } from 'vitest'
import { buildGraph, computeLayout, type FolderNodeType } from '../../../src/renderer/src/canvas/buildGraph'
import { FOLDER_NODE_SIZE } from '../../../src/renderer/src/canvas/folder/folderGeometry'
import { folderNodeId } from '../../../src/renderer/src/canvas/planLayout'
import type { ElementView, IdeasCanvasView, StepView } from '../../../src/shared/ipc/canvas'
import type { FolderAnchor, FolderBadge } from '../../../src/shared/ipc/folders'
import { canvasView, HATCHED_A_ID, RAW_ID } from '../../fixtures/ui/canvas'

const STEP = '00000000-0000-4000-8000-0000000005a1'
const ELEMENT = '00000000-0000-4000-8000-0000000005e1'
const CHAT = '00000000-0000-4000-8000-0000000005c1'

const badge = (neuronId: string, anchor: FolderAnchor = { kind: 'neuron', id: neuronId }, offset = { x: 0, y: 0 }) =>
  ({
    neuronId,
    anchor,
    count: 2,
    unseen: false,
    preview: [],
    offset,
    moved: offset.x !== 0 || offset.y !== 0
  }) satisfies FolderBadge

const step = (id: string, parentId: string): StepView => ({
  id,
  genesisId: HATCHED_A_ID,
  parentId,
  depth: 1,
  rank: 1,
  title: 'Choisir le lieu',
  status: 'a_faire',
  locked: false,
  lockProposed: false,
  waitsFor: [],
  offset: { x: 0, y: 0 }
})

const element: ElementView = {
  id: ELEMENT,
  genesisId: RAW_ID,
  parentId: RAW_ID,
  key: 'module:compta',
  type: 'module',
  title: 'Comptabilité',
  status: 'en_cours',
  summary: null,
  paths: [],
  collapsed: false,
  childCount: 0,
  order: null
}

const folders = (view: IdeasCanvasView): FolderNodeType[] =>
  buildGraph(view, computeLayout(view)).nodes.filter((node): node is FolderNodeType => node.type === 'folder')
const edgesOf = (view: IdeasCanvasView) => buildGraph(view, computeLayout(view)).edges

describe('place du dossier d’un nœud sur la carte (spec 028 D6)', () => {
  it('should_place_the_folder_of_a_genesis_below_it_in_the_annex_slot_of_its_plan', () => {
    const view = { ...canvasView(), folders: [badge(HATCHED_A_ID)] }
    const [folder] = folders(view)
    const genesis = buildGraph(view, computeLayout(view)).nodes.find((node) => node.id === HATCHED_A_ID)
    expect(folder).toMatchObject({ id: folderNodeId(HATCHED_A_ID), width: FOLDER_NODE_SIZE.width, draggable: true })
    expect(folder?.data).toMatchObject({ title: 'Mission mariage', kindLabel: 'Idée' })
    expect((folder?.position.y ?? 0) > (genesis?.position.y ?? 0)).toBe(true)
    expect(
      edgesOf(view).some((edge) => edge.source === HATCHED_A_ID && edge.target === folderNodeId(HATCHED_A_ID))
    ).toBe(true)
  })

  it('should_place_the_folder_of_a_step_among_its_annexes_and_apply_the_dragged_offset', () => {
    const base = { ...canvasView(), steps: [step(STEP, HATCHED_A_ID)] }
    const still = folders({ ...base, folders: [badge(STEP)] })[0]
    const moved = folders({ ...base, folders: [badge(STEP, undefined, { x: 120, y: -40 })] })[0]
    expect(still?.data).toMatchObject({ title: 'Choisir le lieu', kindLabel: 'Étape' })
    expect(moved?.position.x).toBeCloseTo((still?.position.x ?? 0) + 120)
    expect(moved?.position.y).toBeCloseTo((still?.position.y ?? 0) - 40)
  })

  it('should_place_the_folder_of_a_structure_element_on_its_free_left_side', () => {
    const view = { ...canvasView(), elements: [element], folders: [badge(ELEMENT)] }
    const graph = buildGraph(view, computeLayout(view))
    const node = graph.nodes.find((entry) => entry.id === ELEMENT)
    const folder = graph.nodes.find((entry) => entry.id === folderNodeId(ELEMENT))
    expect(folder?.position.y).toBe(node?.position.y)
    expect((node?.position.x ?? 0) - (folder?.position.x ?? 0)).toBeGreaterThan(FOLDER_NODE_SIZE.width / 2)
    expect(folder?.data).toMatchObject({ title: 'Comptabilité', kindLabel: 'Élément' })
  })

  it('should_draw_no_folder_when_its_node_is_not_drawn', () => {
    const anchor: FolderAnchor = { kind: 'workflow', key: `wf:${RAW_ID}:task:028:T010`, genesisId: RAW_ID }
    expect(folders({ ...canvasView(), folders: [badge(CHAT, anchor)] })).toEqual([])
    expect(folders({ ...canvasView(), folders: [badge('00000000-0000-4000-8000-00000000dead')] })).toEqual([])
  })

  it('should_hide_the_folder_with_its_step_when_the_plan_is_folded', () => {
    const ideas = canvasView().ideas.map((idea) => (idea.id === HATCHED_A_ID ? { ...idea, planCollapsed: true } : idea))
    const view = { ...canvasView(), ideas, steps: [step(STEP, HATCHED_A_ID)], folders: [badge(STEP)] }
    expect(folders(view)[0]?.className).toBe('living-gone')
  })
})
