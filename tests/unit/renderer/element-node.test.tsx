import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import type { ElementNodeType } from '../../../src/renderer/src/canvas/buildGraph'
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

const renderNode = (content: ElementContentView | null, status: ElementStatus | null = null) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ReactFlowProvider>
        <ElementNode
          {...({ data: { element: element(content, status), number: '1' } } as unknown as NodeProps<ElementNodeType>)}
        />
      </ReactFlowProvider>
    </QueryClientProvider>
  )

describe('nœud d’élément selon son contenu (spec 017 D18)', () => {
  it('should_look_like_a_page_with_a_doc_badge_when_it_holds_only_documentation', async () => {
    const { container } = renderNode({ kind: 'doc', code: 0, doc: 3 })
    expect(container.querySelector('article')?.dataset['content']).toBe('doc')
    expect(screen.getByText('📄 Doc').getAttribute('title')).toBe('Cet élément contient de la documentation')
    await expectNoAxeViolations(container)
  })

  it('should_look_like_an_editor_with_its_doc_count_when_it_holds_code', async () => {
    const { container } = renderNode({ kind: 'code', code: 12, doc: 2 })
    expect(container.querySelector('article')?.dataset['content']).toBe('code')
    expect(screen.getByText('</> Code + 2 doc')).toBeTruthy()
    expect(screen.getByText('Processus principal').getAttribute('title')).toBe('Processus principal')
    await expectNoAxeViolations(container)
  })

  it('should_keep_the_usual_look_without_badge_when_no_file_is_covered', () => {
    const { container } = renderNode(null)
    expect(container.querySelector('article')?.dataset['content']).toBe('none')
    expect(screen.queryByText(/Doc|Code/)).toBeNull()
    expect(screen.getByText('1 chemin')).toBeTruthy()
  })
})

describe('état visuel du statut (spec 017 D19)', () => {
  it.each([
    ['en_cours', '◐', 'en cours', 'bg-blue-500'],
    ['livree', '✓', 'livrée', 'bg-green-500'],
    ['bloquee', '⛔', 'bloquée', 'bg-red-500']
  ] as const)('should_show_icon_label_and_stripe_when_the_status_is_%s', async (status, icon, label, stripe) => {
    const { container } = renderNode({ kind: 'code', code: 1, doc: 0 }, status)
    const article = container.querySelector('article')
    expect(article?.dataset['status']).toBe(status)
    expect(screen.getByText(label).parentElement?.textContent).toContain(icon)
    expect(container.querySelector(`.${stripe}`)).not.toBeNull()
    await expectNoAxeViolations(container)
  })

  it('should_add_a_dashed_outline_only_when_the_element_is_blocked', () => {
    const blocked = renderNode(null, 'bloquee').container.querySelector('article')?.className ?? ''
    expect(blocked).toContain('outline-dashed')
    const done = renderNode(null, 'livree').container.querySelectorAll('article')[1]?.className ?? ''
    expect(done).not.toContain('outline-dashed')
  })
})
