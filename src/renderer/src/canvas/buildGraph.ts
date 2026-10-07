import type { DeliverableView } from '@shared/ipc/finals'
import type { Node } from '@xyflow/react'
import type {
  BlockView,
  ElementRelation,
  ElementView,
  CanvasNeuronView,
  IdeasCanvasView,
  MapLinkView,
  ProposalView
} from '@shared/ipc/canvas'
import type { BranchEdgeType } from './edges/BranchEdge'
import type { MapLinkEdgeType } from './edges/MapLinkEdge'
import { structureGraph, type StructureEdge } from './structureGraph'
import { deliverableNodeId, documentNodeId, PLAN_SIZES, planLayout, planSize, type PlacedPlanItem } from './planLayout'
import type { DocumentView } from '@shared/ipc/documents'
import { finalStateLabel, STEP_STATUS_LABELS } from './nodes/PlanNode'
import { areaFor, forceLayout, type LayoutNode, type Point, type Rect } from './forceLayout'
import { PROVENANCE_LABELS } from '../explorer/labels'

/**
 * Taille d'une idée selon son niveau de contexte (FR-029) : plus elle est complète, plus elle est grande.
 * Cinq paliers nets, multiples de 8 : brute (jamais travaillée), insuffisant, suffisant, complet, éclose.
 */
export type Tier = 'raw' | 'insufficient' | 'sufficient' | 'complete' | 'hatched'
export const TIER_SIZE: Readonly<Record<Tier, number>> = {
  raw: 40,
  insufficient: 56,
  sufficient: 72,
  complete: 88,
  hatched: 104
}
/** Aspect selon l'état : pointillés (brute), plein (en développement), double anneau + halo (éclose). */
type CanvasState = 'raw' | 'developing' | 'hatched'

export type NeuronNodeData = {
  readonly neuron: CanvasNeuronView
  /** Un filtre est actif et cette idée n'y correspond pas : estompée, toujours présente. */
  readonly dimmed: boolean
}
export type NeuronNodeType = Node<NeuronNodeData, 'neuron'>

export type BlockNodeData = { readonly block: BlockView }
export type BlockNodeType = Node<BlockNodeData, 'block'>
/** Note posée sur la carte (spec 004). Type React Flow « label » : « note » désigne déjà le texte d'un sous-neurone. */
export type LabelNodeType = Node<BlockNodeData, 'label'>
export type WidgetNodeType = Node<BlockNodeData, 'widget'>
/** Cadre résultat d'un widget (spec 005). */
export type ResultNodeType = Node<BlockNodeData, 'result'>
/** Note titrée et cadre de regroupement (spec 007, pont MCP). « mapNote » : « note » désigne le texte d'un sous-neurone. */
export type MapNoteNodeType = Node<BlockNodeData, 'mapNote'>
export type FrameNodeType = Node<BlockNodeData, 'frame'>
/** Élément d'une carte de structure de projet (spec 009). */
/** Élément de carte de structure, avec son numéro de progression (D17). */
export type ElementNodeType = Node<{ readonly element: ElementView; readonly number: string }, 'element'>

/** Étape d'un plan d'attaque ou fantôme proposé par Claude (spec 011), teinté par la catégorie de son genesis. */
export type PlanNodeType = Node<
  {
    readonly item: Extract<PlacedPlanItem, { kind: 'step' | 'ghost' }>
    readonly color: string
    readonly dimmed: boolean
  },
  'plan'
>
/** Barre « Tout valider / Tout refuser » d'une couche proposée. */
export type PlanBarNodeType = Node<{ readonly proposal: ProposalView }, 'planBar'>
/** Document Markdown rattaché à un neurone (spec 012), dans la colonne de ses enfants. */
export type DocumentNodeType = Node<{ readonly document: DocumentView; readonly dimmed: boolean }, 'document'>
/** Livrable d'une action finale (spec 013), annexe sous son action. */
export type DeliverableNodeType = Node<
  { readonly deliverable: DeliverableView; readonly title: string; readonly dimmed: boolean },
  'deliverable'
>

export type CanvasNode =
  | NeuronNodeType
  | PlanNodeType
  | PlanBarNodeType
  | DocumentNodeType
  | DeliverableNodeType
  | BlockNodeType
  | LabelNodeType
  | WidgetNodeType
  | ResultNodeType
  | MapNoteNodeType
  | FrameNodeType
  | ElementNodeType

const BLOCK_NODE_TYPES = {
  empty: 'block',
  label: 'label',
  widget: 'widget',
  result: 'result',
  note: 'mapNote',
  frame: 'frame'
} as const

function blockAriaLabel(block: BlockView): string {
  if (block.kind === 'label') return block.text === '' || block.text === null ? 'Note vide' : `Note : ${block.text}`
  if (block.kind === 'result') return 'Résultat d’un widget'
  const byClaude = block.origin === 'claude' ? ', par Claude' : ''
  if (block.kind === 'note') return `Note « ${block.title ?? 'Note'} »${byClaude}`
  if (block.kind === 'frame') return `Cadre « ${block.title ?? 'Cadre'} »${byClaude}`
  return block.kind === 'widget' ? 'Widget IA' : 'Bloc vide'
}

/** Relations d'une carte de structure, en clair (L1e §3). */
const RELATION_LABELS: Readonly<Record<ElementRelation, string>> = {
  depend_de: 'dépend de',
  appelle: 'appelle',
  lit_ecrit: 'lit / écrit',
  implemente: 'implémente',
  teste: 'teste',
  bloque: 'bloque'
}

const STATE_LABELS: Record<CanvasState, string> = {
  raw: 'Idée brute',
  developing: 'En développement',
  hatched: 'Idée éclose'
}
const LEVEL_LABELS = { insufficient: 'insuffisant', sufficient: 'suffisant', complete: 'complet' } as const
const NATURE_LABELS = { action: 'Action', reflection: 'Réflexion' } as const

export function canvasState(neuron: CanvasNeuronView): CanvasState {
  return neuron.state === 'hatched' ? 'hatched' : neuron.state === 'developing' ? 'developing' : 'raw'
}

export function tierOf(neuron: CanvasNeuronView): Tier {
  if (neuron.state === 'hatched') return 'hatched'
  return neuron.contextLevel ?? 'raw'
}

/** Rayon occupé pour la disposition : le cercle. */
function layoutRadius(neuron: CanvasNeuronView): number {
  return TIER_SIZE[tierOf(neuron)] / 2
}

/** Liens libres entre deux idées (les autres relient des blocs ou des éléments). */
export function ideaLinks(view: IdeasCanvasView): MapLinkView[] {
  return view.mapLinks.filter((link) => link.from.kind === 'idea' && link.to.kind === 'idea')
}

/** Texte lu par les lecteurs d'écran (état, contexte, titre, nature, catégorie, origine IA). */
export function neuronAriaLabel(neuron: CanvasNeuronView): string {
  const level =
    neuron.state === 'hatched' || neuron.contextLevel === null ? '' : `, contexte ${LEVEL_LABELS[neuron.contextLevel]}`
  const parts = [`${STATE_LABELS[canvasState(neuron)]}${level} : ${neuron.title}`]
  parts.push(`${NATURE_LABELS[neuron.nature]}${neuron.natureSource === 'ai' ? ' (proposée par l’IA)' : ''}`)
  parts.push(
    neuron.category === null
      ? 'à classer'
      : `catégorie ${neuron.category.label}${neuron.categorySource === 'ai' ? ' (proposée par l’IA)' : ''}`
  )
  return parts.join(', ')
}

export function layoutInput(view: IdeasCanvasView): LayoutNode[] {
  return view.ideas.map((neuron) => ({ id: neuron.id, radius: layoutRadius(neuron), initial: neuron.position }))
}

export interface CanvasLayout {
  readonly area: Rect
  readonly positions: ReadonlyMap<string, Point>
}

/** Marge autour des idées posées à la main, pour qu'elles restent dans l'espace (et ne soient pas replacées). */
const AREA_MARGIN = 128

/** Espace de la carte : dimensionné selon le nombre d'idées, agrandi pour englober toutes les positions connues. */
function areaOf(view: IdeasCanvasView): Rect {
  const base = areaFor(view.ideas.length)
  const known = view.ideas.flatMap((neuron) => (neuron.position === null ? [] : [neuron.position]))
  if (known.length === 0) return base
  const left = Math.min(base.x, ...known.map((point) => point.x - AREA_MARGIN))
  const top = Math.min(base.y, ...known.map((point) => point.y - AREA_MARGIN))
  const right = Math.max(base.x + base.width, ...known.map((point) => point.x + AREA_MARGIN))
  const bottom = Math.max(base.y + base.height, ...known.map((point) => point.y + AREA_MARGIN))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

export function computeLayout(view: IdeasCanvasView): CanvasLayout {
  const area = areaOf(view)
  const links = ideaLinks(view).map((link) => ({ source: link.from.id, target: link.to.id }))
  return { area, positions: forceLayout(layoutInput(view), links, area) }
}

/** Idées dont la position calculée diffère de celle enregistrée (à mémoriser pour la prochaine ouverture). */
export function movedPositions(
  view: IdeasCanvasView,
  positions: ReadonlyMap<string, Point>
): { rootId: string; x: number; y: number }[] {
  return view.ideas.flatMap((neuron) => {
    const point = positions.get(neuron.id)
    if (point === undefined) return []
    const saved = neuron.position
    const moved = saved === null || Math.hypot(saved.x - point.x, saved.y - point.y) > 1
    return moved ? [{ rootId: neuron.id, x: point.x, y: point.y }] : []
  })
}

/** Vue de l'écran Idées → nœuds (idées, blocs) et arêtes (liens) React Flow. Positions = centres (nodeOrigin 0.5). */
export function buildGraph(
  view: IdeasCanvasView,
  layout: CanvasLayout,
  /** Idée qui vient de naître (double-clic, capture) : elle pousse (250 ms). */
  bornId: string | null = null,
  /** Idée ouverte dans le volet : mise en avant, les autres estompées (elles restent cliquables). */
  openRootId: string | null = null
): {
  nodes: CanvasNode[]
  edges: BranchEdgeType[]
  mapEdges: (MapLinkEdgeType | BranchEdgeType)[]
} {
  const highlighted = view.highlighted === null ? null : new Set(view.highlighted)
  const isDimmed = (id: string): boolean =>
    (highlighted !== null && !highlighted.has(id)) || (openRootId !== null && id !== openRootId)
  const neuronNodes = view.ideas.map((neuron): NeuronNodeType => ({
    id: neuron.id,
    type: 'neuron',
    position: layout.positions.get(neuron.id) ?? { x: 0, y: 0 },
    data: { neuron, dimmed: isDimmed(neuron.id) },
    ...(neuron.id === bornId
      ? { className: 'neuron-born' }
      : neuron.id === openRootId
        ? { className: 'neuron-open' }
        : {}),
    ariaLabel: neuronAriaLabel(neuron),
    deletable: false
  }))
  const blockNodes = view.blocks.map((block): CanvasNode => ({
    id: block.id,
    type: BLOCK_NODE_TYPES[block.kind],
    // Un cadre se dessine sous ce qu'il regroupe.
    ...(block.kind === 'frame' ? { zIndex: -1 } : {}),
    position: { x: block.x, y: block.y },
    width: block.width,
    height: block.height,
    data: { block },
    ariaLabel: blockAriaLabel(block),
    deletable: false
  }))
  const ioEdges = view.io.map((link): BranchEdgeType => ({
    id: `io-${link.id}`,
    type: 'branch',
    source: link.sourceId,
    target: link.blockId,
    data: { style: 'io' },
    deletable: false,
    selectable: false,
    focusable: false
  }))
  // Un cadre résultat est relié au widget dont il affiche la sortie.
  const resultEdges = view.blocks.flatMap((block): BranchEdgeType[] =>
    block.sourceBlockId === null
      ? []
      : [
          {
            id: `result-line-${block.id}`,
            type: 'branch',
            source: block.sourceBlockId,
            target: block.id,
            data: { style: 'io' },
            deletable: false,
            selectable: false,
            focusable: false
          }
        ]
  )
  // Arbre de notes dessiné par Claude (spec 007) : trait plein du parent à l'enfant.
  const visibleBlocks = new Set(view.blocks.map((block) => block.id))
  const noteEdges = view.blocks.flatMap((block): BranchEdgeType[] =>
    block.parentBlockId === null || !visibleBlocks.has(block.parentBlockId)
      ? []
      : [
          {
            id: `note-line-${block.id}`,
            type: 'branch',
            source: block.parentBlockId,
            target: block.id,
            data: { style: 'solid' },
            deletable: false,
            selectable: false,
            focusable: false
          }
        ]
  )
  const visible = new Set([...visibleBlocks, ...view.ideas.map((neuron) => neuron.id)])
  const mapEdges = view.mapLinks
    .filter((link) => link.relation === null && visible.has(link.from.id) && visible.has(link.to.id))
    .map((link): MapLinkEdgeType => ({
      id: `map-${link.id}`,
      type: 'mapLink',
      source: link.from.id,
      target: link.to.id,
      data: { label: link.label },
      deletable: false,
      selectable: false,
      focusable: false
    }))
  // Cartes de structure des projets liés (spec 009) : éléments dépliés autour de leur genesis, liens typés regroupés.
  const genesisCenters = new Map(neuronNodes.map((node) => [node.id, node.position] as const))
  // Plans d'attaque (spec 011) : arbre gauche → droite à partir de chaque genesis.
  const planNodes: CanvasNode[] = []
  const planEdges: BranchEdgeType[] = []
  for (const genesis of view.ideas) {
    const steps = view.steps.filter((step) => step.genesisId === genesis.id)
    const ids = new Set([genesis.id, ...steps.map((step) => step.id)])
    const proposals = view.proposals.filter((proposal) => ids.has(proposal.parentId))
    const documents = view.documents.filter((document) => ids.has(document.neuronId))
    const deliverables = view.deliverables.filter((deliverable) => ids.has(deliverable.neuronId))
    const center = genesisCenters.get(genesis.id)
    if (center === undefined || (steps.length === 0 && proposals.length === 0 && documents.length === 0)) continue
    const color = genesis.category?.color ?? '#71717a'
    const dimmed = isDimmed(genesis.id)
    const plan = planLayout({ genesisId: genesis.id, center, steps, proposals, documents, deliverables })
    for (const placed of plan.items) {
      if (placed.kind === 'bar') {
        planNodes.push({
          id: `plan-bar-${placed.proposal.id}`,
          type: 'planBar',
          width: PLAN_SIZES.bar.width,
          height: PLAN_SIZES.bar.height,
          position: { x: placed.x, y: placed.y },
          data: { proposal: placed.proposal },
          draggable: false,
          selectable: false,
          ariaLabel: `Couche proposée par Claude pour « ${genesis.title} »`,
          deletable: false
        })
        continue
      }
      if (placed.kind === 'deliverable') {
        const title = steps.find((step) => step.id === placed.deliverable.neuronId)?.title ?? ''
        planNodes.push({
          id: deliverableNodeId(placed.deliverable.neuronId),
          type: 'deliverable',
          width: placed.deliverable.width,
          height: placed.deliverable.height,
          position: { x: placed.x, y: placed.y },
          data: { deliverable: placed.deliverable, title, dimmed },
          draggable: true,
          ariaLabel: `Livrable de « ${title} » : ${placed.deliverable.files.length} fichier${placed.deliverable.files.length > 1 ? 's' : ''}${placed.deliverable.executing ? ', exécution en cours' : ''}`,
          deletable: false
        })
        continue
      }
      if (placed.kind === 'document') {
        planNodes.push({
          id: documentNodeId(placed.document.id),
          type: 'document',
          width: placed.document.width,
          height: placed.document.height,
          position: { x: placed.x, y: placed.y },
          data: { document: placed.document, dimmed },
          // Glissable : sa place devient un décalage par rapport à sa place d'annexe (spec 012 D4).
          draggable: true,
          ariaLabel: `Document « ${placed.document.title} » (${placed.document.fileLabel})${placed.document.origin === 'claude' ? ', par Claude' : ''}`,
          deletable: false
        })
        continue
      }
      const id = placed.kind === 'step' ? placed.step.id : `ghost-${placed.ghost.id}`
      planNodes.push({
        id,
        type: 'plan',
        width: planSize(placed.kind === 'step' ? placed.step.depth : placed.depth).width,
        height: planSize(placed.kind === 'step' ? placed.step.depth : placed.depth).height,
        position: { x: placed.x, y: placed.y },
        data: { item: placed, color, dimmed },
        // Une étape se glisse et entraîne sa branche (spec 011 D7) ; un fantôme reste à sa place proposée.
        draggable: placed.kind === 'step',
        ariaLabel:
          placed.kind === 'step'
            ? `Étape ${placed.label} de « ${genesis.title} » : ${placed.step.title}, ${STEP_STATUS_LABELS[placed.step.status]}${placed.step.locked ? ', verrouillée' : ''}${placed.step.final === undefined ? '' : `, ${finalStateLabel(placed.step.final.state, placed.step.status).toLowerCase()}`}`
            : `Étape proposée ${placed.label} : ${placed.ghost.title}`,
        deletable: false
      })
    }
    for (const edge of plan.edges) {
      planEdges.push({
        id: edge.id,
        type: 'branch',
        source: edge.source,
        target: edge.target,
        data: { style: edge.ghost ? 'dashed' : 'solid' },
        deletable: false,
        selectable: false,
        focusable: false
      })
    }
  }
  const structure = structureGraph(view.elements, genesisCenters, view.mapLinks, view.measuredLinks)
  const elementNodes = structure.placed.map((entry): ElementNodeType => ({
    id: entry.element.id,
    type: 'element',
    position: { x: entry.x, y: entry.y },
    data: { element: entry.element, number: entry.number },
    draggable: false,
    ariaLabel: `${entry.number === '' ? '' : `Étape ${entry.number} : `}${entry.element.type} « ${entry.element.title} »${entry.element.childCount > 0 ? `, ${entry.element.childCount} éléments ${entry.element.collapsed ? 'repliés' : 'dépliés'}` : ''}`,
    deletable: false
  }))
  const structureEdges = structure.edges.map(structureFlowEdge)
  return {
    nodes: [...neuronNodes, ...blockNodes, ...elementNodes, ...planNodes],
    edges: [...ioEdges, ...resultEdges, ...noteEdges, ...planEdges],
    mapEdges: [...mapEdges, ...structureEdges]
  }
}

/** Lien d'une carte de structure à l'écran (spec 009, 017) : trait de hiérarchie, relation de Claude ou appels mesurés. */
export function structureFlowEdge(edge: StructureEdge): MapLinkEdgeType | BranchEdgeType {
  const common = {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    deletable: false,
    selectable: false,
    focusable: false
  }
  if (edge.kind === 'hierarchy') return { ...common, type: 'branch', data: { style: 'solid' } }
  const layer = edge.focused ? 'focus' : 'rest'
  if (edge.kind === 'measured') {
    const plural = edge.count > 1 ? 's' : ''
    return {
      ...common,
      type: 'mapLink',
      data: {
        label: `${edge.count} appel${plural} mesuré${plural} · ${PROVENANCE_LABELS[edge.provenance ?? 'uncertain'].text}`,
        measured: edge.provenance ?? 'uncertain',
        layer
      }
    }
  }
  return {
    ...common,
    type: 'mapLink',
    data: {
      label: [
        edge.relation === null ? null : RELATION_LABELS[edge.relation],
        edge.label,
        edge.count > 1 ? `×${edge.count}` : null
      ]
        .filter((part) => part !== null)
        .join(' · '),
      relation: edge.relation,
      layer
    }
  }
}
