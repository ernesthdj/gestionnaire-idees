import { describe, expect, it } from 'vitest'
import { buildGraph, computeLayout, stepShown } from '../../../src/renderer/src/canvas/buildGraph'
import type { BlockView, ElementView, IdeasCanvasView, StepView } from '../../../src/shared/ipc/canvas'
import { canvasView, RAW_ID } from '../../fixtures/ui/canvas'

describe('une étape n’apparaît que dans la vue où elle est née (spec 023 D19), jamais en Workflow (D22)', () => {
  it('should_show_a_step_only_in_its_own_view_and_never_in_workflow', () => {
    expect(stepShown({ view: 'workflow' }, 'workflow', true)).toBe(false)
    expect(stepShown({ view: 'progression' }, 'workflow', true)).toBe(false)
    expect(stepShown({ view: 'workflow' }, 'progression', true)).toBe(false)
    expect(stepShown({ view: 'progression' }, 'architecture', true)).toBe(false)
    expect(stepShown({ view: 'architecture' }, 'architecture', true)).toBe(true)
  })

  it('should_file_an_older_step_in_workflow_for_a_linked_project_and_in_progression_otherwise', () => {
    expect(stepShown({}, 'workflow', true)).toBe(false)
    expect(stepShown({}, 'progression', true)).toBe(false)
    expect(stepShown({}, 'progression', false)).toBe(true)
  })

  it('should_draw_only_the_blocks_of_the_view_shown_with_their_input_lines', () => {
    const base = canvasView()
    const widget = (id: string, view: 'workflow' | 'progression' | null): BlockView => ({
      id,
      kind: 'widget',
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      text: null,
      versionId: null,
      sourceBlockId: null,
      title: null,
      parentBlockId: null,
      frameId: null,
      origin: 'user',
      view
    })
    const view: IdeasCanvasView = {
      ...base,
      ideas: base.ideas.map((idea) => (idea.id === RAW_ID ? { ...idea, linkedProject: true } : idea)),
      blocks: [widget('w-flow', 'workflow'), widget('w-prog', 'progression'), widget('w-partout', null)],
      io: [
        { id: 'io1', blockId: 'w-prog', sourceKind: 'idea', sourceId: RAW_ID, parts: [], position: 1 }
      ] as unknown as IdeasCanvasView['io']
    }
    const graph = (shown: 'workflow' | 'progression'): { nodes: string[]; edges: string[] } => {
      const built = buildGraph(view, computeLayout(view), null, new Set(), { [RAW_ID]: shown })
      return {
        nodes: built.nodes
          .filter((node) => node.type === 'widget')
          .map((node) => node.id)
          .sort(),
        edges: built.edges.filter((edge) => edge.id.startsWith('io-')).map((edge) => edge.id)
      }
    }
    expect(graph('workflow')).toEqual({ nodes: ['w-flow', 'w-partout'], edges: [] })
    // Sans carte de structure, Progression n'est pas affichée : le genesis n'a que Workflow (choisi) ou aucune vue.
    expect(graph('progression').nodes).toEqual(['w-flow', 'w-partout', 'w-prog'])
  })

  it('should_show_every_step_when_the_map_has_no_view', () => {
    expect(stepShown({ view: 'progression' }, null, true)).toBe(true)
    expect(stepShown({}, null, false)).toBe(true)
  })

  it('should_switch_the_steps_drawn_on_the_map_with_its_view', () => {
    const step = (id: string, rank: number, view?: StepView['view']): StepView => ({
      id,
      genesisId: RAW_ID,
      parentId: RAW_ID,
      depth: 1,
      rank,
      title: id,
      status: 'a_faire',
      locked: false,
      lockProposed: false,
      waitsFor: [],
      offset: { x: 0, y: 0 },
      ...(view === undefined ? {} : { view })
    })
    const element: ElementView = {
      id: 'module-donnees',
      genesisId: RAW_ID,
      parentId: RAW_ID,
      key: 'donnees',
      type: 'module',
      title: 'Données',
      status: null,
      summary: null,
      paths: [],
      collapsed: true,
      childCount: 0,
      order: null
    }
    const base = canvasView()
    const view: IdeasCanvasView = {
      ...base,
      ideas: base.ideas.map((idea) => (idea.id === RAW_ID ? { ...idea, linkedProject: true } : idea)),
      elements: [element],
      steps: [step('ancienne', 1), step('cadrage', 2, 'workflow'), step('suivi', 3, 'progression')]
    }
    const graph = (views: Readonly<Record<string, 'workflow' | 'progression'>>): ReturnType<typeof buildGraph> =>
      buildGraph(view, computeLayout(view), null, new Set(), views)
    const drawn = (views: Readonly<Record<string, 'workflow' | 'progression'>>): string[] =>
      graph(views)
        .nodes.filter((node) => node.type === 'plan')
        .map((node) => node.id)
        .sort()
    expect(drawn({})).toEqual(['suivi'])
    expect(drawn({ [RAW_ID]: 'workflow' })).toEqual([])
    // Les étapes nées en Workflow sont signalées par la barre de la carte (D23).
    const bar = graph({ [RAW_ID]: 'workflow' }).nodes.find((node) => node.type === 'structureBar')
    expect(bar?.type === 'structureBar' ? bar.data.workflowSteps.map((entry) => entry.id) : null).toEqual([
      'ancienne',
      'cadrage'
    ])
  })
})
