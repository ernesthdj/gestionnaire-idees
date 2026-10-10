import '@xyflow/react/dist/style.css'
import './canvas.css'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Background,
  ControlButton,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  useStore,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
  SelectionMode
} from '@xyflow/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CAPTURE_MAX_CHARS, colorSchemeOf } from '@shared/ipc/app'
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
import { SettingsNode } from './nodes/SettingsNode'
import { WidgetNode } from './nodes/WidgetNode'
import { ContextMenu, ToolMenu, type MenuItem, type Tool } from './ToolMenu'
import { flushViewState } from '../home/useBrainstorms'
import { STRUCTURE_VIEWS, type StructureView } from '@shared/brainstorms/viewState'
import { useBlockActions } from './useBlockActions'
import { stillNode } from './nodes/stillNode'
import { NeuronNode } from './nodes/NeuronNode'
import { PlanBarNode, PlanNode } from './nodes/PlanNode'
import { DocumentNode } from './nodes/DocumentNode'
import { DeliverableNode } from './nodes/DeliverableNode'
import { useCanvasPhysics } from './useCanvasPhysics'
import { useCreateLink } from './useCreateLink'
import { RemoveIdeasDialog } from './RemoveIdeasDialog'
import { useRemoveIdea, useRemoveIdeas } from './useRemoveIdea'
import { useSelectionSync } from './useSelectionSync'
import { IdeaCards } from './cards/IdeaCards'
import { useCards } from './cards/cardsStore'
import { useSmoothZoom } from './useSmoothZoom'
import { GLIDE_MS, useGlide } from './useGlide'
import { connectionIntent } from './connection'
import { useWorkflows } from './workflow/useWorkflow'
import { WorkflowNode } from './workflow/WorkflowNode'
import { discussWorkflow } from './workflow/WorkflowCard'

/** Types de nœuds ; chacun ne se redessine que si son contenu change (glissements fluides, spec 022). */
const NODE_TYPES: NodeTypes = {
  neuron: stillNode(NeuronNode),
  block: stillNode(BlockNode),
  label: stillNode(LabelNode),
  mapNote: stillNode(MapNoteNode),
  frame: stillNode(FrameNode),
  element: stillNode(ElementNode),
  layerBand: stillNode(LayerBandNode),
  structureBar: stillNode(StructureBarNode),
  widget: stillNode(WidgetNode),
  result: stillNode(ResultNode),
  widgetSettings: stillNode(SettingsNode),
  plan: stillNode(PlanNode),
  planBar: stillNode(PlanBarNode),
  document: stillNode(DocumentNode),
  deliverable: stillNode(DeliverableNode),
  workflow: stillNode(WorkflowNode)
}

/** Types de nœuds React Flow qui sont des blocs de la carte (place et taille enregistrées côté main). */
const VIEW_NAMES: Readonly<Record<StructureView, string>> = {
  workflow: 'Workflow',
  progression: 'Progression',
  architecture: 'Architecture'
}

const BLOCK_TYPES: ReadonlySet<string> = new Set([
  'block',
  'label',
  'widget',
  'result',
  'widgetSettings',
  'mapNote',
  'frame'
])
const EDGE_TYPES: EdgeTypes = { branch: BranchEdge, mapLink: MapLinkEdge }

/** Tout objet de la carte : idées, blocs, éléments de structure. */
type MapNode = CanvasNode
type MapEdge = BranchEdgeType | MapLinkEdgeType
const PAN_STEP = 64
/** Ajouter une idée à la sélection : Ctrl (ou Cmd) + clic, ou Maj + clic. */
const MULTI_SELECTION_KEYS = ['Control', 'Meta', 'Shift']
/**
 * Rectangle de sélection, comme sur un bureau : Ctrl (ou Cmd, ou Maj) + glisser dans le vide (retour de mentalyas,
 * 2026-10-07) ; glisser sans touche déplace toujours la carte.
 */
const SELECTION_BOX_KEYS = ['Control', 'Meta', 'Shift']
/** Nœuds qui ont une carte de détails (spec 022) ; les blocs auront la leur (US4). */
const CARD_TYPES: ReadonlySet<string> = new Set(['neuron', 'plan', 'element', 'document', 'deliverable', 'workflow'])
/** Un message de la vue Workflow (projet vide, dossier introuvable) n'a pas de carte. */
const hasCard = (node: MapNode): boolean =>
  CARD_TYPES.has(node.type ?? '') && !(node.type === 'workflow' && node.data.item.subject.kind === 'message')
/** Attente avant d'ouvrir une carte au clic : un double-clic ouvre directement la discussion. */
const CLICK_DELAY_MS = 220
/** Parent d'un nœud dans son arbre (étape, élément) ; `null` pour une racine ou un bloc. */
function parentOf(node: MapNode): string | null {
  if (node.type === 'element') return node.data.element.parentId
  if (node.type === 'plan') return node.data.item.parentId
  if (node.type === 'document' || node.type === 'deliverable') return node.data.parentId ?? null
  if (node.type === 'workflow') return node.data.item.parentKey
  return null
}

/** Courbe douce d'un glissement (accélère puis ralentit). */
const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
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
  'node.a11yDescription.default': 'Entrée pour ouvrir la carte de détails, touche Menu pour modifier une idée.',
  'node.a11yDescription.keyboardDisabled': 'Entrée pour ouvrir la carte de détails.',
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
  const structureViews = useUiStore((state) => state.structureViews)
  const analysisLinks = useUiStore((state) => state.analysisLinks)
  const toggleAnalysisLinks = useUiStore((state) => state.toggleAnalysisLinks)
  const openChat = useUiStore((state) => state.openChat)
  // Cartes de détails (spec 022 D15) : plusieurs à la fois, une discussion par carte ; plus de volet de droite.
  const cards = useCards((state) => state.cards)
  const cardsApi = useCards()
  const openIds = useMemo(() => new Set(cards.map((card) => card.id)), [cards])
  /** « Réorganiser » (D22) : les plans partent en ligne au premier niveau. */
  const [transposed, setTransposed] = useState(false)
  const bornId = useUiStore((state) => state.bornId)
  const markBorn = useUiStore((state) => state.markBorn)
  const showToast = useUiStore((state) => state.showToast)
  const createLink = useCreateLink()
  const removeIdea = useRemoveIdea()
  const removeIdeas = useRemoveIdeas()
  // Idées sélectionnées à supprimer après confirmation (touche Suppr).
  const [pendingRemoval, setPendingRemoval] = useState<readonly { readonly id: string; readonly title: string }[]>([])
  /** Champ posé sur la carte à l'endroit d'un double-clic : nouvelle idée. */
  const [draft, setDraft] = useState<{ at: Point; position: Point } | null>(null)
  const [filter, setFilter] = useState<CanvasFilterInput>({})
  const [interacting, setInteracting] = useState(false)
  // Un lien est en train d'être tiré : les widgets entiers l'acceptent, leurs iframes ne captent plus la souris.
  const [connecting, setConnecting] = useState(false)
  const [menu, setMenu] = useState<{ id: string; at: { x: number; y: number } } | null>(null)
  const [importing, setImporting] = useState(false)
  /** Boîte à outils ouverte par un clic droit dans le vide : position à l'écran et point de la carte visé. */
  const [tools, setTools] = useState<{ at: Point; position: Point } | null>(null)
  const closeTools = useCallback(() => setTools(null), [])
  // « Envoyer vers… » d'un bloc (spec 023 D25) : clic droit sur un bloc rangé dans une vue de la carte.
  const [blockMenu, setBlockMenu] = useState<{ id: string; at: Point; view: StructureView } | null>(null)
  const closeBlockMenu = useCallback(() => setBlockMenu(null), [])
  const blockActions = useBlockActions()
  const surface = useRef<HTMLDivElement>(null)
  const clickTimer = useRef(0)
  useEffect(() => () => window.clearTimeout(clickTimer.current), [])

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

  // Vue Workflow (spec 023) : lue seulement pour les projets liés basculés en Workflow.
  const workflowIds = useMemo(
    () =>
      (view?.ideas ?? [])
        .filter((idea) => idea.linkedProject === true && structureViews[idea.id] === 'workflow')
        .map((idea) => idea.id),
    [view, structureViews]
  )
  const workflows = useWorkflows(workflowIds)

  const graph = useMemo((): { nodes: MapNode[]; edges: MapEdge[] } => {
    if (view === undefined || layout === null) return { nodes: [], edges: [] }
    // Positions en cours du moteur (à jour après un glisser), recalculées quand la physique se stabilise.
    const live = positions.size === 0 ? positions : physics.positions()
    const built = buildGraph(
      view,
      { area: layout.area, positions: live },
      bornId,
      openIds,
      structureViews,
      transposed,
      analysisLinks,
      workflows
    )
    return { nodes: built.nodes, edges: [...built.edges, ...built.mapEdges] }
  }, [view, layout, positions, physics, bornId, openIds, structureViews, transposed, analysisLinks, workflows])

  const [nodes, setNodes, onNodesChange] = useNodesState<MapNode>(graph.nodes)

  // Liens d'une carte de structure selon le focus (spec 017 D15) : l'élément survolé, sinon celui de la carte active.
  const [hoveredElement, setHoveredElement] = useState<string | null>(null)
  const activeCardId = useCards((state) => state.activeId)
  const focusId =
    hoveredElement ??
    (activeCardId !== null && view?.elements.some((element) => element.id === activeCardId) === true
      ? activeCardId
      : null)
  // Liens d'analyse éteints (D29) : aucun, même au survol ; seules les alertes « sens interdit » restent.
  const focused = useMemo(
    () =>
      view === undefined
        ? []
        : focusEdges(view.elements, view.mapLinks, view.measuredLinks, focusId)
            .filter((edge) => analysisLinks || edge.violation === true)
            .map(structureFlowEdge),
    [view, focusId, analysisLinks]
  )
  // Liens des nœuds qui se replient : gardés le temps du glissement, ils suivent leurs nœuds jusqu'au parent.
  const [leavingEdges, setLeavingEdges] = useState<readonly MapEdge[]>([])
  const edges = useMemo(() => [...graph.edges, ...focused, ...leavingEdges], [graph.edges, focused, leavingEdges])
  const edgesRef = useRef(edges)
  edgesRef.current = edges

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

  // Cadrage sur tout ce qui est affiché (idées, plans, éléments, blocs), connu par calcul : React Flow ne mesure que les
  // éléments visibles (`onlyRenderVisibleElements`), son cadrage automatique serait faux. Carte vide : l'espace de départ.
  const bounds = useMemo(() => {
    if (layout === null) return null
    const points = graph.nodes.filter((node) => node.className !== 'living-gone').map((node) => node.position)
    if (points.length === 0) return layout.area
    const xs = points.map((point) => point.x)
    const ys = points.map((point) => point.y)
    const x = Math.min(...xs) - FIT_MARGIN
    const y = Math.min(...ys) - FIT_MARGIN
    return { x, y, width: Math.max(...xs) + FIT_MARGIN - x, height: Math.max(...ys) + FIT_MARGIN - y }
  }, [layout, graph])
  // Cadrage initial dès que React Flow connaît la taille réelle de son conteneur (0 px au premier rendu).
  const hasSize = useStore((state) => state.width > 0 && state.height > 0)
  const fitted = useRef(false)
  useEffect(() => {
    if (!hasSize || bounds === null || fitted.current) return
    fitted.current = true
    // Reprise exacte (spec 024 R2) : le cadrage de la dernière fois revient, sinon toute la carte.
    const restored = useUiStore.getState().takeRestoredViewport()
    if (restored !== null) void flow.setViewport(restored)
    else void flow.fitBounds(bounds, { padding: 0.05 })
  }, [hasSize, bounds, flow])

  // Glissements (D4) : quand le repli, la transposition ou les étapes changent, les nœuds glissent vers leur place.
  const glideSignature = useMemo(
    () =>
      view === undefined
        ? ''
        : `${transposed}|${view.steps.map((step) => `${step.id}:${step.rank}:${step.collapsed === true}`).join(',')}|${view.ideas
            .filter((idea) => idea.planCollapsed === true)
            .map((idea) => idea.id)
            .join(',')}|${view.elements
            .map((element) => `${element.id}:${element.collapsed}`)
            .join(',')}|${JSON.stringify(structureViews)}|${graph.nodes
            .filter((node) => node.type === 'workflow')
            .map((node) => node.id)
            .join(',')}`,
    [view, transposed, structureViews, graph]
  )
  const glide = useGlide(glideSignature, reduced)

  // La carte se reconstruit (carte ouverte, données rechargées) : la sélection en cours est gardée. Quand la disposition
  // change (repli, dépli, « Réorganiser », étapes), les positions glissent de l'ancienne place à la nouvelle (D4, D27),
  // image par image : React Flow redessine les liens, les cartes et leurs fils à chaque pas — une transition CSS ne
  // déplacerait que les nœuds, les liens sauteraient. Au dépli, les nouveaux nœuds sortent de leur parent ; au repli,
  // ceux qui disparaissent y rentrent en s'effaçant.
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const glideFrame = useRef(0)
  const glidedSignature = useRef(glideSignature)
  useEffect(() => {
    const keepSelection = (current: readonly MapNode[], next: MapNode[]): MapNode[] => {
      const selected = new Set(current.filter((node) => node.selected === true).map((node) => node.id))
      return selected.size === 0
        ? next
        : next.map((node) => (selected.has(node.id) ? { ...node, selected: true } : node))
    }
    cancelAnimationFrame(glideFrame.current)
    const changed = glidedSignature.current !== glideSignature
    glidedSignature.current = glideSignature
    if (!changed || reduced) {
      setNodes((current) => keepSelection(current, graph.nodes))
      return
    }
    const from = new Map(nodesRef.current.map((node) => [node.id, node.position] as const))
    // Un nœud qui apparaît (dépli) part de la place de son ancêtre visible le plus proche.
    const parents = new Map(graph.nodes.map((node) => [node.id, parentOf(node)] as const))
    const startOf = (id: string): { x: number; y: number } | undefined => {
      for (let current = parents.get(id); current !== null && current !== undefined; current = parents.get(current)) {
        const known = from.get(current)
        if (known !== undefined) return known
      }
      return undefined
    }
    const entering = new Set(graph.nodes.filter((node) => !from.has(node.id)).map((node) => node.id))
    // Un nœud qui disparaît (repli) rentre dans son ancêtre encore affiché, en s'effaçant, avec ses liens.
    const target = new Map(graph.nodes.map((node) => [node.id, node.position] as const))
    const previous = new Map(nodesRef.current.map((node) => [node.id, node] as const))
    const leaving = nodesRef.current.flatMap((node) => {
      if (target.has(node.id)) return []
      for (let up = parentOf(node); up !== null;) {
        const shown = target.get(up)
        if (shown !== undefined) return [{ node, to: shown }]
        const above = previous.get(up)
        up = above === undefined ? null : parentOf(above)
      }
      return []
    })
    const leavingIds = new Set(leaving.map((entry) => entry.node.id))
    setLeavingEdges(edgesRef.current.filter((edge) => leavingIds.has(edge.source) || leavingIds.has(edge.target)))
    // Ce qui bouge est préparé une fois ; à chaque image, seuls ces nœuds sont recréés (les autres gardent leur objet).
    const moving = graph.nodes.flatMap((node) => {
      const before = from.get(node.id) ?? startOf(node.id)
      if (before === undefined || (before.x === node.position.x && before.y === node.position.y)) return []
      return [{ node, before, className: entering.has(node.id) ? `${node.className ?? ''} living-enter`.trim() : null }]
    })
    // Rien à animer (premier chargement, rien qui bouge ni ne disparaît) : la carte se met à jour d'un coup.
    if (moving.length === 0 && leaving.length === 0) {
      setLeavingEdges([])
      setNodes((current) => keepSelection(current, graph.nodes))
      return
    }
    const movingById = new Map(moving.map((entry) => [entry.node.id, entry] as const))
    const at = (a: { x: number; y: number }, b: { x: number; y: number }, k: number): { x: number; y: number } => ({
      x: a.x + (b.x - a.x) * k,
      y: a.y + (b.y - a.y) * k
    })
    const start = performance.now()
    const step = (now: number): void => {
      const t = Math.min(1, (now - start) / GLIDE_MS)
      if (t === 1) {
        setNodes((current) => keepSelection(current, graph.nodes))
        setLeavingEdges([])
        return
      }
      const eased = easeInOut(t)
      const frame = graph.nodes.map((node) => {
        const entry = movingById.get(node.id)
        if (entry === undefined) return node
        return {
          ...node,
          ...(entry.className === null ? {} : { className: entry.className }),
          position: at(entry.before, node.position, eased)
        }
      })
      for (const { node, to } of leaving)
        frame.push({
          ...node,
          className: `${node.className ?? ''} living-leave`.trim(),
          draggable: false,
          selectable: false,
          focusable: false,
          position: at(node.position, to, eased)
        })
      setNodes((current) => keepSelection(current, frame))
      glideFrame.current = requestAnimationFrame(step)
    }
    glideFrame.current = requestAnimationFrame(step)
  }, [graph, glideSignature, reduced, setNodes])
  useEffect(() => () => cancelAnimationFrame(glideFrame.current), [])
  // Zoom fluide (D20) : molette et boutons avec amorti.
  const { zoomBy } = useSmoothZoom(flow, surface, reduced)
  // Une carte dont le nœud a disparu (supprimé, filtré) ou qu'un repli a caché se referme.
  useEffect(() => {
    const shown = new Set(graph.nodes.filter((node) => node.className !== 'living-gone').map((node) => node.id))
    if (view === undefined || graph.nodes.length === 0) return
    for (const card of useCards.getState().cards) if (!shown.has(card.id)) useCards.getState().close(card.id)
  }, [graph, view])

  const recenter = useCallback(() => {
    if (bounds !== null) void flow.fitBounds(bounds, { padding: 0.05, duration: timingFor('dive', reduced).duration })
  }, [bounds, flow, reduced])

  // Nouveau bloc au centre de la partie visible de la carte.
  const addBlock = useCallback(async (): Promise<void> => {
    const box = surface.current?.getBoundingClientRect()
    if (box === undefined) return
    const center = flow.screenToFlowPosition({ x: box.left + box.width / 2, y: box.top + box.height / 2 })
    // La vue affichée est relue par le main : le bloc y naît (spec 023 D25).
    await flushViewState()
    await call('canvas:createBlock', { x: Math.round(center.x), y: Math.round(center.y) })
    await client.invalidateQueries({ queryKey: ['canvas'] })
  }, [flow, client])

  // Gestes stables d'une image à l'autre : la barre d'outils et les cartes (mémoïsées) ne se redessinent pas pendant
  // un glissement (spec 022 D27).
  const reorder = useCallback(() => setTransposed((current) => !current), [])
  const addBlockSafely = useCallback(() => void addBlock().catch(() => undefined), [addBlock])
  const startImport = useCallback(() => setImporting(true), [])
  const openMenu = useCallback((id: string, at: { x: number; y: number }) => setMenu({ id, at }), [])

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
      await flushViewState()
      const block = await call<BlockView>('canvas:createBlock', { kind: tool, x: position.x, y: position.y })
      probeAction('block.create', 'block', 'souris', block.id)
      markBorn(block.id)
      await client.invalidateQueries({ queryKey: ['canvas'] })
    } catch (error) {
      showToast(error instanceof IpcFailure ? error.message : 'L’objet n’a pas pu être ajouté.')
    }
  }

  const sendBlock = async (id: string, target: StructureView): Promise<void> => {
    setBlockMenu(null)
    try {
      await call('canvas:setBlockView', { id, view: target })
      showToast(`Bloc envoyé vers ${VIEW_NAMES[target]}.`)
      await client.invalidateQueries({ queryKey: ['canvas'] })
    } catch (error) {
      showToast(error instanceof IpcFailure ? error.message : 'Le bloc n’a pas pu être envoyé.')
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
  const connectInput = async (
    blockId: string,
    source: string,
    sourceKind: 'idea' | 'plan_step' | 'element' | 'workflow'
  ): Promise<void> => {
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
    if (event.key === 'Delete' && !isEditable(event.target)) {
      // Suppr : les idées sélectionnées (Ctrl / Maj + clic, ou rectangle Maj + glisser), sinon celle qui a le focus.
      const focusedNode = mapNodeOf(event.target)
      const selected = new Set(
        nodes.filter((node) => node.selected === true && node.type === 'neuron').map((node) => node.id)
      )
      if (selected.size === 0 && focusedNode?.type === 'neuron') selected.add(focusedNode.id)
      const ideas = (view?.ideas ?? []).filter((idea) => selected.has(idea.id)).map(({ id, title }) => ({ id, title }))
      if (ideas.length > 0) {
        event.preventDefault()
        setPendingRemoval(ideas)
      }
      return
    }
    if (event.key === 'Escape' && !isEditable(event.target)) {
      // Échap agit sur la carte active (D15) : replie d'abord le lecteur, puis la ferme.
      const active = cards.find((card) => card.id === activeCardId)
      if (active !== undefined) {
        event.preventDefault()
        if (active.side === 'reader') cardsApi.setSide(active.id, null)
        else cardsApi.close(active.id)
      }
      return
    }
    const target = mapNodeOf(event.target)
    if (target === null || isEditable(event.target)) return
    const targetNode = nodesRef.current.find((node) => node.id === target.id)
    if (event.key === 'Enter' && targetNode !== undefined && hasCard(targetNode)) {
      event.preventDefault()
      cardsApi.open(target.id)
      return
    }
    if (target.type !== 'neuron') return
    const id = target.id
    if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
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
        onReorder={reorder}
        analysisLinks={analysisLinks}
        onToggleAnalysisLinks={toggleAnalysisLinks}
        openCards={cards.length}
        onCloseCards={cardsApi.closeAll}
        onAddBlock={addBlockSafely}
        onImport={startImport}
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
          data-drift={
            reduced ? 'off' : driftActive(reduced, interacting || cards.length > 0 || glide === 'on') ? 'on' : 'paused'
          }
          data-glide={glide}
          data-connecting={connecting ? 'true' : undefined}
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
              zoomOnScroll={false}
              nodesConnectable
              connectionRadius={64}
              onConnect={onConnect}
              onConnectStart={() => setConnecting(true)}
              onConnectEnd={() => setConnecting(false)}
              isValidConnection={isValidConnection}
              zoomOnDoubleClick={false}
              // Tab va d'idée en idée.
              edgesFocusable={false}
              // Suppr passe par la confirmation (onKeyDown) : React Flow ne supprime jamais un nœud lui-même.
              deleteKeyCode={null}
              multiSelectionKeyCode={MULTI_SELECTION_KEYS}
              selectionKeyCode={SELECTION_BOX_KEYS}
              // Une idée touchée par le rectangle est prise, comme une icône sur le bureau.
              selectionMode={SelectionMode.Partial}
              ariaLabelConfig={ARIA_LABELS}
              colorMode={colorSchemeOf(settings.theme)}
              proOptions={{ hideAttribution: true }}
              onMoveStart={() => setInteracting(true)}
              onMoveEnd={(_event, viewport) => {
                setInteracting(false)
                useUiStore.getState().setViewport(viewport)
              }}
              // Un clic sur un nœud ouvre sa carte de détails (spec 022 D5, D15), un nouveau clic la referme ; on attend un
              // instant pour qu'un double-clic (carte sur la discussion) ne l'ouvre pas puis ne la referme pas.
              onNodeClick={(event, node) => {
                // Ctrl / Cmd / Maj + clic : on compose une sélection (suppression groupée), sans carte.
                if (event.ctrlKey || event.metaKey || event.shiftKey) return
                if (!hasCard(node) || node.className === 'living-gone') return
                window.clearTimeout(clickTimer.current)
                clickTimer.current = window.setTimeout(() => {
                  // Clic sur un autre nœud = clic à l'extérieur des cartes ouvertes (D28) : les non épinglées se ferment.
                  if (useCards.getState().cards.some((card) => card.id === node.id)) cardsApi.close(node.id)
                  else {
                    cardsApi.closeUnpinned(node.id)
                    cardsApi.open(node.id)
                  }
                }, CLICK_DELAY_MS)
              }}
              onNodeDoubleClick={(_event, node) => {
                window.clearTimeout(clickTimer.current)
                // Nœud Workflow (spec 023) : sa carte s'étire avec la conversation du projet, consigne pré-remplie.
                if (node.type === 'workflow') {
                  cardsApi.closeUnpinned(node.id)
                  discussWorkflow(node.data.item)
                  return
                }
                const conversational =
                  node.type === 'neuron' ||
                  node.type === 'element' ||
                  (node.type === 'plan' && node.data.item.kind === 'step')
                if (conversational) {
                  cardsApi.closeUnpinned(node.id)
                  cardsApi.open(node.id, { side: 'chat' })
                }
              }}
              // Clic dans le vide : les cartes non épinglées se ferment (D28) ; une carte épinglée reste.
              onPaneClick={() => cardsApi.closeUnpinned()}
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
                const block = view?.blocks.find((entry) => entry.id === node.id)
                if (block?.view !== undefined && block.view !== null) {
                  event.preventDefault()
                  setBlockMenu({ id: block.id, at: { x: event.clientX, y: event.clientY }, view: block.view })
                  return
                }
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
              <Background gap={32} size={1} className="canvas-sober" />
              <Controls showInteractive={false} showZoom={false} showFitView={false}>
                <ControlButton onClick={() => zoomBy(1.25)} aria-label="Zoomer" title="Zoomer">
                  +
                </ControlButton>
                <ControlButton onClick={() => zoomBy(1 / 1.25)} aria-label="Dézoomer" title="Dézoomer">
                  −
                </ControlButton>
                <ControlButton onClick={recenter} aria-label="Tout afficher" title="Tout afficher">
                  ⤢
                </ControlButton>
              </Controls>
              {view === undefined ? null : <IdeaCards view={view} onMenu={openMenu} />}
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
          {blockMenu === null ? null : (
            <ContextMenu
              at={blockMenu.at}
              label="Envoyer le bloc vers une autre vue"
              items={STRUCTURE_VIEWS.filter((target) => target !== blockMenu.view).map(
                (target): MenuItem<StructureView> => ({
                  tool: target,
                  icon: '→',
                  label: `Envoyer vers ${VIEW_NAMES[target]}`,
                  hint: 'Il quittera cette vue de la carte'
                })
              )}
              onPick={(target) => void sendBlock(blockMenu.id, target)}
              onClose={closeBlockMenu}
            />
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
      </div>
      <WidgetReview />
      {pendingRemoval.length > 0 ? (
        <RemoveIdeasDialog
          ideas={pendingRemoval}
          onConfirm={() => removeIdeas(pendingRemoval, 'clavier')}
          onClose={() => setPendingRemoval([])}
        />
      ) : null}
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
