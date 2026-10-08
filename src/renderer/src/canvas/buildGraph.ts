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
import { contentLabel } from './elementContent'
import { progressOf, type ElementProgress } from './progress'
import { architectureGraph, structureGraph, type LayerBand, type StructureEdge } from './structureGraph'
import type { StructureArchitectureView } from '@shared/ipc/canvas'
import { layerOf, type ArchitectureKind } from '@shared/structure/architecture'
import { deliverableNodeId, documentNodeId, PLAN_BAR_SIZE, planLayout, type PlacedPlanItem } from './planLayout'
import { nodeVisuals, type NodeIconKey, type NodeVisual, type TreeNodeInput } from './living/nodeVisual'
import type { DocumentView } from '@shared/ipc/documents'
import { ELEMENT_ICONS, ELEMENT_NODE_STATUS, STATUS_LABELS } from './nodes/ElementNode'
import { finalStateLabel, STEP_NODE_STATUS, STEP_STATUS_LABELS } from './nodes/PlanNode'
import { areaFor, forceLayout, type LayoutNode, type Point, type Rect } from './forceLayout'

/**
 * Taille d'une idée selon son niveau de contexte (FR-029) : plus elle est complète, plus elle est grande.
 * Cinq paliers nets, multiples de 8 : brute (jamais travaillée), insuffisant, suffisant, complet, éclose. Spec 022 :
 * l'orbe d'une idée de départ reste nettement plus gros que tout sous-nœud (58 px au plus), même brut.
 */
export type Tier = 'raw' | 'insufficient' | 'sufficient' | 'complete' | 'hatched'
export const TIER_SIZE: Readonly<Record<Tier, number>> = {
  raw: 72,
  insufficient: 80,
  sufficient: 96,
  complete: 104,
  hatched: 120
}
/** Aspect selon l'état : pointillés (brute), plein (en développement), double anneau + halo (éclose). */
type CanvasState = 'raw' | 'developing' | 'hatched'

/** Repli des sous-nœuds d'un nœud (spec 022 D14) : replié ou non, et combien il en cache ou montre. */
export interface NodeFold {
  readonly collapsed: boolean
  readonly count: number
}

export type NeuronNodeData = {
  readonly neuron: CanvasNeuronView
  /** Un filtre est actif et cette idée n'y correspond pas : estompée, toujours présente. */
  readonly dimmed: boolean
  /** Aspect vivant (spec 022) : une idée de départ est la racine de son plan (orbe). */
  readonly visual: NodeVisual
  /** Sa carte de détails est ouverte. */
  readonly open: boolean
  /** Repli de tout son plan ; `null` sans plan. */
  readonly fold: NodeFold | null
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
export type ElementNodeType = Node<
  {
    readonly element: ElementView
    readonly number: string
    /** Architecture de sa carte (D20) : couches proposées par la puce ; `null` : aucune. */
    readonly architecture?: ArchitectureKind | null
    /** Avancement affiché (D21) : déclaré, ou moyenne des sous-éléments ; absent sans information. */
    readonly progress?: ElementProgress | null
    /** Aspect vivant (spec 022 US3) et carte de détails ouverte. */
    readonly visual: NodeVisual
    readonly open: boolean
  },
  'element'
>
/** Bande d'une couche dans la vue Architecture (spec 017 D20). */
export type LayerBandNodeType = Node<{ readonly band: LayerBand }, 'layerBand'>
/** Barre d'une carte de structure (D20) : bascule Progression / Architecture et architecture de la carte. */
export type StructureBarNodeType = Node<
  {
    readonly genesisId: string
    readonly view: 'progression' | 'architecture'
    readonly architecture: StructureArchitectureView | null
  },
  'structureBar'
>

/** Étape d'un plan d'attaque ou fantôme proposé par Claude (spec 011), teinté par la catégorie de son genesis. */
export type PlanNodeType = Node<
  {
    readonly item: Extract<PlacedPlanItem, { kind: 'step' | 'ghost' }>
    readonly color: string
    readonly dimmed: boolean
    readonly visual: NodeVisual
    readonly open: boolean
    /** Repli de ses sous-étapes ; `null` sans sous-nœud. */
    readonly fold: NodeFold | null
  },
  'plan'
>
/** Barre « Tout valider / Tout refuser » d'une couche proposée. */
export type PlanBarNodeType = Node<{ readonly proposal: ProposalView }, 'planBar'>
/** Document Markdown rattaché à un neurone (spec 012), dans la colonne de ses enfants. */
export type DocumentNodeType = Node<
  {
    readonly document: DocumentView
    readonly dimmed: boolean
    readonly visual: NodeVisual
    readonly open: boolean
    /** Parent dans le plan (genesis ou étape). */
    readonly parentId?: string
  },
  'document'
>
/** Livrable d'une action finale (spec 013), annexe sous son action. */
export type DeliverableNodeType = Node<
  {
    readonly deliverable: DeliverableView
    readonly title: string
    readonly dimmed: boolean
    readonly visual: NodeVisual
    readonly open: boolean
    /** Parent dans le plan (l'action finale). */
    readonly parentId?: string
  },
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
  | LayerBandNodeType
  | StructureBarNodeType

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

/** Couche d'un élément dans son libellé accessible (D20) ; vide sans architecture ou sans couche. */
function layerPhrase(kind: ArchitectureKind | null, layer: string | null): string {
  const found = kind === null ? null : layerOf(kind, layer)
  return found === null ? '' : `, couche ${found.label}`
}

/**
 * Barre d'une carte de structure (D20) : centrée au-dessus du genesis (positions = centres), assez haut pour ne
 * recouvrir ni le plus gros genesis (104 px) ni sa pastille ; dessous descendent les modules, à droite part le plan.
 */
export const STRUCTURE_BAR_OFFSET = { x: 0, y: -(TIER_SIZE.hatched / 2 + 56) } as const

/** Aspect d'une idée de départ : racine de son plan (orbe). */
const ROOT_VISUAL: NodeVisual = { depth: 0, branch: null, size: 0, icon: 'idea', orb: true }
const FALLBACK_VISUAL: NodeVisual = { depth: 1, branch: null, size: 44, icon: 'step', orb: false }
/** Nœud caché par le repli d'un ancêtre (D14) : invisible, inerte, hors de l'arbre d'accessibilité. */
const HIDDEN_NODE = {
  className: 'living-gone',
  draggable: false,
  selectable: false,
  focusable: false,
  domAttributes: { 'aria-hidden': true }
} as const

/** Genesis qui portent une carte de structure. */
const withMapIds = (view: IdeasCanvasView): Set<string> => new Set(view.elements.map((element) => element.genesisId))

/** Identifiant du nœud React Flow d'un élément de plan (hors barre). */
export function planItemId(item: Exclude<PlacedPlanItem, { kind: 'bar' }>): string {
  if (item.kind === 'step') return item.step.id
  if (item.kind === 'ghost') return `ghost-${item.ghost.id}`
  if (item.kind === 'document') return documentNodeId(item.document.id)
  return deliverableNodeId(item.deliverable.neuronId)
}

function planIcon(item: Exclude<PlacedPlanItem, { kind: 'bar' }>): NodeIconKey {
  if (item.kind === 'document') return 'document'
  if (item.kind === 'deliverable') return 'deliverable'
  if (item.kind === 'step' && item.step.final !== undefined) return 'final'
  return 'step'
}

/** Arbre d'un plan (genesis → étapes → sous-étapes, fantômes, annexes) pour l'aspect vivant. */
function planTree(genesisId: string, items: readonly PlacedPlanItem[]): TreeNodeInput[] {
  return [
    { id: genesisId, parentId: null, icon: 'idea' },
    ...items.flatMap((item): TreeNodeInput[] =>
      item.kind === 'bar'
        ? []
        : [
            {
              id: planItemId(item),
              parentId: item.parentId,
              icon: planIcon(item),
              ...(item.kind === 'step' ? { status: STEP_NODE_STATUS[item.step.status] } : {})
            }
          ]
    )
  ]
}

/** Vue de l'écran Idées → nœuds (idées, blocs) et arêtes (liens) React Flow. Positions = centres (nodeOrigin 0.5). */
export function buildGraph(
  view: IdeasCanvasView,
  layout: CanvasLayout,
  /** Idée qui vient de naître (double-clic, capture) : elle pousse (250 ms). */
  bornId: string | null = null,
  /** Nœuds dont la carte de détails est ouverte (spec 022 D15) : ils grossissent et s'éclairent. */
  openIds: ReadonlySet<string> = new Set(),
  /** Cartes de structure basculées en vue Architecture (spec 017 D20). */
  structureViews: Readonly<Record<string, 'progression' | 'architecture'>> = {},
  /** « Réorganiser » (spec 022 D22) : les plans partent en ligne au premier niveau. */
  transposed = false,
  /**
   * Liens d'analyse des cartes de structure (appels mesurés, relations) au repos (spec 022 D29) ; sans eux, restent la
   * hiérarchie, les alertes « sens interdit » et les liens de l'élément en focus (ajoutés par la carte).
   */
  analysisLinks = true
): {
  nodes: CanvasNode[]
  edges: BranchEdgeType[]
  mapEdges: (MapLinkEdgeType | BranchEdgeType)[]
} {
  const highlighted = view.highlighted === null ? null : new Set(view.highlighted)
  const isDimmed = (id: string): boolean => highlighted !== null && !highlighted.has(id)
  // Plans d'attaque (spec 011, spec 022 R4) : disposés d'abord, pour connaître le repli de chaque genesis.
  const elementGenesis = new Set(view.elements.map((element) => element.genesisId))
  const plans = new Map(
    view.ideas.flatMap((genesis) => {
      const center = layout.positions.get(genesis.id)
      const steps = view.steps.filter((step) => step.genesisId === genesis.id)
      const ids = new Set([genesis.id, ...steps.map((step) => step.id)])
      const proposals = view.proposals.filter((proposal) => ids.has(proposal.parentId))
      const documents = view.documents.filter((document) => ids.has(document.neuronId))
      const deliverables = view.deliverables.filter((deliverable) => ids.has(deliverable.neuronId))
      if (center === undefined || (steps.length === 0 && proposals.length === 0 && documents.length === 0)) return []
      const plan = planLayout({
        genesisId: genesis.id,
        center,
        steps,
        proposals,
        documents,
        deliverables,
        rootRadius: TIER_SIZE[tierOf(genesis)] / 2,
        // Avec une carte de structure, le plan prend le côté qu'elle laisse libre : à droite quand elle descend, dessous
        // quand « Réorganiser » la fait partir à droite ; il n'est alors pas transposé lui-même.
        beside: elementGenesis.has(genesis.id) && !transposed,
        rootCollapsed: genesis.planCollapsed === true,
        transposed: transposed && !elementGenesis.has(genesis.id)
      })
      return [[genesis.id, { genesis, steps, plan }] as const]
    })
  )
  const neuronNodes = view.ideas.map((neuron): NeuronNodeType => {
    const items = plans.get(neuron.id)?.plan.items.filter((item) => item.kind !== 'bar').length ?? 0
    return {
      id: neuron.id,
      type: 'neuron',
      position: layout.positions.get(neuron.id) ?? { x: 0, y: 0 },
      width: TIER_SIZE[tierOf(neuron)],
      height: TIER_SIZE[tierOf(neuron)],
      data: {
        neuron,
        dimmed: isDimmed(neuron.id),
        visual: ROOT_VISUAL,
        open: openIds.has(neuron.id),
        fold: items === 0 ? null : { collapsed: neuron.planCollapsed === true, count: items }
      },
      ...(neuron.id === bornId ? { className: 'neuron-born' } : {}),
      ariaLabel: neuronAriaLabel(neuron),
      deletable: false
    }
  })
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
  // Plans d'attaque en nœuds vivants (spec 022) : couleur de branche, taille par niveau ; un nœud caché par un repli
  // reste posé à la place de son ancêtre, invisible et inerte (il y glisse, puis en ressort en glissant).
  const planNodes: CanvasNode[] = []
  const planEdges: BranchEdgeType[] = []
  for (const { genesis, steps, plan } of plans.values()) {
    const color = genesis.category?.color ?? '#71717a'
    const dimmed = isDimmed(genesis.id)
    const visuals = nodeVisuals(planTree(genesis.id, plan.items))
    const below = new Map<string, number>()
    for (const item of plan.items) {
      if (item.kind === 'bar') continue
      // Descendants de chaque nœud (pour la pastille ▸ N).
      for (let parent: string | undefined = item.parentId; parent !== undefined && parent !== genesis.id;) {
        below.set(parent, (below.get(parent) ?? 0) + 1)
        parent = plan.items.find((other) => other.kind === 'step' && other.step.id === parent)?.parentId
      }
    }
    for (const placed of plan.items) {
      if (placed.kind === 'bar') {
        planNodes.push({
          id: `plan-bar-${placed.proposal.id}`,
          type: 'planBar',
          width: PLAN_BAR_SIZE.width,
          height: PLAN_BAR_SIZE.height,
          position: { x: placed.x, y: placed.y },
          data: { proposal: placed.proposal },
          draggable: false,
          selectable: false,
          ariaLabel: `Couche proposée par Claude pour « ${genesis.title} »`,
          deletable: false,
          ...(placed.folded ? HIDDEN_NODE : {})
        })
        continue
      }
      const id = planItemId(placed)
      const visual = visuals.get(id) ?? FALLBACK_VISUAL
      const size = visual.size
      if (placed.kind === 'deliverable') {
        const title = steps.find((step) => step.id === placed.deliverable.neuronId)?.title ?? ''
        planNodes.push({
          id,
          type: 'deliverable',
          width: size,
          height: size,
          position: { x: placed.x, y: placed.y },
          data: {
            deliverable: placed.deliverable,
            title,
            dimmed,
            visual,
            open: openIds.has(id),
            parentId: placed.parentId
          },
          draggable: true,
          ariaLabel: `Livrable de « ${title} » : ${placed.deliverable.files.length} fichier${placed.deliverable.files.length > 1 ? 's' : ''}${placed.deliverable.executing ? ', exécution en cours' : ''}`,
          deletable: false,
          ...(placed.folded ? HIDDEN_NODE : {})
        })
        continue
      }
      if (placed.kind === 'document') {
        planNodes.push({
          id,
          type: 'document',
          width: size,
          height: size,
          position: { x: placed.x, y: placed.y },
          data: { document: placed.document, dimmed, visual, open: openIds.has(id), parentId: placed.parentId },
          // Glissable : sa place devient un décalage par rapport à sa place d'annexe (spec 012 D4).
          draggable: true,
          ariaLabel: `Document « ${placed.document.title} » (${placed.document.fileLabel})${placed.document.origin === 'claude' ? ', par Claude' : ''}`,
          deletable: false,
          ...(placed.folded ? HIDDEN_NODE : {})
        })
        continue
      }
      const count = placed.kind === 'step' ? (below.get(placed.step.id) ?? 0) : 0
      planNodes.push({
        id,
        type: 'plan',
        width: size,
        height: size,
        position: { x: placed.x, y: placed.y },
        data: {
          item: placed,
          color,
          dimmed,
          visual,
          open: openIds.has(id),
          fold: placed.kind === 'step' && count > 0 ? { collapsed: placed.step.collapsed === true, count } : null
        },
        // Une étape se glisse et entraîne sa branche (spec 011 D7) ; un fantôme reste à sa place proposée.
        draggable: placed.kind === 'step',
        ariaLabel:
          placed.kind === 'step'
            ? `Étape ${placed.label} de « ${genesis.title} » : ${placed.step.title}, ${STEP_STATUS_LABELS[placed.step.status]}${placed.step.locked ? ', verrouillée' : ''}${placed.step.final === undefined ? '' : `, ${finalStateLabel(placed.step.final.state, placed.step.status).toLowerCase()}`}${count > 0 ? `, ${count} sous-nœud${count > 1 ? 's' : ''} ${placed.step.collapsed === true ? 'repliés' : 'dépliés'}` : ''}`
            : `Étape proposée ${placed.label} : ${placed.ghost.title}`,
        deletable: false,
        ...(placed.folded ? HIDDEN_NODE : {})
      })
    }
    for (const edge of plan.edges) {
      planEdges.push({
        id: edge.id,
        type: 'branch',
        source: edge.source,
        target: edge.target,
        data: { style: edge.ghost ? 'dashed' : 'solid', branch: visuals.get(edge.target)?.branch ?? null },
        deletable: false,
        selectable: false,
        focusable: false
      })
    }
  }
  // Vue Architecture (D20) : seulement pour une carte basculée dont l'architecture est connue ; les autres gardent la
  // vue Progression, inchangée.
  const architectureOf = new Map((view.architectures ?? []).map((entry) => [entry.genesisId, entry] as const))
  const progress = progressOf(view.elements)
  const switched = [...genesisCenters.keys()].filter(
    (id) => structureViews[id] === 'architecture' && (architectureOf.get(id)?.kind ?? 'aucune') !== 'aucune'
  )
  const progressionGraph = structureGraph(
    view.elements.filter((element) => !switched.includes(element.genesisId)),
    genesisCenters,
    view.mapLinks,
    view.measuredLinks,
    transposed
  )
  const layered = switched.map((id) =>
    architectureGraph(
      view.elements,
      id,
      genesisCenters.get(id) ?? { x: 0, y: 0 },
      architectureOf.get(id)?.kind ?? 'aucune',
      view.mapLinks,
      view.measuredLinks
    )
  )
  const structure = {
    placed: [...progressionGraph.placed, ...layered.flatMap((graph) => graph.placed)],
    edges: [...progressionGraph.edges, ...layered.flatMap((graph) => graph.edges)]
  }
  const bandNodes = layered.flatMap((graph) =>
    graph.bands.map((band): LayerBandNodeType => ({
      id: band.id,
      type: 'layerBand',
      position: { x: band.x, y: band.y },
      data: { band },
      draggable: false,
      selectable: false,
      focusable: false,
      zIndex: -1,
      ariaLabel: `Couche ${band.label} : ${band.count} élément${band.count > 1 ? 's' : ''}`,
      deletable: false
    }))
  )
  const withMap = new Set(view.elements.map((element) => element.genesisId))
  const barNodes = [...genesisCenters].flatMap(([id, center]): StructureBarNodeType[] =>
    withMap.has(id)
      ? [
          {
            id: `structure-bar-${id}`,
            type: 'structureBar',
            position: { x: center.x + STRUCTURE_BAR_OFFSET.x, y: center.y + STRUCTURE_BAR_OFFSET.y },
            data: {
              genesisId: id,
              view: switched.includes(id) ? 'architecture' : 'progression',
              architecture: architectureOf.get(id) ?? null
            },
            draggable: false,
            selectable: false,
            deletable: false
          }
        ]
      : []
  )
  // Aspect vivant des éléments (spec 022 US3) : couleur de leur module (enfant direct du genesis), taille par niveau.
  const elementVisuals = nodeVisuals([
    ...[...withMapIds(view)].map((id): TreeNodeInput => ({ id, parentId: null, icon: 'project' })),
    ...view.elements.map((element): TreeNodeInput => ({
      id: element.id,
      parentId: element.parentId,
      icon: ELEMENT_ICONS[element.type],
      ...(element.status === null ? {} : { status: ELEMENT_NODE_STATUS[element.status] })
    }))
  ])
  const elementNodes = structure.placed.map((entry): ElementNodeType => ({
    id: entry.element.id,
    type: 'element',
    position: { x: entry.x, y: entry.y },
    width: elementVisuals.get(entry.element.id)?.size ?? 44,
    height: elementVisuals.get(entry.element.id)?.size ?? 44,
    data: {
      element: entry.element,
      number: entry.number,
      architecture: architectureOf.get(entry.element.genesisId)?.kind ?? null,
      progress: progress.get(entry.element.id) ?? null,
      visual: elementVisuals.get(entry.element.id) ?? FALLBACK_VISUAL,
      open: openIds.has(entry.element.id)
    },
    draggable: false,
    ariaLabel: `${entry.number === '' ? '' : `Étape ${entry.number} : `}${entry.element.type} « ${entry.element.title} »${entry.element.status === null ? '' : `, ${STATUS_LABELS[entry.element.status]}`}${contentLabel(entry.element.content) === '' ? '' : `, ${contentLabel(entry.element.content)}`}${layerPhrase(architectureOf.get(entry.element.genesisId)?.kind ?? null, entry.element.layer ?? null)}${progress.has(entry.element.id) ? `, avancement ${progress.get(entry.element.id)?.percent ?? 0} %` : ''}${entry.element.childCount > 0 ? `, ${entry.element.childCount} éléments ${entry.element.collapsed ? 'repliés' : 'dépliés'}` : ''}`,
    deletable: false
  }))
  const structureEdges = structure.edges
    .filter((edge) => analysisLinks || edge.kind === 'hierarchy' || edge.violation === true)
    .map(structureFlowEdge)
  return {
    nodes: [...neuronNodes, ...blockNodes, ...bandNodes, ...elementNodes, ...barNodes, ...planNodes],
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
  // Vue Architecture (D20) : une dépendance qui sort du cœur est signalée, jamais par la couleur seule.
  const violation = edge.violation === true ? { violation: true as const } : {}
  const warn = edge.violation === true ? '⚠ sens interdit · ' : ''
  if (edge.kind === 'measured') {
    const plural = edge.count > 1 ? 's' : ''
    return {
      ...common,
      type: 'mapLink',
      data: {
        // Étiquette courte (spec 022 US3) : elles se chevauchaient ; la fiabilité se lit au style du trait.
        label: `${warn}${edge.count} appel${plural}`,
        measured: edge.provenance ?? 'uncertain',
        layer,
        ...violation
      }
    }
  }
  return {
    ...common,
    type: 'mapLink',
    data: {
      label: [
        edge.violation === true ? '⚠ sens interdit' : null,
        edge.relation === null ? null : RELATION_LABELS[edge.relation],
        edge.label,
        edge.count > 1 ? `×${edge.count}` : null
      ]
        .filter((part) => part !== null)
        .join(' · '),
      relation: edge.relation,
      layer,
      ...violation
    }
  }
}
