import { describe, expect, it } from 'vitest'
import { buildGraph, computeLayout, stepShown } from '../../../src/renderer/src/canvas/buildGraph'
import type { ElementView, IdeasCanvasView, StepView } from '../../../src/shared/ipc/canvas'
import { canvasView, RAW_ID } from '../../fixtures/ui/canvas'

describe('une étape n’apparaît que dans la vue où elle est née (spec 023 D19)', () => {
  it('should_show_a_step_only_in_its_own_view', () => {
    expect(stepShown({ view: 'workflow' }, 'workflow', true)).toBe(true)
    expect(stepShown({ view: 'workflow' }, 'progression', true)).toBe(false)
    expect(stepShown({ view: 'progression' }, 'architecture', true)).toBe(false)
    expect(stepShown({ view: 'architecture' }, 'architecture', true)).toBe(true)
  })

  it('should_file_an_older_step_in_workflow_for_a_linked_project_and_in_progression_otherwise', () => {
    expect(stepShown({}, 'workflow', true)).toBe(true)
    expect(stepShown({}, 'progression', true)).toBe(false)
    expect(stepShown({}, 'progression', false)).toBe(true)
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
    const drawn = (views: Readonly<Record<string, 'workflow' | 'progression'>>): string[] =>
      buildGraph(view, computeLayout(view), null, new Set(), views)
        .nodes.filter((node) => node.type === 'plan')
        .map((node) => node.id)
        .sort()
    expect(drawn({})).toEqual(['suivi'])
    expect(drawn({ [RAW_ID]: 'workflow' })).toEqual(['ancienne', 'cadrage'])
  })
})
