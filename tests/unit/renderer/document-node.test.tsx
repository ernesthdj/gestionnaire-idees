import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useCards } from '../../../src/renderer/src/canvas/cards/cardsStore'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { IdeasCanvas } from '../../../src/renderer/src/canvas/IdeasCanvas'
import { DEFAULT_APP_SETTINGS } from '../../../src/shared/ipc/app'
import type { IdeasCanvasView } from '../../../src/shared/ipc/canvas'
import type { DocumentContentView } from '../../../src/shared/ipc/documents'
import { expectNoAxeViolations } from '../../support/axe'
import { canvasView, HATCHED_A_ID } from '../../fixtures/ui/canvas'
import { installFakeApi } from './support/fakeApi'
import { installReactFlowMocks } from './support/reactFlowMocks'

const DOC = '00000000-0000-4000-8000-000000000401'
const CONTENT = [
  '# Cahier des charges',
  '',
  '## Objectif',
  '',
  '- [x] Budget validé',
  '- [ ] Lieu',
  '',
  '| Poste | Montant |',
  '| --- | --- |',
  '| Loyer | 900 € |',
  '',
  '<script>window.pirate = true</script>',
  '',
  '```ts',
  'const x = 1',
  '```'
].join('\n')

function documentView(): IdeasCanvasView {
  return {
    ...canvasView(),
    documents: [
      {
        id: DOC,
        neuronId: HATCHED_A_ID,
        genesisId: HATCHED_A_ID,
        title: 'Cahier des charges',
        fileLabel: 'docs/brainstormer/cahier-des-charges.md',
        width: 360,
        height: 280,
        origin: 'claude',
        offset: { x: 0, y: 0 }
      }
    ]
  }
}

function renderCanvas(content: Partial<DocumentContentView> = {}) {
  const api = installFakeApi({
    'canvas:get': () => documentView(),
    'canvas:savePositions': () => ({ ok: true }),
    'app:getSettings': () => DEFAULT_APP_SETTINGS,
    'document:get': () => ({ id: DOC, content: CONTENT, hash: 'h', missing: false, ...content }),
    'document:reveal': () => ({ ok: true }),
    'document:recreate': () => ({ ok: true })
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(
    <QueryClientProvider client={client}>
      <IdeasCanvas />
    </QueryClientProvider>
  )
  return { api, ...result }
}

/** Spec 022 : le document est un nœud ; sa carte de détails s'étire en lecteur (« Lire le document »). */
async function node(): Promise<HTMLElement> {
  fireEvent.click(await screen.findByText('Cahier des charges'))
  const card = await screen.findByRole('dialog', { name: 'Détails : Cahier des charges' })
  if (within(card).queryByRole('region', { name: 'Document : Cahier des charges' }) === null)
    fireEvent.click(within(card).getByRole('button', { name: 'Lire le document' }))
  return within(card).findByRole('region', { name: 'Document : Cahier des charges' })
}

describe('nœud document sur la carte (spec 012 US1)', () => {
  beforeAll(() => installReactFlowMocks())
  beforeEach(() => {
    useUiStore.setState({ view: 'ideas', chatNeuronId: null, toast: null })
    useCards.setState({ cards: [], activeId: null })
  })

  it('should_render_the_markdown_of_the_file_with_its_location_and_without_raw_html', async () => {
    renderCanvas()
    const section = await node()
    expect(await within(section).findByRole('heading', { name: 'Cahier des charges', level: 3 })).toBeDefined()
    expect(within(section).getByText('docs/brainstormer/cahier-des-charges.md')).toBeDefined()
    expect(within(section).getByRole('table')).toBeDefined()
    expect(within(section).getAllByRole('checkbox')).toHaveLength(2)
    expect(section.querySelector('script')).toBeNull()
    expect((window as unknown as { pirate?: boolean }).pirate).toBeUndefined()
  })

  it('should_scroll_inside_the_node_without_zooming_the_map', async () => {
    renderCanvas()
    const section = await node()
    await within(section).findByRole('table')
    expect(section.querySelector('.nowheel.overflow-y-auto')).not.toBeNull()
  })

  it('should_reveal_the_file_through_the_main_process', async () => {
    const user = userEvent.setup()
    const { api } = renderCanvas()
    await user.click(within(await node()).getByRole('button', { name: 'Ouvrir le dossier' }))
    expect(api.invoke).toHaveBeenCalledWith('document:reveal', { id: DOC })
  })

  it('should_offer_to_recreate_a_missing_file_from_its_last_version', async () => {
    const user = userEvent.setup()
    const { api } = renderCanvas({ missing: true })
    const section = await node()
    expect((await within(section).findByRole('alert')).textContent).toMatch(/Fichier introuvable/)
    await user.click(within(section).getByRole('button', { name: 'Recréer le fichier' }))
    expect(api.invoke).toHaveBeenCalledWith('document:recreate', { id: DOC })
  })

  it('should_not_open_a_conversation_when_the_document_is_clicked', async () => {
    renderCanvas()
    fireEvent.click(await within(await node()).findByRole('table'))
    await waitFor(() => expect(useUiStore.getState().chatNeuronId).toBeNull())
    const card = screen.getByRole('dialog', { name: 'Détails : Cahier des charges' })
    expect(within(card).queryByRole('button', { name: 'Discuter' })).toBeNull()
  })

  it('should_have_no_accessibility_violation', async () => {
    const { container } = renderCanvas()
    await within(await node()).findByRole('table')
    await expectNoAxeViolations(container)
  })
})
