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
  type NodeTypes,
  type EdgeTypes
} from '@xyflow/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CanvasFilterInput, IdeasCanvasView } from '@shared/ipc/canvas'
import { useUiStore } from '../app/uiStore'
import { useEffectiveSettings } from '../app/useAppSettings'
import { call } from '../lib/ipc'
import { timingFor } from '../motion/durations'
import { useReducedMotionPreference } from '../motion/useReducedMotionPreference'
import { buildGraph, computeLayout, movedPositions, type CanvasNode } from './buildGraph'
import { useCanvasHover } from './hoverStore'
import { CanvasToolbar } from './CanvasToolbar'
import { LinkEdge } from './edges/LinkEdge'
import { driftActive, type Point } from './forceLayout'
import { NeuronMenu } from './NeuronMenu'
import { BlockNode } from './nodes/BlockNode'
import { NeuronNode } from './nodes/NeuronNode'
import { ZoneNode } from './nodes/ZoneNode'

const NODE_TYPES: NodeTypes = { neuron: NeuronNode, zone: ZoneNode, block: BlockNode }
const EDGE_TYPES: EdgeTypes = { link: LinkEdge }
const PAN_STEP = 64
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

/** Signature de ce qui change la disposition (idées, états, liens) — pas les filtres ni les titres. */
function layoutSignature(view: IdeasCanvasView): string {
  const ideas = [...view.incubator, ...view.network].map((root) => `${root.id}:${root.state}`).join(',')
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
  const openDive = useUiStore((state) => state.openDive)
  const hatchedId = useUiStore((state) => state.hatchedId)
  const clearHatched = useUiStore((state) => state.clearHatched)
  const bornId = useUiStore((state) => state.bornId)
  const [migratingId, setMigratingId] = useState<string | null>(null)
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
    // Idée qui vient d'éclore : elle apparaît d'abord à son ancienne place dans l'incubateur.
    const hatched = hatchedId === null ? undefined : view.network.find((neuron) => neuron.id === hatchedId)
    if (hatched?.position != null) positions.set(hatched.id, hatched.position)
    return buildGraph(view, { zones: layout.zones, positions }, migratingId, bornId)
  }, [view, layout, hatchedId, migratingId, bornId])

  // …puis glisse vers sa place dans le réseau.
  useEffect(() => {
    if (hatchedId === null || view?.network.some((neuron) => neuron.id === hatchedId) !== true) return
    const frame = requestAnimationFrame(() => {
      setMigratingId(hatchedId)
      clearHatched()
    })
    return () => cancelAnimationFrame(frame)
  }, [hatchedId, view, clearHatched])
  useEffect(() => {
    if (migratingId === null) return
    const timer = setTimeout(() => setMigratingId(null), timingFor('migrate', reduced).duration + 100)
    return () => clearTimeout(timer)
  }, [migratingId, reduced])

  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(graph.nodes)
  useEffect(() => setNodes(graph.nodes), [graph, setNodes])

  // Cadrage sur les zones, connues par calcul : React Flow ne mesure que les éléments visibles
  // (`onlyRenderVisibleElements`), son cadrage automatique serait faux.
  const bounds = useMemo(() => {
    if (layout === null) return null
    const { incubator, network } = layout.zones
    return { x: incubator.x, y: incubator.y, width: network.x + network.width - incubator.x, height: network.height }
  }, [layout])
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
      openDive(id)
    } else if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
      event.preventDefault()
      const box = (event.target as HTMLElement).getBoundingClientRect()
      setMenu({ id, at: { x: box.right, y: box.top } })
    }
  }

  const menuNeuron =
    menu === null || view === undefined
      ? undefined
      : [...view.incubator, ...view.network].find((neuron) => neuron.id === menu.id)
  const empty = view !== undefined && view.incubator.length + view.network.length === 0

  return (
    <div className="flex h-full flex-col">
      <CanvasToolbar
        view={view}
        filter={filter}
        onFilter={setFilter}
        onRecenter={recenter}
        onAddBlock={() => void addBlock().catch(() => undefined)}
      />
      <div
        ref={surface}
        className="relative min-h-0 flex-1"
        data-drift={reduced ? 'off' : driftActive(reduced, interacting) ? 'on' : 'paused'}
        onKeyDownCapture={onKeyDownCapture}
        onKeyDown={onKeyDown}
        // Au clavier aussi, l'idée qui a le focus montre les libellés de ses liens.
        onFocusCapture={(event) => setHoveredNode(neuronIdOf(event.target))}
        onBlurCapture={() => setHoveredNode(null)}
        onPointerDown={() => setInteracting(true)}
        onPointerUp={() => setInteracting(false)}
        onPointerLeave={() => setInteracting(false)}
      >
        {query.isError ? (
          <p role="alert" className="p-8 text-center text-sm">
            Les idées n’ont pas pu être chargées.
          </p>
        ) : empty ? (
          <div className="flex h-full items-center justify-center p-8">
            <p className="max-w-md text-center text-sm text-content-muted">
              Aucune idée pour l’instant. Appuie sur <kbd className="font-semibold">{settings.shortcut}</kbd> depuis
              n’importe quelle application pour noter ta première idée, ou utilise « + Une idée ? ».
            </p>
          </div>
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
            nodesConnectable={false}
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
            onNodeDoubleClick={(_event, node) => {
              if (node.type === 'neuron') openDive(node.id)
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
          </ReactFlow>
        )}
        {menuNeuron === undefined || menu === null || view === undefined ? null : (
          <NeuronMenu
            neuron={menuNeuron}
            categories={view.categories}
            at={menu.at}
            onDive={() => {
              setMenu(null)
              openDive(menuNeuron.id)
            }}
            onClose={() => setMenu(null)}
          />
        )}
      </div>
    </div>
  )
}

/** Écran Idées (spec 003 US2) : incubateur et réseau des neurones, reliés par leurs liens. */
export function IdeasCanvas(): React.JSX.Element {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}
