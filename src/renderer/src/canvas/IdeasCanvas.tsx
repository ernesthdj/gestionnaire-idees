import '@xyflow/react/dist/style.css'
import './canvas.css'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  useStore,
  type Connection,
  type NodeTypes,
  type EdgeTypes
} from '@xyflow/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CAPTURE_MAX_CHARS } from '@shared/ipc/app'
import type { CanvasFilterInput, IdeasCanvasView } from '@shared/ipc/canvas'
import type { RootView } from '@shared/ipc/neurons'
import { useUiStore } from '../app/uiStore'
import { useEffectiveSettings } from '../app/useAppSettings'
import { call, IpcFailure } from '../lib/ipc'
import { timingFor } from '../motion/durations'
import { useReducedMotionPreference } from '../motion/useReducedMotionPreference'
import { OpenIdea } from '../dive/OpenIdea'
import { bornFrom, buildGraph, computeLayout, movedPositions, TIER_SIZE, tierOf, type CanvasNode } from './buildGraph'
import { useCanvasHover } from './hoverStore'
import { CanvasToolbar } from './CanvasToolbar'
import { LinkEdge } from './edges/LinkEdge'
import { driftActive, type Point } from './forceLayout'
import { InlinePrompt } from './InlinePrompt'
import { NeuronMenu } from './NeuronMenu'
import { BlockNode } from './nodes/BlockNode'
import { NeuronNode } from './nodes/NeuronNode'
import { useCreateLink } from './useCreateLink'

const NODE_TYPES: NodeTypes = { neuron: NeuronNode, block: BlockNode }
const EDGE_TYPES: EdgeTypes = { link: LinkEdge }
const PAN_STEP = 64
/** Marge du cadrage autour des idées. */
const FIT_MARGIN = 128
const ARROWS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [PAN_STEP, 0],
  ArrowRight: [-PAN_STEP, 0],
  ArrowUp: [0, PAN_STEP],
  ArrowDown: [0, -PAN_STEP]
}

/** Textes d'aide de React Flow, en français. */
const ARIA_LABELS = {
  'node.a11yDescription.default': 'Entrée pour plonger dans l’idée, touche Menu pour la modifier.',
  'node.a11yDescription.keyboardDisabled': 'Entrée pour plonger dans l’idée.',
  'edge.a11yDescription.default': 'Lien entre deux idées.',
  'controls.ariaLabel': 'Zoom',
  'controls.zoomIn.ariaLabel': 'Zoomer',
  'controls.zoomOut.ariaLabel': 'Dézoomer',
  'controls.fitView.ariaLabel': 'Tout afficher',
  'controls.interactive.ariaLabel': 'Verrouiller la carte'
}

/** Signature de ce qui change la disposition (idées, tailles, liens) — pas les filtres ni les titres. */
function layoutSignature(view: IdeasCanvasView): string {
  const ideas = view.ideas.map((root) => `${root.id}:${root.state}:${root.contextLevel ?? ''}`).join(',')
  return `${ideas}|${view.links.map((link) => `${link.a.id}-${link.b.id}`).join(',')}`
}

function isEditable(target: EventTarget): boolean {
  return target instanceof HTMLElement && target.closest('input, select, textarea, button, [role="dialog"]') !== null
}

function neuronIdOf(target: EventTarget): string | null {
  if (!(target instanceof HTMLElement)) return null
  const node = target.closest('.react-flow__node-neuron')
  return node?.getAttribute('data-id') ?? null
}

function CanvasInner(): React.JSX.Element {
  const flow = useReactFlow()
  const client = useQueryClient()
  const settings = useEffectiveSettings()
  const reduced = useReducedMotionPreference(settings.motion)
  const openRootId = useUiStore((state) => state.openRootId)
  const openIdea = useUiStore((state) => state.openIdea)
  const focusIdea = useUiStore((state) => state.focus)
  const closeIdea = useUiStore((state) => state.closeIdea)
  /** Colonne de droite où l'idée ouverte affiche son volet. */
  const [panelHost, setPanelHost] = useState<HTMLElement | null>(null)
  const bornId = useUiStore((state) => state.bornId)
  const markBorn = useUiStore((state) => state.markBorn)
  const showToast = useUiStore((state) => state.showToast)
  const createLink = useCreateLink()
  /** Champ posé sur la carte à l'endroit d'un double-clic : nouvelle idée. */
  const [draft, setDraft] = useState<{ at: Point; position: Point } | null>(null)
  const [filter, setFilter] = useState<CanvasFilterInput>({})
  const [interacting, setInteracting] = useState(false)
  const [menu, setMenu] = useState<{ id: string; at: { x: number; y: number } } | null>(null)
  const dragged = useRef(new Map<string, Point>())
  const surface = useRef<HTMLDivElement>(null)
  const setHoveredEdge = useCanvasHover((state) => state.setEdge)
  const setHoveredNode = useCanvasHover((state) => state.setNode)

  const query = useQuery({
    queryKey: ['canvas', filter],
    queryFn: () => call<IdeasCanvasView>('canvas:get', filter),
    placeholderData: keepPreviousData
  })
  const view = query.data

  // Disposition recalculée seulement quand les idées, leurs états ou les liens changent.
  const signature = view === undefined ? '' : layoutSignature(view)
  const viewRef = useRef(view)
  viewRef.current = view
  const layout = useMemo(() => {
    const current = viewRef.current
    if (current === undefined) return null
    dragged.current.clear()
    return computeLayout(current)
  }, [signature])

  // Mémorise les positions calculées pour que la carte soit identique à la prochaine ouverture.
  useEffect(() => {
    const current = viewRef.current
    if (layout === null || current === undefined) return
    const moved = movedPositions(current, layout.positions)
    if (moved.length > 0) void call('canvas:savePositions', { positions: moved }).catch(() => undefined)
  }, [layout])

  const graph = useMemo(() => {
    if (view === undefined || layout === null) return { nodes: [] as CanvasNode[], edges: [] }
    const positions = new Map([...layout.positions, ...dragged.current])
    return buildGraph(view, { area: layout.area, positions }, bornId, openRootId)
  }, [view, layout, bornId, openRootId])

  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(graph.nodes)
  useEffect(() => setNodes(graph.nodes), [graph, setNodes])

  // Idée ouverte : sa place et sa taille sur la carte (son arbre se déploie autour).
  const openNeuron = openRootId === null ? undefined : view?.ideas.find((neuron) => neuron.id === openRootId)
  // Position en direct (les nœuds de React Flow bougent pendant un glisser) : l'arbre suit l'idée.
  const openCenter = nodes.find((node) => node.id === openRootId)?.position
  // Une idée ouverte qui disparaît (archivée, annulée) referme le volet.
  useEffect(() => {
    if (openRootId !== null && view !== undefined && openNeuron === undefined) closeIdea()
  }, [openRootId, view, openNeuron, closeIdea])

  // Cadrage sur les idées et les blocs, connus par calcul : React Flow ne mesure que les éléments visibles
  // (`onlyRenderVisibleElements`), son cadrage automatique serait faux. Carte vide : l'espace de départ.
  const blocks = view?.blocks
  const bounds = useMemo(() => {
    if (layout === null) return null
    const points = [...layout.positions.values(), ...(blocks ?? [])]
    if (points.length === 0) return layout.area
    const xs = points.map((point) => point.x)
    const ys = points.map((point) => point.y)
    const x = Math.min(...xs) - FIT_MARGIN
    const y = Math.min(...ys) - FIT_MARGIN
    return { x, y, width: Math.max(...xs) + FIT_MARGIN - x, height: Math.max(...ys) + FIT_MARGIN - y }
  }, [layout, blocks])
  // Cadrage initial dès que React Flow connaît la taille réelle de son conteneur (0 px au premier rendu).
  const hasSize = useStore((state) => state.width > 0 && state.height > 0)
  const fitted = useRef(false)
  useEffect(() => {
    if (!hasSize || bounds === null || fitted.current) return
    fitted.current = true
    void flow.fitBounds(bounds, { padding: 0.05 })
  }, [hasSize, bounds, flow])

  const recenter = useCallback(() => {
    if (bounds !== null) void flow.fitBounds(bounds, { padding: 0.05, duration: timingFor('dive', reduced).duration })
  }, [bounds, flow, reduced])

  // Nouveau bloc au centre de la partie visible de la carte.
  const addBlock = useCallback(async (): Promise<void> => {
    const box = surface.current?.getBoundingClientRect()
    if (box === undefined) return
    const center = flow.screenToFlowPosition({ x: box.left + box.width / 2, y: box.top + box.height / 2 })
    await call('canvas:createBlock', { x: Math.round(center.x), y: Math.round(center.y) })
    await client.invalidateQueries({ queryKey: ['canvas'] })
  }, [flow, client])

  /** Position à l'écran (relative à la surface de la carte) d'un point de la carte. */
  const toSurface = useCallback(
    (point: Point): Point => {
      const box = surface.current?.getBoundingClientRect()
      const screen = flow.flowToScreenPosition(point)
      return { x: screen.x - (box?.left ?? 0), y: screen.y - (box?.top ?? 0) }
    },
    [flow]
  )

  // Double-clic dans le vide : une idée à cet endroit (FR-030).
  const onDoubleClick = (event: React.MouseEvent): void => {
    if (!(event.target instanceof Element) || event.target.closest('.react-flow__pane') === null) return
    const position = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY })
    const rounded = { x: Math.round(position.x), y: Math.round(position.y) }
    setDraft({ at: toSurface(rounded), position: rounded })
  }

  const createIdea = async (text: string, position: Point): Promise<boolean> => {
    try {
      const root = await call<RootView>('neuron:create', { text, position })
      markBorn(root.id)
      setDraft(null)
      await client.invalidateQueries({ queryKey: ['canvas'] })
      return true
    } catch (error) {
      showToast(error instanceof IpcFailure ? error.message : 'L’idée n’a pas pu être ajoutée.')
      return false
    }
  }

  // Lien tiré d'une idée vers une autre (FR-031) : créé tout de suite, sans libellé ; la graine germe ensuite.
  const onConnect = (connection: Connection): void => {
    const { source, target } = connection
    if (source !== target) void createLink({ aRootId: source, bRootId: target, label: '' })
  }

  const onKeyDownCapture = (event: React.KeyboardEvent): void => {
    const delta = ARROWS[event.key]
    if (delta === undefined || isEditable(event.target)) return
    // Les flèches déplacent la vue (et non l'idée sélectionnée).
    event.preventDefault()
    event.stopPropagation()
    const viewport = flow.getViewport()
    void flow.setViewport({ ...viewport, x: viewport.x + delta[0], y: viewport.y + delta[1] })
  }

  const onKeyDown = (event: React.KeyboardEvent): void => {
    const id = neuronIdOf(event.target)
    if (id === null) return
    if (event.key === 'Enter') {
      event.preventDefault()
      openIdea(id)
    } else if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
      event.preventDefault()
      const box = (event.target as HTMLElement).getBoundingClientRect()
      setMenu({ id, at: { x: box.right, y: box.top } })
    }
  }

  const menuNeuron = menu === null ? undefined : view?.ideas.find((neuron) => neuron.id === menu.id)
  const empty = view !== undefined && view.ideas.length === 0

  return (
    <div className="flex h-full flex-col">
      <CanvasToolbar
        view={view}
        filter={filter}
        onFilter={setFilter}
        onRecenter={recenter}
        onAddBlock={() => void addBlock().catch(() => undefined)}
      />
      <div className="flex min-h-0 flex-1">
        <div
          ref={surface}
          className="relative min-h-0 min-w-0 flex-1"
          data-drift={reduced ? 'off' : driftActive(reduced, interacting) ? 'on' : 'paused'}
          onKeyDownCapture={onKeyDownCapture}
          onKeyDown={onKeyDown}
          // Au clavier aussi, l'idée qui a le focus montre les libellés de ses liens.
          onFocusCapture={(event) => setHoveredNode(neuronIdOf(event.target))}
          onBlurCapture={() => setHoveredNode(null)}
          onPointerDown={() => setInteracting(true)}
          onPointerUp={() => setInteracting(false)}
          onPointerLeave={() => setInteracting(false)}
          onDoubleClick={onDoubleClick}
        >
          {query.isError ? (
            <p role="alert" className="p-8 text-center text-sm">
              Les idées n’ont pas pu être chargées.
            </p>
          ) : (
            <ReactFlow<CanvasNode>
              nodes={nodes}
              edges={graph.edges}
              nodeTypes={NODE_TYPES}
              edgeTypes={EDGE_TYPES}
              onNodesChange={onNodesChange}
              nodeOrigin={[0.5, 0.5]}
              onlyRenderVisibleElements
              minZoom={0.2}
              maxZoom={2}
              nodesConnectable
              connectionRadius={64}
              onConnect={onConnect}
              zoomOnDoubleClick={false}
              // Tab va d'idée en idée ; les liens suggérés restent décidables au clavier par leurs boutons ✓ / ✗.
              edgesFocusable={false}
              deleteKeyCode={null}
              ariaLabelConfig={ARIA_LABELS}
              colorMode={settings.theme}
              proOptions={{ hideAttribution: true }}
              onEdgeMouseEnter={(_event, edge) => setHoveredEdge(edge.id)}
              onEdgeMouseLeave={() => setHoveredEdge(null)}
              onNodeMouseEnter={(_event, node) => setHoveredNode(node.type === 'neuron' ? node.id : null)}
              onNodeMouseLeave={() => setHoveredNode(null)}
              onMoveStart={() => setInteracting(true)}
              onMoveEnd={() => setInteracting(false)}
              // Un clic ouvre l'idée dans le volet (ou recible l'idée elle-même) ; le double-clic est réservé à la
              // future vue « deep ». Un clic dans le vide referme le volet.
              onNodeClick={(_event, node) => {
                if (node.type !== 'neuron') return
                if (node.id === openRootId) focusIdea(null)
                else openIdea(node.id)
              }}
              onPaneClick={() => {
                if (openRootId !== null) closeIdea()
              }}
              onNodeContextMenu={(event, node) => {
                if (node.type !== 'neuron') return
                event.preventDefault()
                setMenu({ id: node.id, at: { x: event.clientX, y: event.clientY } })
              }}
              onNodeDragStop={(_event, node) => {
                if (node.type === 'block') {
                  void call('canvas:updateBlock', {
                    id: node.id,
                    x: node.position.x,
                    y: node.position.y,
                    width: node.width ?? node.measured?.width ?? 0,
                    height: node.height ?? node.measured?.height ?? 0
                  })
                    .then(() => client.invalidateQueries({ queryKey: ['canvas'] }))
                    .catch(() => undefined)
                  return
                }
                if (node.type !== 'neuron') return
                dragged.current.set(node.id, node.position)
                void call('canvas:savePositions', {
                  positions: [{ rootId: node.id, x: node.position.x, y: node.position.y }]
                }).catch(() => undefined)
              }}
            >
              <Background gap={32} size={1} />
              <Controls showInteractive={false} />
              {openRootId === null ||
              openNeuron === undefined ||
              openCenter === undefined ||
              view === undefined ? null : (
                <OpenIdea
                  key={openRootId}
                  rootId={openRootId}
                  center={openCenter}
                  rootSize={TIER_SIZE[tierOf(openNeuron)]}
                  panelHost={panelHost}
                  categories={view.categories}
                  bornFrom={bornFrom(view).get(openRootId)}
                  reduced={reduced}
                />
              )}
            </ReactFlow>
          )}
          {empty && draft === null ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
              <p className="max-w-md text-center text-sm text-content-muted">
                Aucune idée pour l’instant. Double-clique n’importe où pour noter ta première idée, ou appuie sur{' '}
                <kbd className="font-semibold">{settings.shortcut}</kbd> depuis n’importe quelle application.
              </p>
            </div>
          ) : null}
          {draft !== null ? (
            <InlinePrompt
              key={`idea-${draft.position.x}-${draft.position.y}`}
              at={draft.at}
              label="Nouvelle idée"
              placeholder="Ton idée…"
              maxLength={CAPTURE_MAX_CHARS}
              onSubmit={(text) => createIdea(text, draft.position)}
              onCancel={() => setDraft(null)}
            />
          ) : null}
          {menuNeuron === undefined || menu === null || view === undefined ? null : (
            <NeuronMenu
              neuron={menuNeuron}
              categories={view.categories}
              at={menu.at}
              onOpen={() => {
                setMenu(null)
                openIdea(menuNeuron.id)
              }}
              onClose={() => setMenu(null)}
              others={view.ideas
                .filter((neuron) => neuron.id !== menuNeuron.id)
                .map((neuron) => ({ id: neuron.id, title: neuron.title }))}
              onLink={(targetId, label) => createLink({ aRootId: menuNeuron.id, bRootId: targetId, label })}
            />
          )}
        </div>
        {openRootId === null ? null : (
          <aside
            ref={setPanelHost}
            aria-label="Volet de l’idée"
            className="min-w-0 basis-[38%] border-l border-content-muted/20 bg-surface"
          />
        )}
      </div>
    </div>
  )
}

/**
 * Écran Idées (spec 003 US2/US3, FR-029 à FR-031) : toutes les idées dans un seul espace, reliées par leurs liens ;
 * une idée s'ouvre d'un clic, son arbre sur la carte et son volet à droite (62/38).
 */
export function IdeasCanvas(): React.JSX.Element {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}
