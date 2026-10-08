import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import type { ElementNodeType } from '../../../src/renderer/src/canvas/buildGraph'
import type { NodeVisual } from '../../../src/renderer/src/canvas/living/nodeVisual'
import { ElementNode } from '../../../src/renderer/src/canvas/nodes/ElementNode'
import type { ElementContentView, ElementStatus, ElementView } from '../../../src/shared/ipc/canvas'
import { expectNoAxeViolations } from '../../support/axe'

const element = (content: ElementContentView | null, status: ElementStatus | null = null): ElementView => ({
  id: 'e1',
  genesisId: 'g',
  parentId: 'g',
  key: 'e1',
  type: 'module',
  title: 'Processus principal',
  status,
  summary: 'Résumé de l’élément',
  paths: ['src/main'],
  collapsed: false,
  childCount: 0,
  order: null,
  content
})

const visual: NodeVisual = { depth: 1, branch: 2, size: 58, icon: 'module', orb: false }

const renderNode = (content: ElementContentView | null, status: ElementStatus | null = null) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ReactFlowProvider>
        <ElementNode
          {...({
            data: {
              element: element(content, status),
              number: '1',
              visual: { ...visual, ...(status === null ? {} : { status: STATUS[status] }) },
              open: false
            }
          } as unknown as NodeProps<ElementNodeType>)}
        />
      </ReactFlowProvider>
    </QueryClientProvider>
  )

const STATUS = { en_cours: 'doing', livree: 'done', bloquee: 'blocked' } as Record<string, NodeVisual['status']>
const wrapper = (container: HTMLElement): HTMLElement | null => container.querySelector('.living-element')

describe('nœud d’élément selon son contenu (spec 017 D18, spec 022 US3)', () => {
  it('should_show_a_doc_badge_when_it_holds_only_documentation', async () => {
    const { container } = renderNode({ kind: 'doc', code: 0, doc: 3 })
    expect(wrapper(container)?.dataset['content']).toBe('doc')
    expect(container.querySelector('.living-clip-kind')?.textContent).toContain('Doc')
    expect(container.querySelector('.living-clip-kind')?.getAttribute('title')).toBe(
      'Cet élément contient de la documentation'
    )
    await expectNoAxeViolations(container)
  })

  it('should_show_a_code_badge_with_its_doc_count_in_its_title_when_it_holds_code', async () => {
    const { container } = renderNode({ kind: 'code', code: 12, doc: 2 })
    expect(wrapper(container)?.dataset['content']).toBe('code')
    expect(container.querySelector('.living-clip-kind')?.textContent).toContain('</>')
    expect(container.querySelector('.living-clip-kind')?.getAttribute('title')).toBe(
      'Cet élément contient du code et 2 fichiers de documentation'
    )
    expect(screen.getByText('Processus principal')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()
    await expectNoAxeViolations(container)
  })

  it('should_show_no_badge_but_a_paperclip_when_its_paths_cover_no_known_content', () => {
    const { container } = renderNode(null)
    expect(wrapper(container)?.dataset['content']).toBe('none')
    expect(container.querySelector('.living-clip-kind')).toBeNull()
    expect(screen.getByText('Fichiers à lire')).toBeTruthy()
  })
})

describe('état visuel du statut (spec 017 D19, spec 022 US3)', () => {
  it.each([
    ['en_cours', 'En cours', 'living-status-doing'],
    ['livree', 'Livré', 'living-status-done'],
    ['bloquee', 'Bloqué', 'living-status-blocked']
  ] as const)('should_show_a_labelled_status_dot_when_the_status_is_%s', async (status, label, dot) => {
    const { container } = renderNode({ kind: 'code', code: 1, doc: 0 }, status)
    expect(wrapper(container)?.dataset['status']).toBe(status)
    expect(screen.getByText(label)).toBeTruthy()
    expect(container.querySelector(`.${dot}`)).not.toBeNull()
    await expectNoAxeViolations(container)
  })

  it('should_add_a_dashed_outline_only_when_the_element_is_blocked', () => {
    expect(wrapper(renderNode(null, 'bloquee').container)?.className).toContain('living-blocked')
    expect(wrapper(renderNode(null, 'livree').container)?.className).not.toContain('living-blocked')
  })
})
