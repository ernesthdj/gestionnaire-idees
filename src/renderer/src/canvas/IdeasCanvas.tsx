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
import { timingFor } from '../motion/durations'
import { useReducedMotionPreference } from '../motion/useReducedMotionPreference'
import { OpenIdea } from '../dive/OpenIdea'
import { bornFrom, buildGraph, computeLayout, stepRootId, type CanvasNode, type LinkEdgeType } from './buildGraph'
import { useCanvasHover } from './hoverStore'
import { CanvasToolbar } from './CanvasToolbar'
import { BranchEdge, type BranchEdgeType } from './edges/BranchEdge'
import { LinkEdge } from './edges/LinkEdge'
import { driftActive, type Point } from './forceLayout'
import { InlinePrompt } from './InlinePrompt'
import { NeuronMenu } from './NeuronMenu'
import { BlockNode } from './nodes/BlockNode'
import { LabelNode } from './nodes/LabelNode'
import { StepNode } from './nodes/StepNode'
import { WidgetReview } from '../widgets/WidgetReview'
import { useWidgetReview, widgetIoKey } from '../widgets/useWidgetIo'
import type { WidgetIoStateView } from '@shared/ipc/widgetIo'
import { ResultNode } from './nodes/ResultNode'
import { WidgetNode } from './nodes/WidgetNode'
import { ToolMenu, type Tool } from './ToolMenu'
import { useBlockActions } from './useBlockActions'
import { NeuronNode } from './nodes/NeuronNode'
import { DocNode, NoteNode, TreeNode, type DocNodeType, type NoteNodeType, type TreeNodeType } from './nodes/TreeNodes'
import { treeGraph } from './treeGraph'
import { useOpenTree, type OpenTree } from './treeStore'
import { useCanvasPhysics } from './useCanvasPhysics'
import { useCreateLink } from './useCreateLink'
import { useRemoveIdea } from './useRemoveIdea'

const NODE_TYPES: NodeTypes = {
  neuron: NeuronNode,
  block: BlockNode,
  label: LabelNode,
  widget: WidgetNode,
  result: ResultNode,
  step: StepNode,
  tree: TreeNode,
  note: NoteNode,
  doc: DocNode
}

/** Types de nœuds React Flow qui sont des blocs de la carte (place et taille enregistrées côté main). */
const BLOCK_TYPES: ReadonlySet<string> = new Set(['block', 'label', 'widget', 'result'])
const EDGE_TYPES: EdgeTypes = { link: LinkEdge, branch: BranchEdge }

/** Tout objet de la carte : idées, blocs, et arbre de l'idée ouverte (éléments, textes, fiche). */
type MapNode = CanvasNode | TreeNodeType | NoteNodeType | DocNodeType
type MapEdge = LinkEdgeType | BranchEdgeType
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

/** Idées et sous-neurones dont la place a changé de plus d'un pixel depuis la dernière fois qu'elle a été mémorisée. */
function placesToSave(
  view: IdeasCanvasView,
  tree: OpenTree | null,
  live: ReadonlyMap<string, Point>
): { neuronId: string; x: number; y: number }[] {
  const saved = new Map<string, Point | null>(view.ideas.map((neuron) => [neuron.id, neuron.position]))
  for (const placed of tree?.items ?? []) {
    if (placed.item.type === 'neuron') saved.set(placed.item.id, placed.item.position)
  }
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

function neuronIdOf(target: EventTarget): string | null {
  if (!(target instanceof HTMLElement)) return null
  const node = target.closest('.react-flow__node-neuron')
  return node?.getAttribute('data-id') ?? null
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
  const removeIdea = useRemoveIdea()
  /** Champ posé sur la carte à l'endroit d'un double-clic : nouvelle idée. */
  const [draft, setDraft] = useState<{ at: Point; position: Point } | null>(null)
  const [filter, setFilter] = useState<CanvasFilterInput>({})
  const [interacting, setInteracting] = useState(false)
  const [menu, setMenu] = useState<{ id: string; at: { x: number; y: number } } | null>(null)
  /** Boîte à outils ouverte par un clic droit dans le vide : position à l'écran et point de la carte visé. */
  const [tools, setTools] = useState<{ at: Point; position: Point } | null>(null)
  const closeTools = useCallback(() => setTools(null), [])
  const blockActions = useBlockActions()
  const surface = useRef<HTMLDivElement>(null)
  const tree = useOpenTree((state) => state.tree)
  const docId = useOpenTree((state) => state.docId)
  const expanded = useOpenTree((state) => state.expanded)
  const openDoc = useOpenTree((state) => state.openDoc)
  const toggleNote = useOpenTree((state) => state.toggleNote)
  const setHoveredEdge = useCanvasHover((state) => state.setEdge)
  const setHoveredNode = useCanvasHover((state) => state.setNode)

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
  const { positions, physics } = useCanvasPhysics({ view, seed: layout, tree, openRootId })

  // Mémorise les places trouvées (idées et sous-neurones) pour retrouver la même carte à la prochaine ouverture.
  const persist = useCallback(
    (extra: readonly { neuronId: string; x: number; y: number; pinned: boolean }[] = []): void => {
      const current = viewRef.current
      if (current === undefined) return
      const moved = placesToSave(current, useOpenTree.getState().tree, physics.positions())
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
    const built = buildGraph(view, { area: layout.area, positions: live }, bornId, openRootId)
    const base = { nodes: built.nodes, edges: [...built.edges, ...built.stepEdges] }
    const root = tree === null ? undefined : live.get(tree.rootId)
    if (tree === null || root === undefined || tree.rootId !== openRootId) return base
    const branch = treeGraph({ tree, positions: live, root, docId, expanded, closeDoc: () => openDoc(null) })
    return { nodes: [...base.nodes, ...branch.nodes], edges: [...base.edges, ...branch.edges] }
  }, [view, layout, positions, physics, bornId, openRootId, tree, docId, expanded, openDoc])

  const [nodes, setNodes, onNodesChange] = useNodesState<MapNode>(graph.nodes)
  useEffect(() => setNodes(graph.nodes), [graph, setNodes])

  // Glisser (FR-034) : l'objet saisi est épinglé sous le pointeur, les autres réagissent en direct ; lâché, il reste
  // à sa place (mémorisée), et la physique se repose.
  const drag = useRef<{ id: string; at: Point } | null>(null)
  const frame = useRef(0)
  useEffect(() => () => cancelAnimationFrame(frame.current), [])
  const runLive = useCallback((): void => {
    cancelAnimationFrame(frame.current)
    const loop = (): void => {
      const held = drag.current
      if (held !== null) physics.pin(held.id, held.at)
      const moving = physics.step(held !== null)
      const live = physics.positions()
      setNodes((current) =>
        current.map((node) => {
          const at = live.get(node.id)
          return at === undefined || node.id === held?.id ? node : { ...node, position: at }
        })
      )
      if (moving) frame.current = requestAnimationFrame(loop)
      else persist()
    }
    frame.current = requestAnimationFrame(loop)
  }, [physics, setNodes, persist])

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
  // graine, fiche, zoom) : dans React Flow, ils sont tous à l'intérieur du fond de carte.
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
      markBorn(block.id)
      await client.invalidateQueries({ queryKey: ['canvas'] })
    } catch (error) {
      showToast(error instanceof IpcFailure ? error.message : 'L’objet n’a pas pu être ajouté.')
    }
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
  // Vers un widget (spec 005 FR-001) : la source (idée ou prochaine étape) devient une entrée, et la revue s'ouvre.
  const openReview = useWidgetReview((state) => state.open)
  const connectInput = async (blockId: string, source: string): Promise<void> => {
    const stepOf = stepRootId(source)
    try {
      const next = await call<WidgetIoStateView>('widgetIo:connect', {
        blockId,
        sourceKind: stepOf === null ? 'idea' : 'step',
        sourceId: stepOf ?? source
      })
      client.setQueryData(widgetIoKey(blockId), next)
      await client.invalidateQueries({ queryKey: ['canvas'] })
      openReview(blockId)
    } catch (error) {
      showToast(error instanceof IpcFailure ? error.message : 'Le branchement n’a pas pu être créé.')
    }
  }

  const onConnect = (connection: Connection): void => {
    const { source, target } = connection
    if (source === target) return
    if (viewRef.current?.blocks.some((block) => block.id === target && block.kind === 'widget') === true) {
      void connectInput(target, source)
      return
    }
    // Une prochaine étape ne se relie pas à une idée : elle se « brainstorme » (bouton de l'étape).
    if (stepRootId(source) === null) void createLink({ aRootId: source, bRootId: target, label: '' })
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

  /** Clic (ou `Entrée`) sur un élément de l'arbre ouvert : cibler, choisir une question, accepter une idée. */
  const activateTreeItem = (id: string): void => {
    const placed = tree?.items.find((entry) => entry.item.id === id)
    if (tree === null || placed === undefined) return
    const { item } = placed
    if (item.type === 'neuron') tree.actions.focus(item.id)
    else if (item.type === 'slot') tree.actions.selectExtension(item.extension.id)
    else if (item.type === 'ghost') tree.actions.acceptSuggestion(item.suggestion.id)
  }

  const onKeyDown = (event: React.KeyboardEvent): void => {
    const target = mapNodeOf(event.target)
    if (target === null || isEditable(event.target)) return
    if (target.type === 'tree' || target.type === 'note') {
      if (event.key === 'Enter') {
        event.preventDefault()
        if (target.type === 'note') toggleNote(target.id.slice('note-'.length))
        else activateTreeItem(target.id)
      } else if (event.key === 'Escape') {
        // Échap sur une idée suggérée : l'ignorer (sans refermer le volet).
        const placed = tree?.items.find((entry) => entry.item.id === target.id)
        if (placed?.item.type !== 'ghost' || tree === null) return
        event.preventDefault()
        event.stopPropagation()
        tree.actions.dismissSuggestion(placed.item.suggestion.id)
      }
      return
    }
    if (target.type !== 'neuron') return
    const id = target.id
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
            <ReactFlow<MapNode, MapEdge>
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
                if (node.type === 'tree') activateTreeItem(node.id)
                else if (node.type === 'note') toggleNote(node.id.slice('note-'.length))
                else if (node.type !== 'neuron') return
                else if (node.id === openRootId) focusIdea(null)
                else openIdea(node.id)
              }}
              // Double-clic sur une idée suggérée acceptée : sa fiche s'ouvre à côté d'elle (FR-032).
              onNodeDoubleClick={(_event, node) => {
                if (node.type !== 'tree') return
                const placed = tree?.items.find((entry) => entry.item.id === node.id)
                if (placed?.item.type === 'neuron' && placed.item.kind === 'idea') openDoc(placed.item.id)
              }}
              onPaneClick={() => {
                if (openRootId !== null) closeIdea()
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
                // Clic droit sur un sous-neurone : il est ciblé, le volet propose de le modifier ou de le supprimer.
                if (node.type === 'tree') {
                  event.preventDefault()
                  const placed = tree?.items.find((entry) => entry.item.id === node.id)
                  if (placed?.item.type === 'neuron') tree?.actions.focus(placed.item.id)
                  return
                }
                if (node.type !== 'neuron') return
                event.preventDefault()
                setMenu({ id: node.id, at: { x: event.clientX, y: event.clientY } })
              }}
              onNodeDragStart={(_event, node) => {
                if (node.type === 'doc') return
                drag.current = { id: node.id, at: node.position }
                physics.wake()
                runLive()
              }}
              onNodeDrag={(_event, node) => {
                if (drag.current?.id === node.id) drag.current = { id: node.id, at: node.position }
              }}
              onNodeDragStop={(_event, node) => {
                if (node.type === 'doc') return
                // Lâché : il reste épinglé à cette place ; la physique se repose autour de lui.
                physics.pin(node.id, node.position)
                drag.current = null
                if (node.type !== undefined && BLOCK_TYPES.has(node.type)) {
                  void blockActions.save(node.id, {
                    ...node.position,
                    width: node.width ?? node.measured?.width ?? 0,
                    height: node.height ?? node.measured?.height ?? 0
                  })
                  return
                }
                if (node.type === 'step') {
                  void call('canvas:saveStepPosition', {
                    rootId: node.data.step.rootId,
                    x: Math.round(node.position.x),
                    y: Math.round(node.position.y)
                  }).catch(() => undefined)
                  return
                }
                const isNeuron =
                  node.type === 'neuron' ||
                  tree?.items.some((entry) => entry.item.id === node.id && entry.item.type === 'neuron') === true
                if (isNeuron) persist([{ neuronId: node.id, x: node.position.x, y: node.position.y, pinned: true }])
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
          {tools === null ? null : (
            <ToolMenu at={tools.at} onPick={(tool) => void pickTool(tool)} onClose={closeTools} />
          )}
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
              linkCount={view.links.filter((link) => link.a.id === menuNeuron.id || link.b.id === menuNeuron.id).length}
              onRemove={() => removeIdea(menuNeuron)}
              onRelease={() => {
                const at = physics.positions().get(menuNeuron.id)
                physics.pin(menuNeuron.id, null)
                setMenu(null)
                if (at !== undefined) persist([{ neuronId: menuNeuron.id, x: at.x, y: at.y, pinned: false }])
                void client.invalidateQueries({ queryKey: ['canvas'] })
              }}
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
      <WidgetReview />
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
