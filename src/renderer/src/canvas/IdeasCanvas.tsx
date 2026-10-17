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
import { createPortal } from 'react-dom'
import { CAPTURE_MAX_CHARS, colorSchemeOf } from '@shared/ipc/app'
import type { BlockView, CanvasFilterInput, IdeasCanvasView } from '@shared/ipc/canvas'
import type { RootView } from '@shared/ipc/neurons'
import { useTopbarSlot } from '../app/topbarSlot'
import { useUiStore } from '../app/uiStore'
import { useEffectiveSettings } from '../app/useAppSettings'
import { call, IpcFailure } from '../lib/ipc'
import { probeAction } from '../analyste/probe'
import { timingFor } from '../motion/durations'
import { useReducedMotionPreference } from '../motion/useReducedMotionPreference'
import { projectGenesisOf } from './projectGenesis'
import { buildGraph, computeLayout, ideaLinks, structureFlowEdge, type CanvasNode } from './buildGraph'
import { focusEdges } from './structureGraph'
import { ImportWizard } from '../reprise/ImportWizard'
import { CanvasToolbar } from './CanvasToolbar'
import { BranchEdge, type BranchEdgeType } from './edges/BranchEdge'
import { MapLinkEdge, type MapLinkEdgeType } from './edges/MapLinkEdge'
import { driftActive, type Point } from './forceLayout'
import { InlinePrompt } from './InlinePrompt'
import { NeuronMenu } from './NeuronMenu'
import { ArchitectureView } from './ArchitectureView'
import { ProgressionView } from './progression/ProgressionView'
import { BlockNode } from './nodes/BlockNode'
import { ElementNode } from './nodes/ElementNode'
import { StructureBar, StructureBarNode, type StructureBarData } from './nodes/StructureBarNode'
import { FrameNode } from './nodes/FrameNode'
import { LabelNode } from './nodes/LabelNode'
import { MapNoteNode } from './nodes/MapNoteNode'
import { WidgetReview } from '../widgets/WidgetReview'
import { useWidgetReview, widgetIoKey } from '../widgets/useWidgetIo'
import type { WidgetIoStateView } from '@shared/ipc/widgetIo'
import { ResultNode } from './nodes/ResultNode'
import { SettingsNode } from './nodes/SettingsNode'
import { WIDGET_TILE, WidgetNode } from './nodes/WidgetNode'
import { useFarZoom } from './zoomLevels'
import { besideAnchor, type CenteredBox } from './widgetPlacement'
import { pauseMapRooms } from './agents/room/roomPause'
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
import { IdeaCards, subjectOf, tabInputOf, tabLabelOf } from './cards/IdeaCards'
import { cardHead } from './cards/cardContent'
import { agentsTitle, shownAgent, useSidePanel } from './side/sidePanelStore'
import { AgentEdge } from './agents/AgentEdge'
import { AgentNode } from './agents/AgentNode'
import { agentGraph, runOf, wouldCycle } from './agents/agentGraph'
import {
  benchNodeId,
  parseAgentNodeId,
  parseBenchNodeId,
  type AgentEdgeType,
  type AgentNodeData,
  type BenchAgentNodeType
} from './agents/agentTypes'
import { AgentTray, AGENT_DRAG_TYPE } from './agents/AgentTray'
import { BenchAgentNode } from './agents/BenchAgentNode'
import { useBench } from './agents/useBench'
import { StrayTeams } from './agents/StrayTeams'
import { relinkTargets, strayTeams } from './agents/teamTargets'
import { addAgent, addLink, emptySketch, placeAgent } from './agents/sketchEdit'
import { useVisio } from './agents/visioStore'
import { hostsAgents } from './agents/agentsHost'
import type { AgentProfileView } from '@shared/agents/profile'
import { useAssemblyActions, useAssemblyData } from './agents/useAssemblies'
import { focusViewOf, viewNodeIds, viewTitles } from './side/viewNodes'
import { useCards } from './cards/cardsStore'
import { useSmoothZoom } from './useSmoothZoom'
import { GLIDE_MS, useGlide } from './useGlide'
import { connectionIntent } from './connection'
import { useWorkflows } from './workflow/useWorkflow'
import { WorkflowNode } from './workflow/WorkflowNode'
import { FolderNode } from './folder/FolderNode'
import { discussWorkflow } from './workflow/WorkflowCard'

/** Types de nœuds ; chacun ne se redessine que si son contenu change (glissements fluides, spec 022). */
const NODE_TYPES: NodeTypes = {
  neuron: stillNode(NeuronNode),
  block: stillNode(BlockNode),
  label: stillNode(LabelNode),
  mapNote: stillNode(MapNoteNode),
  frame: stillNode(FrameNode),
  element: stillNode(ElementNode),
  structureBar: stillNode(StructureBarNode),
  widget: stillNode(WidgetNode),
  result: stillNode(ResultNode),
  widgetSettings: stillNode(SettingsNode),
  plan: stillNode(PlanNode),
  planBar: stillNode(PlanBarNode),
  document: stillNode(DocumentNode),
  deliverable: stillNode(DeliverableNode),
  workflow: stillNode(WorkflowNode),
  folder: stillNode(FolderNode),
  agent: stillNode(AgentNode),
  benchAgent: stillNode(BenchAgentNode)
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
const EDGE_TYPES: EdgeTypes = { branch: BranchEdge, mapLink: MapLinkEdge, agentLink: AgentEdge }

/** Tout objet de la carte : idées, blocs, éléments de structure. */
type MapNode = CanvasNode

/** Durée de la surbrillance d'arrivée dans le Workflow (spec 032 Q8). */
const ARRIVAL_MS = 5000
/** Délai après un zoom ou un déplacement avant de redessiner la carte nette (repixelisation). */
const SETTLE_MS = 150

/** Nœuds Workflow du rond `key` et de tout ce qui pend sous lui, marqués `className` (arrivée depuis la Progression). */
function markArrival(nodes: readonly MapNode[], key: string, className: string): MapNode[] {
  const parents = new Map<string, string>()
  for (const node of nodes) if (node.type === 'workflow') parents.set(node.id, node.data.item.parentKey)
  const arrived = (id: string): boolean => {
    for (let at: string | undefined = id; at !== undefined; at = parents.get(at)) if (at === key) return true
    return false
  }
  return nodes.map((node) =>
    node.type === 'workflow' && arrived(node.id)
      ? { ...node, className: `${node.className ?? ''} ${className}`.trim() }
      : node
  )
}
type MapEdge = BranchEdgeType | MapLinkEdgeType | AgentEdgeType
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
/** Nœuds placés par une disposition (plan, annexes, dossiers) : un glissement devient un décalage enregistré. */
const PLACED_TYPES: ReadonlySet<string> = new Set(['plan', 'document', 'deliverable', 'folder'])
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

/** Attente maximale d'un nœud après une bascule de vue (« Centrer sur le nœud ») : la vue Workflow se lit d'abord. */
const FOCUS_WAIT_MS = 4000

function CanvasInner(): React.JSX.Element {
  const flow = useReactFlow()
  const client = useQueryClient()
  const settings = useEffectiveSettings()
  const reduced = useReducedMotionPreference(settings.motion)
  const structureViews = useUiStore((state) => state.structureViews)
  const collapsedWidgets = useUiStore((state) => state.collapsedWidgets)
  const panelFolded = useUiStore((state) => state.panelFolded)
  const foldPanel = useUiStore((state) => state.foldPanel)
  const analysisLinks = useUiStore((state) => state.analysisLinks)
  // Canevas d'un projet (spec 024) : « Reprendre un projet existant » n'y a pas sa place (audit 2026-10-11).
  const projectFolder = useUiStore((state) => state.brainstorm?.folder ?? null)
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
  // Repixelisation dynamique (demande de mentalyas, 2026-10-17) : pendant un zoom ou un déplacement, la carte n'est
  // qu'une image que le navigateur agrandit (rapide, un peu floue) ; elle est redessinée nette un instant après.
  const [moving, setMoving] = useState(false)
  const settleTimer = useRef(0)
  useEffect(() => () => window.clearTimeout(settleTimer.current), [])
  const far = useFarZoom()
  useEffect(() => pauseMapRooms(far), [far])
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
  // Clic droit sur un nœud du Workflow : appeler un agent, ou ouvrir le volet de ses agents (L1o D14).
  const [agentsMenu, setAgentsMenu] = useState<{
    hostId: string
    genesisId: string
    title: string
    at: Point
  } | null>(null)
  const closeAgentsMenu = useCallback(() => setAgentsMenu(null), [])
  // Tiroir « Appeler un agent » (L1o D26) : dans le vide (poser un agent libre) ou sur un nœud (l'y connecter).
  const [tray, setTray] = useState<
    | { mode: 'place'; at: Point; position: Point }
    | { mode: 'connect'; at: Point; hostId: string; genesisId: string; title: string }
    | null
  >(null)
  const closeTray = useCallback(() => setTray(null), [])
  const [benchMenu, setBenchMenu] = useState<{ benchId: string; name: string; at: Point } | null>(null)
  const closeBenchMenu = useCallback(() => setBenchMenu(null), [])
  // Clic droit sur un agent : visio, gestion, renvoi.
  const [agentMenu, setAgentMenu] = useState<{ node: AgentNodeData; nodeId: string; at: Point } | null>(null)
  const closeAgentMenu = useCallback(() => setAgentMenu(null), [])
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
  const arrival = useUiStore((state) => state.workflowArrival)
  // Agents connectés aux nœuds (T006) : croquis, assemblages suivis en direct, volet affiché.
  const assemblyData = useAssemblyData()
  const assemblyActions = useAssemblyActions()
  /** Connecte un agent (profil) à un nœud du Workflow : il rejoint le croquis de ce nœud (L1o D14, D26). */
  const joinHost = (profile: AgentProfileView, hostId: string, genesisId: string): Promise<boolean> => {
    const sketch = assemblyData.sketches.find((entry) => entry.nodeId === hostId) ?? emptySketch(hostId, genesisId)
    return assemblyActions.save(addAgent(profile)(sketch))
  }
  const shownAgentHost = useSidePanel((state) => shownAgent(state)?.hostId ?? null)
  const shownAgentId = useSidePanel((state) => shownAgent(state)?.agentId ?? null)

  // La barre des vues monte dans la barre fine (spec 033 D10) ; les autres genesis gardent la leur.
  const projectGenesisId = useUiStore((state) => state.brainstorm?.genesisId ?? null)
  const bench = useBench(projectGenesisId)
  // Équipes dont le nœud a disparu du Workflow (L1o D27) : signalées, à rattacher.
  const projectEntry = projectGenesisId === null ? undefined : workflows[projectGenesisId]
  const projectWorkflow = projectEntry !== undefined && 'view' in projectEntry ? projectEntry.view : undefined
  const strays = useMemo(
    () =>
      projectWorkflow === undefined || projectGenesisId === null
        ? []
        : strayTeams(projectWorkflow, projectGenesisId, assemblyData.sketches),
    [projectWorkflow, projectGenesisId, assemblyData.sketches]
  )
  const strayTargets = useMemo(
    () =>
      projectWorkflow === undefined || projectGenesisId === null || strays.length === 0
        ? []
        : relinkTargets(projectWorkflow, projectGenesisId, assemblyData.sketches),
    [projectWorkflow, projectGenesisId, assemblyData.sketches, strays.length]
  )
  const graph = useMemo((): { nodes: MapNode[]; edges: MapEdge[]; headerBar: StructureBarData | null } => {
    if (view === undefined || layout === null) return { nodes: [], edges: [], headerBar: null }
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
    // Celle du genesis du projet, sinon la première de la carte (un projet repris a son propre genesis) : la navigation
    // des vues reste toujours en haut dans Idées.
    const bars = built.nodes.filter((node) => node.type === 'structureBar')
    const bar = bars.find((node) => node.id === `structure-bar-${projectGenesisId ?? ''}`) ?? bars[0]
    const shown = bar === undefined ? built.nodes : built.nodes.filter((node) => node !== bar)
    // Un widget replié n'occupe que sa tuile ; sa taille dépliée reste dans le bloc (`data.block`). Son panneau de
    // réglages, qui ne réglerait plus rien, se cache avec lui (et revient au dépliage).
    const tiled = shown.map((node) =>
      node.type === 'widget' && collapsedWidgets.includes(node.id)
        ? { ...node, width: WIDGET_TILE, height: WIDGET_TILE }
        : node.type === 'widgetSettings' && collapsedWidgets.includes(node.data.block.sourceBlockId ?? '')
          ? { ...node, hidden: true }
          : node
    )
    const marked =
      arrival === null ? tiled : markArrival(tiled, arrival.key, reduced ? 'wf-arrived-still' : 'wf-arrived')
    // Les agents sont connectés aux nœuds du Workflow (L1o D14) ; un nœud caché (replié, autre vue) les cache.
    const hosts = new Map<string, { x: number; y: number; title: string }>()
    for (const node of marked) {
      if (node.type === 'workflow' && hostsAgents(node.data.item))
        hosts.set(node.id, { x: node.position.x, y: node.position.y, title: node.data.item.title })
    }
    const agents = agentGraph({
      sketches: assemblyData.sketches,
      runs: assemblyData.runs,
      profiles: assemblyData.profiles,
      hosts,
      shown: shownAgentHost === null ? null : { hostId: shownAgentHost, agentId: shownAgentId }
    })
    // Agents posés libres (L1o D26) : leur carte d'identité, à leur place ; un profil supprimé ne se dessine plus.
    const free: BenchAgentNodeType[] = bench.agents.flatMap((entry) => {
      const profile = assemblyData.profiles.find((candidate) => candidate.id === entry.profileId)
      return profile === undefined
        ? []
        : [
            {
              id: benchNodeId(entry.id),
              type: 'benchAgent' as const,
              position: { x: entry.x, y: entry.y },
              data: { benchId: entry.id, genesisId: entry.genesisId, profile }
            }
          ]
    })
    return {
      nodes: [...marked, ...agents.nodes, ...free],
      edges: [...built.edges, ...built.mapEdges, ...agents.edges],
      headerBar: bar?.type === 'structureBar' ? bar.data : null
    }
  }, [
    view,
    layout,
    positions,
    physics,
    bornId,
    openIds,
    structureViews,
    collapsedWidgets,
    transposed,
    analysisLinks,
    workflows,
    arrival,
    reduced,
    projectGenesisId,
    assemblyData,
    shownAgentHost,
    shownAgentId,
    bench.agents
  ])
  const topbarSlot = useTopbarSlot()
  // L'arrivée s'efface d'elle-même (une plus récente garde son propre délai).
  const endArrival = useUiStore((state) => state.endArrival)
  useEffect(() => {
    if (arrival === null) return
    const timer = setTimeout(() => endArrival(arrival.nonce), ARRIVAL_MS)
    return () => clearTimeout(timer)
  }, [arrival, endArrival])

  const [nodes, setNodes, onNodesChange] = useNodesState<MapNode>(graph.nodes)

  // Widget posé par Claude et relié à un nœud dont seule la carte connaît la place (spec 026 D11) : posé à côté de ce
  // nœud dès que les deux sont là. Nœud replié ou dans une autre vue : le widget reste près du genesis.
  const widgetPlacements = useUiStore((state) => state.widgetPlacements)
  useEffect(() => {
    const boxOf = (node: MapNode): CenteredBox => ({
      x: node.position.x,
      y: node.position.y,
      width: node.measured?.width ?? node.width ?? 0,
      height: node.measured?.height ?? node.height ?? 0
    })
    for (const placement of widgetPlacements) {
      const widget = nodes.find((node) => node.id === placement.blockId)
      if (widget === undefined || !('block' in widget.data)) continue
      useUiStore.getState().widgetPlaced(placement.blockId)
      const anchor = nodes.find((node) => node.id === placement.anchorId && node.hidden !== true)
      if (anchor === undefined) continue
      const size = { width: widget.data.block.width, height: widget.data.block.height }
      const others = nodes.filter((node) => node.id !== widget.id && node.hidden !== true).map(boxOf)
      void blockActions.save(widget.id, { ...besideAnchor(boxOf(anchor), size, others), ...size })
    }
  }, [widgetPlacements, nodes, blockActions])

  // Liens d'une carte de structure selon le focus (spec 017 D15) : l'élément survolé, sinon celui de la carte active.
  const [hoveredElement, setHoveredElement] = useState<string | null>(null)
  const activeCardId = useCards((state) => state.activeId)
  const focusId =
    hoveredElement ??
    (activeCardId !== null && view?.elements.some((element) => element.id === activeCardId) === true
      ? activeCardId
      : null)
  // Liens d'analyse éteints (D29) : aucun, même au survol.
  const focused = useMemo(
    () =>
      view === undefined
        ? []
        : focusEdges(view.elements, view.mapLinks, view.measuredLinks, focusId)
            .filter(() => analysisLinks)
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
        } else if (node.type === 'folder') {
          const { neuronId, offset } = node.data.badge
          await call('folder:move', { neuronId, x: Math.round(offset.x + dx), y: Math.round(offset.y + dy) })
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

  const saveAgentPlace = useCallback(
    (hostId: string, agentId: string, at: Point): void => {
      const host = flow.getNode(hostId)
      const sketch = assemblyData.sketches.find((entry) => entry.nodeId === hostId)
      if (host === undefined || sketch === undefined) return
      void assemblyActions.save(placeAgent(agentId, { x: at.x - host.position.x, y: at.y - host.position.y })(sketch))
    },
    [flow, assemblyData.sketches, assemblyActions]
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
  // Onglets du panneau de droite (spec 027 FR-014) : titre et sorte suivent leur nœud ; un nœud qui n'existe plus ferme
  // son onglet. Un nœud seulement caché (repli, autre vue, filtre) le garde.
  const tabKeys = useSidePanel((state) => state.tabs.map((tab) => tab.key).join('|'))
  useEffect(() => {
    if (view === undefined || tabKeys === '') return
    const labels = viewTitles(view)
    for (const node of graph.nodes) {
      const subject = subjectOf(node, view)
      if (subject !== null && subject.kind !== 'workflow') labels.set(node.id, tabLabelOf(cardHead(subject)))
    }
    const filtered = Object.values(filter).some((value) => value !== undefined && value !== '')
    useSidePanel.getState().syncWithView(labels, filtered ? undefined : viewNodeIds(view))
  }, [graph, view, filter, tabKeys])

  // « Centrer sur le nœud » (spec 027 D4, R5) : le panneau dépose une demande, la carte l'exécute. Le nœud est centré
  // sur sa place finale (même pendant un glissement), sans animation si elles sont réduites ; s'il est dans une autre
  // vue de la carte du projet, la vue bascule d'abord, puis il est centré dès qu'il est dessiné. Chaque demande (nonce)
  // n'est exécutée qu'une fois.
  const focus = useSidePanel((state) => state.focus)
  const setStructureView = useUiStore((state) => state.setStructureView)
  const pendingFocus = useRef<{ readonly nodeId: string; readonly until: number } | null>(null)
  const graphRef = useRef(graph)
  graphRef.current = graph
  const centerOn = useCallback(
    (nodeId: string): boolean => {
      const node = graphRef.current.nodes.find((entry) => entry.id === nodeId && entry.className !== 'living-gone')
      if (node === undefined) return false
      void flow.setCenter(node.position.x, node.position.y, {
        zoom: flow.getZoom(),
        duration: timingFor('dive', reduced).duration
      })
      return true
    },
    [flow, reduced]
  )
  const notShown = useCallback(
    () => showToast('Ce nœud n’est pas affiché sur la carte (supprimé, replié ou filtré).'),
    [showToast]
  )
  const handledFocus = useRef(0)
  useEffect(() => {
    if (focus === null || focus.nonce === handledFocus.current) return
    handledFocus.current = focus.nonce
    pendingFocus.current = null
    if (centerOn(focus.nodeId)) return
    const current = viewRef.current
    const target = current === undefined ? null : focusViewOf(focus.nodeId, current)
    const ui = useUiStore.getState()
    const there = target !== null && ui.structureViews[target.genesisId] === target.kind
    // Un élément de la carte de structure se montre sous le panneau Progression, replié (spec 032).
    const covered = there && target.kind !== 'workflow' && !ui.panelFolded
    if (target === null || (there && !covered)) {
      notShown()
      return
    }
    pendingFocus.current = { nodeId: focus.nodeId, until: Date.now() + FOCUS_WAIT_MS }
    if (!there) setStructureView(target.genesisId, target.kind)
    if (target.kind !== 'workflow') foldPanel(true)
  }, [focus, centerOn, notShown, setStructureView, foldPanel])
  useEffect(() => {
    const pending = pendingFocus.current
    if (pending === null) return
    if (centerOn(pending.nodeId)) pendingFocus.current = null
    else if (Date.now() > pending.until) {
      pendingFocus.current = null
      notShown()
    }
  }, [graph, centerOn, notShown])

  // « Tout afficher » : tout le graphe ; « Recentrer » : le genesis du projet, à 100 % (spec 024 D20).
  const fitAll = useCallback(() => {
    if (bounds !== null) void flow.fitBounds(bounds, { padding: 0.05, duration: timingFor('dive', reduced).duration })
  }, [bounds, flow, reduced])
  const recenter = useCallback(() => {
    const genesis = projectGenesisOf(view?.ideas ?? [])
    const node = genesis === null ? undefined : graphRef.current.nodes.find((entry) => entry.id === genesis.id)
    if (node === undefined) {
      fitAll()
      return
    }
    void flow.setCenter(node.position.x, node.position.y, { zoom: 1, duration: timingFor('dive', reduced).duration })
  }, [view, flow, reduced, fitAll])

  // Gestes stables d'une image à l'autre : la barre d'outils et les cartes (mémoïsées) ne se redessinent pas pendant
  // un glissement (spec 022 D27).
  const reorder = useCallback(() => setTransposed((current) => !current), [])
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
    if (tool === 'links') {
      toggleAnalysisLinks()
      return
    }
    if (tool === 'agent') {
      setTray({ mode: 'place', at: tools.at, position })
      return
    }
    try {
      await flushViewState()
      // Bloc libre (spec 033 D8, l'ancien « + Bloc ») : sans sorte ; note et widget gardent la leur.
      const block = await call<BlockView>(
        'canvas:createBlock',
        tool === 'block' ? { x: position.x, y: position.y } : { kind: tool, x: position.x, y: position.y }
      )
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
  const isValidConnection = (connection: Connection | MapEdge): boolean => {
    if (parseBenchNodeId(connection.source) !== null) return false
    if (parseAgentNodeId(connection.source) !== null || parseAgentNodeId(connection.target) !== null)
      return agentLinkOf(connection.source, connection.target) !== null
    return connectionIntent(viewRef.current, connection.source, connection.target) !== null
  }

  // Lien tiré d'un agent à l'autre (T006) : le second attend le premier. Seulement dans un même assemblage, hors boucle
  // et tant qu'il ne tourne pas.
  const agentLinkOf = (source: string, target: string) => {
    const from = parseAgentNodeId(source)
    const to = parseAgentNodeId(target)
    if (from === null || to === null || from.hostId !== to.hostId) return null
    const sketch = assemblyData.sketches.find((entry) => entry.nodeId === from.hostId)
    if (sketch === undefined || runOf(sketch, assemblyData.runs)?.state === 'running') return null
    if (sketch.links.some((link) => link.from === from.agentId && link.to === to.agentId)) return null
    return wouldCycle(sketch.links, from.agentId, to.agentId) ? null : { sketch, from: from.agentId, to: to.agentId }
  }

  const onConnect = (connection: Connection): void => {
    const agentLink = agentLinkOf(connection.source, connection.target)
    if (agentLink !== null) {
      void assemblyActions.save(addLink(agentLink.from, agentLink.to)(agentLink.sketch))
      return
    }
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
      // Échap ferme la carte active (D15) ; le lecteur vit dans le panneau de droite (spec 027).
      const active = cards.find((card) => card.id === activeCardId)
      if (active !== undefined) {
        event.preventDefault()
        cardsApi.close(active.id)
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
  // Carte choisie en Progression ou en Architecture (spec 032 D12, D14) : son panneau couvre la carte (une à la fois),
  // repliable pour voir la carte dessous. Sans choix, la carte s'affiche comme avant.
  const panelIdea = view?.ideas.find(
    (idea) =>
      (structureViews[idea.id] === 'progression' || structureViews[idea.id] === 'architecture') &&
      (idea.linkedProject === true || view.elements.some((element) => element.genesisId === idea.id))
  )
  const panel =
    panelIdea === undefined
      ? null
      : {
          genesisId: panelIdea.id,
          title: panelIdea.title,
          shown: structureViews[panelIdea.id] as 'progression' | 'architecture'
        }
  const panelShown = panel !== null && !panelFolded
  const empty = view !== undefined && view.ideas.length === 0

  return (
    <div className="relative flex h-full flex-col">
      {topbarSlot === null || graph.headerBar === null
        ? null
        : createPortal(<StructureBar {...graph.headerBar} inHeader />, topbarSlot)}
      <CanvasToolbar
        view={view}
        filter={filter}
        onFilter={setFilter}
        onRecenter={recenter}
        onReorder={reorder}
        openCards={cards.length}
        onCloseCards={cardsApi.closeAll}
        {...(projectFolder === null ? { onImport: startImport } : {})}
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
      <div className="relative flex min-h-0 flex-1">
        <div
          ref={surface}
          // Couverte par un panneau (Progression, Architecture) : hors du clavier et des lecteurs d'écran.
          inert={panelShown}
          className="relative min-h-0 min-w-0 flex-1"
          data-drift={
            reduced ? 'off' : driftActive(reduced, interacting || cards.length > 0 || glide === 'on') ? 'on' : 'paused'
          }
          data-glide={glide}
          data-moving={moving ? 'on' : undefined}
          data-zoom={far ? 'far' : undefined}
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
              onConnectEnd={(event, state) => {
                setConnecting(false)
                // Lien tiré d'un agent libre (L1o D26) : lâché n'importe où sur une tâche ou un nœud du Workflow, il
                // l'y connecte et quitte la carte.
                const benchId = state.fromNode === null ? null : parseBenchNodeId(state.fromNode.id)
                const entry = bench.agents.find((candidate) => candidate.id === benchId)
                if (entry === undefined) return
                const point = 'changedTouches' in event ? event.changedTouches[0] : event
                const under = point === undefined ? null : document.elementFromPoint(point.clientX, point.clientY)
                const hostId = under?.closest('.react-flow__node')?.getAttribute('data-id') ?? null
                const host = hostId === null ? undefined : nodes.find((candidate) => candidate.id === hostId)
                const profile = assemblyData.profiles.find((candidate) => candidate.id === entry.profileId)
                if (host?.type !== 'workflow' || !hostsAgents(host.data.item) || profile === undefined) return
                void joinHost(profile, host.id, host.data.genesisId).then((joined) => {
                  if (joined) void bench.remove(entry.id)
                })
              }}
              onDragOver={(event) => {
                if (!event.dataTransfer.types.includes(AGENT_DRAG_TYPE)) return
                event.preventDefault()
                event.dataTransfer.dropEffect = 'copy'
              }}
              onDrop={(event) => {
                const profileId = event.dataTransfer.getData(AGENT_DRAG_TYPE)
                if (profileId === '') return
                event.preventDefault()
                const at = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY })
                void bench.place(profileId, at.x, at.y)
                setTray(null)
              }}
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
              onMoveStart={() => {
                setInteracting(true)
                window.clearTimeout(settleTimer.current)
                setMoving(true)
              }}
              onMoveEnd={(_event, viewport) => {
                setInteracting(false)
                window.clearTimeout(settleTimer.current)
                settleTimer.current = window.setTimeout(() => setMoving(false), SETTLE_MS)
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
                  discussWorkflow(node.data.item, node.data.genesisId)
                  return
                }
                const conversational =
                  node.type === 'neuron' ||
                  node.type === 'element' ||
                  (node.type === 'plan' && node.data.item.kind === 'step')
                const subject = view === undefined ? null : subjectOf(node, view)
                if (conversational && subject !== null) {
                  cardsApi.closeUnpinned(node.id)
                  cardsApi.open(node.id)
                  useSidePanel.getState().openChat(tabInputOf(node.id, subject))
                }
              }}
              // Clic dans le vide : les cartes non épinglées se ferment (D28) ; une carte épinglée reste.
              onPaneClick={() => {
                cardsApi.closeUnpinned()
                // Un clic dans le vide raccroche aussi la visio d'un agent (L1o D13).
                useVisio.getState().close()
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
                // Agent (L1o D13) : visio, gestion de l'assemblage, ou le renvoyer (le détacher de son nœud).
                if (node.type === 'agent') {
                  event.preventDefault()
                  setAgentMenu({ node: node.data, nodeId: node.id, at: { x: event.clientX, y: event.clientY } })
                  return
                }
                // Agent libre (L1o D26) : le retirer de la carte.
                if (node.type === 'benchAgent') {
                  event.preventDefault()
                  setBenchMenu({
                    benchId: node.data.benchId,
                    name: node.data.profile.name,
                    at: { x: event.clientX, y: event.clientY }
                  })
                  return
                }
                // Nœud du Workflow (L1o D14) : on y appelle des agents.
                if (node.type === 'workflow' && hostsAgents(node.data.item)) {
                  event.preventDefault()
                  setAgentsMenu({
                    hostId: node.id,
                    genesisId: node.data.genesisId,
                    title: node.data.item.title,
                    at: { x: event.clientX, y: event.clientY }
                  })
                  return
                }
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
                // Étape, document ou dossier : placés par la disposition, hors de la physique.
                if (PLACED_TYPES.has(node.type ?? '')) {
                  planDrag.current = { id: node.id, at: node.position }
                  return
                }
                // Les autres objets ne bougent pas pendant un glisser (retour de mentalyas, 2026-10-06).
              }}
              onNodeDragStop={(_event, node) => {
                // Agent lâché (L1o D13) : sa place est gardée par rapport à son nœud, qu'il suit ensuite.
                if (node.type === 'agent') {
                  saveAgentPlace(node.data.hostId, node.data.agentId, node.position)
                  return
                }
                if (node.type === 'benchAgent') {
                  void bench.move(node.data.benchId, node.position.x, node.position.y)
                  return
                }
                if (PLACED_TYPES.has(node.type ?? '')) {
                  void savePlanDrag(node)
                  return
                }
                // Lâché : il reste épinglé à cette place, sans déplacer les autres.
                physics.pin(node.id, node.position)
                if (node.type !== undefined && BLOCK_TYPES.has(node.type)) {
                  // Un widget replié garde sa taille dépliée : seule sa place change.
                  const folded = node.type === 'widget' && collapsedWidgets.includes(node.id)
                  void blockActions.save(node.id, {
                    ...node.position,
                    width: folded ? node.data.block.width : (node.width ?? node.measured?.width ?? 0),
                    height: folded ? node.data.block.height : (node.height ?? node.measured?.height ?? 0)
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
                <ControlButton onClick={fitAll} aria-label="Tout afficher" title="Tout afficher">
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
            <ToolMenu
              at={tools.at}
              analysisLinks={view !== undefined && view.elements.length > 0 ? analysisLinks : null}
              agents={projectGenesisId !== null}
              onPick={(tool) => void pickTool(tool)}
              onClose={closeTools}
            />
          )}
          {agentMenu === null ? null : (
            <ContextMenu
              at={agentMenu.at}
              label={`Agent ${agentMenu.node.name}`}
              items={[
                { tool: 'visio', icon: '▶', label: 'Ouvrir la visio', hint: 'Lui parler en tête-à-tête' },
                {
                  tool: 'manage',
                  icon: '☰',
                  label: 'Gérer l’assemblage…',
                  hint: 'Qui attend qui, sa part, lancement, accord de fusion'
                },
                ...(agentMenu.node.visual === 'running' || agentMenu.node.visual === 'waiting'
                  ? []
                  : [
                      {
                        tool: 'dismiss',
                        icon: '✕',
                        label: 'Renvoyer l’agent',
                        hint: 'Il quitte ce nœud (son profil reste)'
                      } satisfies MenuItem<string>
                    ])
              ]}
              onPick={(choice) => {
                const { node, nodeId } = agentMenu
                setAgentMenu(null)
                if (choice === 'visio') {
                  useVisio.getState().open(nodeId)
                  return
                }
                if (choice === 'manage') {
                  useSidePanel.getState().openAgents({
                    nodeId: node.hostId,
                    genesisId: node.genesisId,
                    title: agentsTitle(node.hostTitle),
                    kindLabel: 'Agents',
                    agentId: node.agentId
                  })
                  return
                }
                const sketch = assemblyData.sketches.find((entry) => entry.nodeId === node.hostId)
                if (sketch === undefined) return
                if (useVisio.getState().key === nodeId) useVisio.getState().close()
                void assemblyActions.dismiss(sketch, node.agentId)
              }}
              onClose={closeAgentMenu}
            />
          )}
          {agentsMenu === null ? null : (
            <ContextMenu
              at={agentsMenu.at}
              label={`Agents de « ${agentsMenu.title} »`}
              items={[
                {
                  tool: 'tray',
                  icon: '◇',
                  label: 'Appeler un agent…',
                  hint: 'Choisir dans le tiroir : un clic le connecte à ce nœud'
                },
                {
                  tool: 'panel',
                  icon: '☰',
                  label: 'Gérer les agents…',
                  hint: 'Qui attend qui, lancement, accord de fusion'
                }
              ]}
              onPick={(choice) => {
                const menuHost = agentsMenu
                setAgentsMenu(null)
                if (choice === 'tray') {
                  setTray({ mode: 'connect', ...menuHost })
                  return
                }
                useSidePanel.getState().openAgents({
                  nodeId: menuHost.hostId,
                  genesisId: menuHost.genesisId,
                  title: agentsTitle(menuHost.title),
                  kindLabel: 'Agents'
                })
              }}
              onClose={closeAgentsMenu}
            />
          )}
          <StrayTeams
            teams={strays}
            targets={strayTargets}
            profiles={assemblyData.profiles}
            onRelink={(team, to) => assemblyActions.relink(team.nodeId, to)}
          />
          {tray === null ? null : (
            <AgentTray
              at={tray.at}
              mode={tray.mode}
              {...(tray.mode === 'connect' ? { title: tray.title } : {})}
              profiles={assemblyData.profiles}
              onPick={(profile) => {
                setTray(null)
                if (tray.mode === 'connect') void joinHost(profile, tray.hostId, tray.genesisId)
                else void bench.place(profile.id, tray.position.x, tray.position.y)
              }}
              onClose={closeTray}
            />
          )}
          {benchMenu === null ? null : (
            <ContextMenu
              at={benchMenu.at}
              label={`Agent libre ${benchMenu.name}`}
              items={[{ tool: 'remove', icon: '✕', label: 'Retirer de la carte', hint: 'Son profil reste' }]}
              onPick={() => {
                const { benchId } = benchMenu
                setBenchMenu(null)
                void bench.remove(benchId)
              }}
              onClose={closeBenchMenu}
            />
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
        {panel === null ? null : panelFolded ? (
          <button
            type="button"
            onClick={() => foldPanel(false)}
            className="absolute top-3 right-3 z-20 h-8 rounded-md border border-content-muted/40 bg-surface px-3 text-xs font-medium shadow-sm hover:bg-surface-raised"
          >
            ▴ Rouvrir {panel.shown === 'architecture' ? 'l’Architecture' : 'la Progression'}
          </button>
        ) : panel.shown === 'architecture' ? (
          <ArchitectureView key={panel.genesisId} genesisId={panel.genesisId} />
        ) : (
          <ProgressionView key={panel.genesisId} genesisId={panel.genesisId} name={panel.title} />
        )}
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
