import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { useUiStore } from '../../../../src/renderer/src/app/uiStore'
import { IdeasCanvas } from '../../../../src/renderer/src/canvas/IdeasCanvas'
import { DEFAULT_APP_SETTINGS } from '../../../../src/shared/ipc/app'
import type { IdeasCanvasView } from '../../../../src/shared/ipc/canvas'
import type { MainWindowChannel } from '../../../../src/shared/ipc/channels'
import type { TreeView } from '../../../../src/shared/ipc/neurons'
import { emptyCanvasView } from '../../../fixtures/ui/canvas'
import { installFakeApi } from './fakeApi'

export type Handlers = Partial<Record<MainWindowChannel, (payload: unknown) => unknown>>

/** Carte contenant la seule idée de l'arbre, telle que `canvas:get` la renverrait. */
export function canvasWith(tree: TreeView): IdeasCanvasView {
  const idea = { ...tree.root, subNeurons: [], subCount: 0, contextLevel: tree.gauge?.level ?? null }
  return { ...emptyCanvasView(), ideas: [idea] }
}

/**
 * Écran Idées avec l'idée de l'arbre ouverte (volet à droite, arbre déployé sur la carte), comme après un clic.
 * La carte (`canvas:get`) et les réglages sont fournis ; les autres canaux viennent du test.
 */
export function renderOpenIdea(tree: () => TreeView, handlers: Handlers = {}): ReturnType<typeof installFakeApi> {
  useUiStore.setState({ view: 'ideas', openRootId: tree().root.id, focusId: null, toast: null })
  const api = installFakeApi({
    'neuron:getTree': tree,
    'app:getSettings': () => DEFAULT_APP_SETTINGS,
    'canvas:savePositions': () => ({ ok: true }),
    ...handlers,
    'canvas:get': () => canvasWith(tree())
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      {/* Comme dans la coquille de l’app : la page vit dans le repère principal. */}
      <main>
        <IdeasCanvas />
      </main>
    </QueryClientProvider>
  )
  return api
}
