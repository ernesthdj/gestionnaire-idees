import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { buildGraph, computeLayout, type ElementNodeType } from '../../../src/renderer/src/canvas/buildGraph'
import { ElementNode } from '../../../src/renderer/src/canvas/nodes/ElementNode'
import { cardHead } from '../../../src/renderer/src/canvas/cards/cardContent'
import type { ElementView } from '../../../src/shared/ipc/canvas'
import { expectNoAxeViolations } from '../../support/axe'
import { canvasView, RAW_ID } from '../../fixtures/ui/canvas'

const element = (id: string, extra: Partial<ElementView> = {}): ElementView => ({
  id,
  genesisId: RAW_ID,
  parentId: RAW_ID,
  key: id,
  type: 'composant',
  title: id,
  status: 'en_cours',
  summary: null,
  paths: [],
  collapsed: false,
  childCount: 0,
  order: null,
  ...extra
})

const renderNode = (data: unknown) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ReactFlowProvider>
        <ElementNode {...({ data } as unknown as NodeProps<ElementNodeType>)} />
      </ReactFlowProvider>
    </QueryClientProvider>
  )

describe('avancement d’un élément (spec 017 D21, dans la carte de détails : spec 022 US3)', () => {
  const subject = (extra: Partial<ElementView>, percent: number | null, note: string | null) =>
    ({
      kind: 'element',
      element: element('Migrations', extra),
      number: '2.2',
      typeLabel: 'Composant',
      statusLabel: 'en cours',
      percent,
      contentText: null,
      note
    }) as const

  it('should_show_the_percent_and_what_remains_when_claude_declared_progress', () => {
    const head = cardHead(subject({ progress: 60, progressNote: 'tests à écrire' }, 60, 'tests à écrire'))
    expect(head.gauge).toEqual({ label: 'Avancement', value: 60, text: '60 %' })
    expect(head.summary).toBe('Reste : tests à écrire')
    expect(head.meta).toBe('n° 2.2 · en cours')
  })

  it('should_show_no_gauge_without_any_progress_information', () => {
    expect(cardHead(subject({}, null, null)).gauge).toBeNull()
  })

  it('should_render_the_node_without_any_progress_bar_on_it', async () => {
    const { container } = renderNode({
      element: element('Migrations', { progress: 60, progressNote: 'tests à écrire' }),
      number: '2.2',
      progress: { percent: 60, fromChildren: false },
      visual: { depth: 2, branch: 1, size: 44, icon: 'component', orb: false, status: 'doing' },
      open: false
    })
    expect(container.querySelector('[data-progress]')).toBeNull()
    expect(screen.queryByText(/%$/)).toBeNull()
    await expectNoAxeViolations(container)
  })

  it('should_announce_the_rolled_up_progress_of_a_parent_in_its_accessible_label', () => {
    const view = {
      ...canvasView(),
      elements: [
        element('parent', { status: null, childCount: 2 }),
        element('a', { parentId: 'parent', status: 'livree' }),
        element('b', { parentId: 'parent', progress: 0 })
      ]
    }
    const parent = buildGraph(view, computeLayout(view)).nodes.find((node) => node.id === 'parent')
    expect(parent?.ariaLabel).toContain('avancement 50 %')
    expect(parent?.data).toMatchObject({ progress: { percent: 50, fromChildren: true } })
  })
})
