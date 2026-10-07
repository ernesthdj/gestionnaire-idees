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
import type { BlockView, CanvasFilterInput, IdeasCanvasView } from '@shared/ipc/canvas'
import type { RootView } from '@shared/ipc/neurons'
import { useUiStore } from '../app/uiStore'
import { useEffectiveSettings } from '../app/useAppSettings'
import { call, IpcFailure } from '../lib/ipc'
import { probeAction } from '../analyste/probe'
import { timingFor } from '../motion/durations'
import { useReducedMotionPreference } from '../motion/useReducedMotionPreference'
import { buildGraph, computeLayout, ideaLinks, structureFlowEdge, type CanvasNode } from './buildGraph'
import { focusEdges } from './structureGraph'
import { ImportWizard } from '../reprise/ImportWizard'
import { CanvasToolbar } from './CanvasToolbar'
import { BranchEdge, type BranchEdgeType } from './edges/BranchEdge'
import { MapLinkEdge, type MapLinkEdgeType } from './edges/MapLinkEdge'
import { driftActive, type Point } from './forceLayout'
import { InlinePrompt } from './InlinePrompt'
import { NeuronMenu } from './NeuronMenu'
import { BlockNode } from './nodes/BlockNode'
import { ElementNode } from './nodes/ElementNode'
import { LayerBandNode } from './nodes/LayerBandNode'
import { StructureBarNode } from './nodes/StructureBarNode'
import { FrameNode } from './nodes/FrameNode'
import { LabelNode } from './nodes/LabelNode'
import { MapNoteNode } from './nodes/MapNoteNode'
import { WidgetReview } from '../widgets/WidgetReview'
import { useWidgetReview, widgetIoKey } from '../widgets/useWidgetIo'
import type { WidgetIoStateView } from '@shared/ipc/widgetIo'
import { ResultNode } from './nodes/ResultNode'
import { WidgetNode } from './nodes/WidgetNode'
import { ToolMenu, type Tool } from './ToolMenu'
import { useBlockActions } from './useBlockActions'
import { NeuronNode } from './nodes/NeuronNode'
import { PlanBarNode, PlanNode } from './nodes/PlanNode'
import { DocumentNode } from './nodes/DocumentNode'
import { DeliverableNode } from './nodes/DeliverableNode'
import { useCanvasPhysics } from './useCanvasPhysics'
import { useCreateLink } from './useCreateLink'
import { useRemoveIdea } from './useRemoveIdea'
import { useSelectionSync } from './useSelectionSync'
import { ChatPanel } from '../chat/ChatPanel'
import { GhostPanel } from './GhostPanel'
import { FinalPanel } from './FinalPanel'
import { FileViewer } from './FileViewer'
import { connectionIntent } from './connection'

const NODE_TYPES: NodeTypes = {
  neuron: NeuronNode,
  block: BlockNode,
  label: LabelNode,
  mapNote: MapNoteNode,
  frame: FrameNode,
  element: ElementNode,
  layerBand: LayerBandNode,
  structureBar: StructureBarNode,
  widget: WidgetNode,
  result: ResultNode,
  plan: PlanNode,
  planBar: PlanBarNode,
  document: DocumentNode,
  deliverable: DeliverableNode
}

/** Types de nœuds React Flow qui sont des blocs de la carte (place et taille enregistrées côté main). */
const BLOCK_TYPES: ReadonlySet<string> = new Set(['block', 'label', 'widget', 'result', 'mapNote', 'frame'])
const EDGE_TYPES: EdgeTypes = { branch: BranchEdge, mapLink: MapLinkEdge }

/** Tout objet de la carte : idées, blocs, éléments de structure. */
type MapNode = CanvasNode
type MapEdge = BranchEdgeType | MapLinkEdgeType
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
  'node.a11yDescription.default': 'Entrée pour ouvrir la conversation de l’idée, touche Menu pour la modifier.',
  'node.a11yDescription.keyboardDisabled': 'Entrée pour ouvrir la conversation de l’idée.',
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
  return `${ideas}|${ideaLinks(view)
    .map((link) => `${link.from.id}-${link.to.id}`)
    .join(',')}`
}

/** Idées dont la place a changé de plus d'un pixel depuis la dernière fois qu'elle a été mémorisée. */
function placesToSave(
  view: IdeasCanvasView,
  live: ReadonlyMap<string, Point>
): { neuronId: string; x: number; y: number }[] {
  const saved = new Map<string, Point | null>(view.ideas.map((neuron) => [neuron.id, neuron.position]))
  return [...saved].flatMap(([neuronId, before]) => {
    const now = live.get(neuronId)
    if (now === undefined) return []
    const moved = before === null || Math.hypot(before.x - now.x, before.y - now.y) > 1
    return moved ? [{ neuronId, x: now.x, y: now.y }] : []
  })
}

/** Objets posés sur la carte : un double-clic sur eux ne crée jamais d'idée. */
const MAP_OBJECTS =
  '.react-flow__node, .react-flow__edge, .react-flow__edgelabel-renderer, .react-flow__panel, .react-flow__controls, ' +
  '.react-flow__handle, [role="dialog"], button, a, input, select, textarea'

/** Le point visé est le fond de la carte lui-même (vide), et non un objet posé dessus. */
function isEmptyMap(target: Element): boolean {
  return target.closest('.react-flow__pane') !== null && target.closest(MAP_OBJECTS) === null
}

function isEditable(target: EventTarget): boolean {
  return target instanceof HTMLElement && target.closest('input, select, textarea, button, [role="dialog"]') !== null
}

/** Nœud de la carte (quel que soit son type) qui contient l'élément, et son type. */
function mapNodeOf(target: EventTarget): { readonly id: string; readonly type: string } | null {
  if (!(target instanceof HTMLElement)) return null
  const node = target.closest('.react-flow__node')
  const id = node?.getAttribute('data-id')
  if (node === null || id === null || id === undefined) return null
  const type = [...node.classList]
    .find((name) => name.startsWith('react-flow__node-'))
    ?.slice('react-flow__node-'.length)
  return type === undefined ? null : { id, type }
}

function CanvasInner(): React.JSX.Element {
  const flow = useReactFlow()
  const client = useQueryClient()
  const settings = useEffectiveSettings()
  const reduced = useReducedMotionPreference(settings.motion)
  const chatNeuronId = useUiStore((state) => state.chatNeuronId)
  const structureViews = useUiStore((state) => state.structureViews)
  const openChat = useUiStore((state) => state.openChat)
  const closeChat = useUiStore((state) => state.closeChat)
  const ghostId = useUiStore((state) => state.ghostId)
  const openGhost = useUiStore((state) => state.openGhost)
  const closeGhost = useUiStore((state) => state.closeGhost)
  const finalId = useUiStore((state) => state.finalId)
  const closeFinal = useUiStore((state) => state.closeFinal)
  const viewer = useUiStore((state) => state.viewer)
  const closeViewer = useUiStore((state) => state.closeViewer)
  const bornId = useUiStore((state) => state.bornId)
  const markBorn = useUiStore((state) => state.markBorn)
  const showToast = useUiStore((state) => state.showToast)
  const createLink = useCreateLink()
  const removeIdea = useRemoveIdea()
  /** Champ posé sur la carte à l'endroit d'un double-clic : nouvelle idée. */
  const [draft, setDraft] = useState<{ at: Point; position: Point } | null>(null)
  const [filter, setFilter] = useState<CanvasFilterInput>({})
  const [interacting, setInteracting] = useState(false)
  const [menu, setMenu] = useState<{ id: string; at: { x: number; y: number } } | null>(null)
  const [importing, setImporting] = useState(false)
  /** Boîte à outils ouverte par un clic droit dans le vide : position à l'écran et point de la carte visé. */
  const [tools, setTools] = useState<{ at: Point; position: Point } | null>(null)
  const closeTools = useCallback(() => setTools(null), [])
  const blockActions = useBlockActions()
  const surface = useRef<HTMLDivElement>(null)

  const query = useQuery({
    queryKey: ['canvas', filter],
    queryFn: () => call<IdeasCanvasView>('canvas:get', filter),
    placeholderData: keepPreviousData
  })
  const view = query.data

  // Disposition de départ (sans croisement) recalculée seulement quand les idées, leurs états ou les liens changent.
  const signature = view === undefined ? '' : layoutSignature(view)
  const viewRef = useRef(view)
  viewRef.current = view
  const layout = useMemo(() => {
    const current = viewRef.current
    return current === undefined ? null : computeLayout(current)
  }, [signature])

  // Physique de la carte (FR-034) : tous les objets se repoussent, stabilisés à chaque changement de contenu.
  const { positions, physics } = useCanvasPhysics({ view, seed: layout })
  // La sélection est connue du pont MCP : « regarde ma sélection » (spec 007).
  useSelectionSync()

  // Mémorise les places trouvées des idées pour retrouver la même carte à la prochaine ouverture.
  const persist = useCallback(
    (extra: readonly { neuronId: string; x: number; y: number; pinned: boolean }[] = []): void => {
      const current = viewRef.current
      if (current === undefined) return
      const moved = placesToSave(current, physics.positions())
      const byId = new Map([...moved, ...extra].map((entry) => [entry.neuronId, entry]))
      if (byId.size > 0) void call('canvas:savePositions', { positions: [...byId.values()] }).catch(() => undefined)
    },
    [physics]
  )
  useEffect(() => persist(), [positions, persist])

  const graph = useMemo((): { nodes: MapNode[]; edges: MapEdge[] } => {
    if (view === undefined || layout === null) return { nodes: [], edges: [] }
    // Positions en cours du moteur (à jour après un glisser), recalculées quand la physique se stabilise.
    const live = positions.size === 0 ? positions : physics.positions()
    const built = buildGraph(view, { area: layout.area, positions: live }, bornId, chatNeuronId, structureViews)
    return { nodes: built.nodes, edges: [...built.edges, ...built.mapEdges] }
  }, [view, layout, positions, physics, bornId, chatNeuronId, structureViews])

  const [nodes, setNodes, onNodesChange] = useNodesState<MapNode>(graph.nodes)

  // Liens d'une carte de structure selon le focus (spec 017 D15) : l'élément survolé, sinon celui ouvert dans le volet.
  const [hoveredElement, setHoveredElement] = useState<string | null>(null)
  const focusId =
    hoveredElement ??
    (chatNeuronId !== null && view?.elements.some((element) => element.id === chatNeuronId) === true
      ? chatNeuronId
      : null)
  const focused = useMemo(
    () =>
      view === undefined
        ? []
        : focusEdges(view.elements, view.mapLinks, view.measuredLinks, focusId).map(structureFlowEdge),
    [view, focusId]
  )
  const edges = useMemo(() => [...graph.edges, ...focused], [graph.edges, focused])

  // Glisser une étape ou un document (spec 011 D7, 012 D4) : le déplacement s'ajoute à son décalage mémorisé ;
  // la disposition le réapplique (une étape entraîne sa branche et ses annexes).
  const planDrag = useRef<{ id: string; at: Point } | null>(null)
  const savePlanDrag = useCallback(
    async (node: MapNode): Promise<void> => {
      const start = planDrag.current
      planDrag.current = null
      if (start === null || start.id !== node.id) return
      const dx = node.position.x - start.at.x
      const dy = node.position.y - start.at.y
      if (Math.hypot(dx, dy) < 1) return
      try {
        if (node.type === 'document') {
          const { id, offset } = node.data.document
          await call('document:move', { id, x: Math.round(offset.x + dx), y: Math.round(offset.y + dy) })
        } else if (node.type === 'deliverable') {
          const { neuronId, offset } = node.data.deliverable
          await call('deliverable:move', { neuronId, x: Math.round(offset.x + dx), y: Math.round(offset.y + dy) })
        } else if (node.type === 'plan' && node.data.item.kind === 'step') {
          const { id, offset } = node.data.item.step
          await call('plan:move', { stepId: id, x: Math.round(offset.x + dx), y: Math.round(offset.y + dy) })
        }
      } catch (error) {
        showToast(error instanceof IpcFailure ? error.message : 'La nouvelle place n’a pas pu être enregistrée.')
      }
      await client.invalidateQueries({ queryKey: ['canvas'] })
    },
    [client, showToast]
  )
  useEffect(() => setNodes(graph.nodes), [graph, setNodes])

  // Idée libérée (menu) : elle se replace en direct parmi les autres, qui restent fixes, puis sa place est mémorisée.
  const frame = useRef(0)
  useEffect(() => () => cancelAnimationFrame(frame.current), [])
  const runLive = useCallback((): void => {
    cancelAnimationFrame(frame.current)
    const loop = (): void => {
      const moving = physics.step(false)
      const live = physics.positions()
      setNodes((current) =>
        current.map((node) => {
          const at = live.get(node.id)
          return at === undefined ? node : { ...node, position: at }
        })
      )
      if (moving) frame.current = requestAnimationFrame(loop)
      else persist()
    }
    frame.current = requestAnimationFrame(loop)
  }, [physics, setNodes, persist])

  // Cadrage sur les idées et les blocs, connus par calcul : React Flow ne mesure que les éléments visibles
  // (`onlyRenderVisibleElements`), son cadrage automatique serait faux. Carte vide : l'espace de départ.
  const blocks = view?.blocks
  const bounds = useMemo(() => {
    if (layout === null) return null
    const points = [...(positions.size > 0 ? positions : layout.positions).values(), ...(blocks ?? [])]
    if (points.length === 0) return layout.area
    const xs = points.map((point) => point.x)
    const ys = points.map((point) => point.y)
    const x = Math.min(...xs) - FIT_MARGIN
    const y = Math.min(...ys) - FIT_MARGIN
    return { x, y, width: Math.max(...xs) + FIT_MARGIN - x, height: Math.max(...ys) + FIT_MARGIN - y }
  }, [layout, positions, blocks])
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

  // Double-clic dans le vide : une idée à cet endroit (FR-030). Jamais sur un objet de la carte (nœud, lien, texte,
  // zoom) : dans React Flow, ils sont tous à l'intérieur du fond de carte.
  const onDoubleClick = (event: React.MouseEvent): void => {
    if (!(event.target instanceof Element) || !isEmptyMap(event.target)) return
    const position = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY })
    const rounded = { x: Math.round(position.x), y: Math.round(position.y) }
    setDraft({ at: toSurface(rounded), position: rounded })
  }

  // Outil choisi dans la boîte à outils : l'objet naît au point du clic droit (spec 004 FR-001).
  const pickTool = async (tool: Tool): Promise<void> => {
    if (tools === null) return
    const { position } = tools
    setTools(null)
    if (tool === 'idea') {
      setDraft({ at: toSurface(position), position })
      return
    }
    try {
      const block = await call<BlockView>('canvas:createBlock', { kind: tool, x: position.x, y: position.y })
      probeAction('block.create', 'block', 'souris', block.id)
      markBorn(block.id)
      await client.invalidateQueries({ queryKey: ['canvas'] })
    } catch (error) {
      showToast(error instanceof IpcFailure ? error.message : 'L’objet n’a pas pu être ajouté.')
    }
  }

  const createIdea = async (text: string, position: Point): Promise<boolean> => {
    try {
      const root = await call<RootView>('neuron:create', { text, position })
      probeAction('neuron.create', 'neuron', 'souris', root.id)
      markBorn(root.id)
      setDraft(null)
      await client.invalidateQueries({ queryKey: ['canvas'] })
      return true
    } catch (error) {
      showToast(error instanceof IpcFailure ? error.message : 'L’idée n’a pas pu être ajoutée.')
      return false
    }
  }

  // Lien tiré d'une idée vers une autre (FR-031) : un lien libre, créé tout de suite, sans libellé.
  // Vers un widget (spec 005 FR-001) : l'idée devient une entrée, et la revue s'ouvre.
  const openReview = useWidgetReview((state) => state.open)
  const connectInput = async (blockId: string, source: string, sourceKind: 'idea' | 'plan_step'): Promise<void> => {
    try {
      const next = await call<WidgetIoStateView>('widgetIo:connect', { blockId, sourceKind, sourceId: source })
      client.setQueryData(widgetIoKey(blockId), next)
      await client.invalidateQueries({ queryKey: ['canvas'] })
      openReview(blockId)
    } catch (error) {
      showToast(error instanceof IpcFailure ? error.message : 'Le branchement n’a pas pu être créé.')
    }
  }

  // Une étape de plan ne se tire que vers un widget (spec 015) : pas de lien libre depuis une étape.
  const isValidConnection = (connection: Connection | MapEdge): boolean =>
    connectionIntent(viewRef.current, connection.source, connection.target) !== null

  const onConnect = (connection: Connection): void => {
    const intent = connectionIntent(viewRef.current, connection.source, connection.target)
    if (intent?.kind === 'input') void connectInput(intent.blockId, intent.sourceId, intent.sourceKind)
    else if (intent?.kind === 'link') void createLink({ aRootId: intent.from, bRootId: intent.to, label: '' })
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
    const target = mapNodeOf(event.target)
    if (target === null || isEditable(event.target)) return
    if (target.type !== 'neuron') return
    const id = target.id
    if (event.key === 'Enter') {
      event.preventDefault()
      openChat(id)
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
        onImport={() => setImporting(true)}
      />
      {importing ? (
        <ImportWizard
          onClose={() => setImporting(false)}
          onImported={(genesisId) => {
            setImporting(false)
            void client.invalidateQueries({ queryKey: ['canvas'] })
            showToast('Projet importé : l’analyse démarre.')
            openChat(genesisId)
          }}
        />
      ) : null}
      <div className="flex min-h-0 flex-1">
        <div
          ref={surface}
          className="relative min-h-0 min-w-0 flex-1"
          data-drift={reduced ? 'off' : driftActive(reduced, interacting) ? 'on' : 'paused'}
          data-structure-focus={focused.length > 0 ? 'on' : 'off'}
          onKeyDownCapture={onKeyDownCapture}
          onKeyDown={onKeyDown}
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
            <ReactFlow<MapNode, MapEdge>
              nodes={nodes}
              edges={edges}
              onNodeMouseEnter={(_event, node) => {
                if (node.type === 'element') setHoveredElement(node.id)
              }}
              onNodeMouseLeave={(_event, node) => {
                if (node.type === 'element') setHoveredElement((current) => (current === node.id ? null : current))
              }}
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
              isValidConnection={isValidConnection}
              zoomOnDoubleClick={false}
              // Tab va d'idée en idée.
              edgesFocusable={false}
              deleteKeyCode={null}
              ariaLabelConfig={ARIA_LABELS}
              colorMode={settings.theme}
              proOptions={{ hideAttribution: true }}
              onMoveStart={() => setInteracting(true)}
              onMoveEnd={() => setInteracting(false)}
              // Un clic (ou un double-clic) sur une idée, ou sur un élément d'une carte de structure (spec 009), ouvre
              // sa conversation Claude Code (spec 008). Un clic dans le vide referme le volet.
              onNodeClick={(_event, node) => {
                // Une étape (spec 011) aussi ; un fantôme se décide par ses boutons ✓ / ✗.
                const conversational =
                  node.type === 'neuron' ||
                  node.type === 'element' ||
                  (node.type === 'plan' && node.data.item.kind === 'step')
                if (conversational && node.id !== chatNeuronId) openChat(node.id)
                // Un fantôme se consulte avant d'être décidé : son détail s'ouvre dans le volet.
                if (node.type === 'plan' && node.data.item.kind === 'ghost') openGhost(node.data.item.ghost.id)
              }}
              onNodeDoubleClick={(_event, node) => {
                if (node.type === 'neuron') openChat(node.id)
              }}
              onPaneClick={() => {
                if (chatNeuronId !== null) closeChat()
                if (ghostId !== null) closeGhost()
              }}
              // Clic droit dans le vide : la boîte à outils (les objets gardent leur propre menu).
              onPaneContextMenu={(event) => {
                event.preventDefault()
                const position = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY })
                setTools({
                  at: { x: event.clientX, y: event.clientY },
                  position: { x: Math.round(position.x), y: Math.round(position.y) }
                })
              }}
              onNodeContextMenu={(event, node) => {
                if (node.type !== 'neuron') return
                event.preventDefault()
                setMenu({ id: node.id, at: { x: event.clientX, y: event.clientY } })
              }}
              onNodeDragStart={(_event, node) => {
                // Étape ou document : placés par la disposition du plan, hors de la physique.
                if (node.type === 'plan' || node.type === 'document' || node.type === 'deliverable') {
                  planDrag.current = { id: node.id, at: node.position }
                  return
                }
                // Les autres objets ne bougent pas pendant un glisser (retour de mentalyas, 2026-10-06).
              }}
              onNodeDragStop={(_event, node) => {
                if (node.type === 'plan' || node.type === 'document' || node.type === 'deliverable') {
                  void savePlanDrag(node)
                  return
                }
                // Lâché : il reste épinglé à cette place, sans déplacer les autres.
                physics.pin(node.id, node.position)
                if (node.type !== undefined && BLOCK_TYPES.has(node.type)) {
                  void blockActions.save(node.id, {
                    ...node.position,
                    width: node.width ?? node.measured?.width ?? 0,
                    height: node.height ?? node.measured?.height ?? 0
                  })
                  return
                }
                if (node.type === 'neuron')
                  persist([{ neuronId: node.id, x: node.position.x, y: node.position.y, pinned: true }])
              }}
            >
              <Background gap={32} size={1} />
              <Controls showInteractive={false} />
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
          {tools === null ? null : (
            <ToolMenu at={tools.at} onPick={(tool) => void pickTool(tool)} onClose={closeTools} />
          )}
          {menuNeuron === undefined || menu === null || view === undefined ? null : (
            <NeuronMenu
              neuron={menuNeuron}
              categories={view.categories}
              at={menu.at}
              onChat={() => {
                setMenu(null)
                openChat(menuNeuron.id)
              }}
              onLinkFolder={() => {
                const id = menuNeuron.id
                setMenu(null)
                call('chat:linkFolder', { neuronId: id, unlink: false })
                  .then(() => openChat(id))
                  .catch((error: unknown) =>
                    showToast(error instanceof IpcFailure ? error.message : 'Le dossier n’a pas pu être lié.')
                  )
              }}
              onClose={() => setMenu(null)}
              others={view.ideas
                .filter((neuron) => neuron.id !== menuNeuron.id)
                .map((neuron) => ({ id: neuron.id, title: neuron.title }))}
              onLink={(targetId, label) => createLink({ aRootId: menuNeuron.id, bRootId: targetId, label })}
              linkCount={
                ideaLinks(view).filter((link) => link.from.id === menuNeuron.id || link.to.id === menuNeuron.id).length
              }
              onRemove={() => removeIdea(menuNeuron)}
              onRelease={() => {
                const at = physics.positions().get(menuNeuron.id)
                physics.pin(menuNeuron.id, null)
                physics.wake()
                runLive()
                setMenu(null)
                if (at !== undefined) persist([{ neuronId: menuNeuron.id, x: at.x, y: at.y, pinned: false }])
                void client.invalidateQueries({ queryKey: ['canvas'] })
              }}
            />
          )}
        </div>
        {chatNeuronId !== null ? (
          <aside
            aria-label="Conversation du neurone"
            className="min-w-0 basis-[38%] border-l border-content-muted/20 bg-surface"
          >
            <ChatPanel key={chatNeuronId} neuronId={chatNeuronId} onClose={closeChat} />
          </aside>
        ) : ghostId !== null && view !== undefined ? (
          <aside
            aria-label="Étape proposée par Claude"
            className="min-w-0 basis-[38%] overflow-y-auto border-l border-content-muted/20 bg-surface"
          >
            <GhostPanel key={ghostId} view={view} ghostId={ghostId} onClose={closeGhost} />
          </aside>
        ) : finalId !== null && view !== undefined ? (
          <aside
            aria-label="Action finale"
            className="min-w-0 basis-[38%] overflow-y-auto border-l border-content-muted/20 bg-surface"
          >
            <FinalPanel key={finalId} view={view} neuronId={finalId} onClose={closeFinal} />
          </aside>
        ) : viewer !== null ? (
          <aside
            aria-label="Visionneuse de fichier"
            className="min-w-0 basis-[38%] overflow-hidden border-l border-content-muted/20 bg-surface"
          >
            <FileViewer
              key={`${viewer.neuronId}:${viewer.path}`}
              neuronId={viewer.neuronId}
              path={viewer.path}
              onClose={closeViewer}
            />
          </aside>
        ) : null}
      </div>
      <WidgetReview />
    </div>
  )
}

/**
 * Écran Idées (spec 003 US2/US3, FR-029 à FR-031) : toutes les idées dans un seul espace, reliées par leurs liens ;
 * une idée s'ouvre d'un clic sur sa conversation, dans le volet à droite (62/38).
 */
export function IdeasCanvas(): React.JSX.Element {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}
