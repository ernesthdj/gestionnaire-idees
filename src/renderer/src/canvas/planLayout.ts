import type { ProposalView, StepView } from '@shared/ipc/canvas'
import type { DocumentView } from '@shared/ipc/documents'
import type { DeliverableView } from '@shared/ipc/finals'
import { rankLabel } from '@shared/plan/rankLabel'
import { layoutUnder, type AlternateOptions, type Point, type Size } from './layout/alternateLayout'
import { subNodeSize } from './living/nodeVisual'

/**
 * Disposition d'un plan d'attaque en sens alterné (spec 022 D11, R4 ; reprend spec 011 R4 / D7 et spec 012 D4) : les
 * étapes descendent en colonne sous le genesis, leurs sous-étapes partent en ligne à droite, les suivantes repartent en
 * colonne, etc. ; chaque branche pousse ses voisines. Sous un nœud, après ses étapes : la barre et les fantômes d'une
 * couche proposée, puis ses annexes (livrable, documents). Si le genesis porte aussi une carte de structure (qui occupe
 * le dessous), le plan part à sa droite. Un décalage glissé par mentalyas déplace l'étape et toute sa branche ; celui
 * d'une annexe la déplace seule. Un nœud replié (D14) cache ses descendants, posés à sa place (pour y glisser).
 * Fonction pure et déterministe.
 */

/** Case d'un nœud de plan (cercle + titre dessous, avec de l'air) : étape (niveau 1), sous-niveau, barre. */
export const PLAN_CELLS = {
  step: { width: 190, height: 128 },
  sub: { width: 160, height: 116 },
  bar: { width: 240, height: 64 }
} as const
/** Taille affichée de la barre d'une couche proposée. */
export const PLAN_BAR_SIZE = { width: 240, height: 40 } as const
const ACROSS = 24
const DOWN = 8
/** Air en plus entre deux étapes de niveau 1. */
const STEP_EXTRA = 16
/** Écart entre le bord de l'orbe du genesis et la première étape (place de son titre). */
const BELOW_GAP = 72
/** Plan à droite du genesis (carte de structure dessous) : distance horizontale à la colonne des étapes. */
const RIGHT_GAP = 220

/** Diamètre du cercle d'une étape, d'un fantôme, d'un document ou d'un livrable selon sa profondeur. */
export const planSize = (depth: number): Size => {
  const size = subNodeSize(depth)
  return { width: size, height: size }
}

interface PlacedBase {
  readonly x: number
  readonly y: number
  /** Profondeur sous le genesis (1 : enfant direct). */
  readonly depth: number
  /** Parent dans l'arbre du plan (genesis ou étape). */
  readonly parentId: string
  /** Caché par le repli d'un ancêtre : posé à la place de celui-ci. */
  readonly folded: boolean
}

export type PlacedPlanItem =
  | (PlacedBase & { readonly kind: 'step'; readonly step: StepView; readonly label: string })
  | (PlacedBase & {
      readonly kind: 'ghost'
      readonly ghost: ProposalView['items'][number]
      readonly proposalId: string
      readonly label: string
    })
  | (PlacedBase & { readonly kind: 'document'; readonly document: DocumentView })
  | (PlacedBase & { readonly kind: 'deliverable'; readonly deliverable: DeliverableView })
  | (PlacedBase & { readonly kind: 'bar'; readonly proposal: ProposalView })

export interface PlanEdge {
  readonly id: string
  readonly source: string
  readonly target: string
  /** Trait vers un fantôme (pointillé). */
  readonly ghost: boolean
  /** Trait vers une annexe (document, livrable). */
  readonly annex: boolean
}

export interface PlanLayout {
  readonly items: readonly PlacedPlanItem[]
  readonly edges: readonly PlanEdge[]
}

/** Identifiants des nœuds de carte d'un fantôme, de la barre de sa proposition et d'un document. */
export const ghostNodeId = (itemId: string): string => `ghost-${itemId}`
export const barNodeId = (proposalId: string): string => `plan-bar-${proposalId}`
export const documentNodeId = (documentId: string): string => `document-${documentId}`
/** Livrable d'une action finale (spec 013) : un par action. */
export const deliverableNodeId = (neuronId: string): string => `deliverable-${neuronId}`

type Entry =
  | { readonly kind: 'step'; readonly id: string; readonly step: StepView }
  | {
      readonly kind: 'ghost'
      readonly id: string
      readonly ghost: ProposalView['items'][number]
      readonly proposal: ProposalView
    }
  | { readonly kind: 'bar'; readonly id: string; readonly proposal: ProposalView }
  | { readonly kind: 'document'; readonly id: string; readonly document: DocumentView }
  | { readonly kind: 'deliverable'; readonly id: string; readonly deliverable: DeliverableView }

const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y })

export function planLayout(input: {
  readonly genesisId: string
  readonly center: Point
  /** Étapes de ce genesis. */
  readonly steps: readonly StepView[]
  /** Propositions en attente dont le parent est ce genesis ou une de ses étapes. */
  readonly proposals: readonly ProposalView[]
  /** Documents rattachés à ce genesis ou à ses étapes (spec 012). */
  readonly documents?: readonly DocumentView[]
  /** Livrables des actions finales de ce plan (spec 013). */
  readonly deliverables?: readonly DeliverableView[]
  /** Rayon de l'orbe du genesis (place de son titre sous lui). */
  readonly rootRadius?: number
  /** Le genesis porte une carte de structure : le plan part à sa droite. */
  readonly beside?: boolean
  /** Tout le plan est replié dans le genesis. */
  readonly rootCollapsed?: boolean
  /** « Réorganiser » (D22) : le premier niveau part en ligne. */
  readonly transposed?: boolean
}): PlanLayout {
  const kids = new Map<string, Entry[]>()
  const push = (parentId: string, entry: Entry): void => {
    kids.set(parentId, [...(kids.get(parentId) ?? []), entry])
  }
  for (const step of [...input.steps].sort((a, b) => a.rank - b.rank))
    push(step.parentId, { kind: 'step', id: step.id, step })
  for (const proposal of input.proposals) {
    push(proposal.parentId, { kind: 'bar', id: barNodeId(proposal.id), proposal })
    for (const ghost of [...proposal.items].sort((a, b) => a.rank - b.rank))
      push(proposal.parentId, { kind: 'ghost', id: ghostNodeId(ghost.id), ghost, proposal })
  }
  for (const deliverable of input.deliverables ?? [])
    push(deliverable.neuronId, { kind: 'deliverable', id: deliverableNodeId(deliverable.neuronId), deliverable })
  for (const document of input.documents ?? [])
    push(document.neuronId, { kind: 'document', id: documentNodeId(document.id), document })

  const entries = new Map<string, Entry>()
  const parentOf = new Map<string, string>()
  for (const [parentId, list] of kids)
    for (const entry of list) {
      entries.set(entry.id, entry)
      parentOf.set(entry.id, parentId)
    }
  const collapsed = (id: string): boolean => {
    if (id === input.genesisId) return input.rootCollapsed === true
    const entry = entries.get(id)
    return entry?.kind === 'step' && entry.step.collapsed === true
  }
  const visibleKids = (id: string): readonly string[] =>
    collapsed(id) ? [] : (kids.get(id) ?? []).map((entry) => entry.id)

  // Places de base (sans décalage glissé) des nœuds visibles.
  const base = new Map<string, { readonly center: Point; readonly depth: number }>()
  const options: AlternateOptions = {
    childrenOf: visibleKids,
    sizeOf: (id) => {
      const entry = entries.get(id)
      if (entry?.kind === 'bar') return PLAN_CELLS.bar
      return parentOf.get(id) === input.genesisId ? PLAN_CELLS.step : PLAN_CELLS.sub
    },
    across: ACROSS,
    down: DOWN,
    transposed: input.transposed === true,
    visit: (id, depth, center) => base.set(id, { center, depth })
  }
  const radius = input.rootRadius ?? 52
  const anchor =
    input.beside === true
      ? { x: input.center.x + radius + RIGHT_GAP, y: input.center.y - PLAN_CELLS.step.height / 2 }
      : input.center
  layoutUnder(input.genesisId, anchor, input.beside === true ? 0 : radius + BELOW_GAP, STEP_EXTRA, options)

  // Décalage glissé d'une étape : il s'ajoute à celui de ses ancêtres (toute la branche suit).
  const shiftOf = (id: string): Point => {
    let shift: Point = { x: 0, y: 0 }
    for (let current: string | undefined = id; current !== undefined; current = parentOf.get(current)) {
      const entry = entries.get(current)
      if (entry?.kind === 'step') shift = add(shift, entry.step.offset)
    }
    return shift
  }
  const ownOffset = (entry: Entry): Point =>
    entry.kind === 'document'
      ? entry.document.offset
      : entry.kind === 'deliverable'
        ? entry.deliverable.offset
        : { x: 0, y: 0 }
  const finalOf = (id: string): Point | null => {
    const placed = base.get(id)
    const entry = entries.get(id)
    if (placed === undefined || entry === undefined) return null
    return add(add(placed.center, shiftOf(id)), ownOffset(entry))
  }
  // Nœud affiché pour un nœud caché : l'ancêtre visible le plus proche (le genesis si tout est replié).
  const shownAncestor = (id: string): string => {
    let current = parentOf.get(id)
    while (current !== undefined && !base.has(current)) current = parentOf.get(current)
    return current ?? input.genesisId
  }
  const depthOf = (id: string): number => {
    let depth = 0
    for (let current: string | undefined = id; current !== undefined && current !== input.genesisId;) {
      depth++
      current = parentOf.get(current)
    }
    return depth
  }
  // Rang affiché (①, ①.②…) : chemin des rangs d'étapes ; un fantôme naît après les étapes existantes.
  const pathOf = (id: string): number[] => {
    const entry = entries.get(id)
    const parent = parentOf.get(id)
    const above = parent === undefined || parent === input.genesisId ? [] : pathOf(parent)
    if (entry?.kind === 'step') return [...above, entry.step.rank]
    if (entry?.kind === 'ghost') {
      const existing = (kids.get(parent ?? '') ?? []).filter((sibling) => sibling.kind === 'step').length
      return [...above, existing + entry.ghost.rank]
    }
    return above
  }

  const items: PlacedPlanItem[] = []
  const edges: PlanEdge[] = []
  // Parcours dans l'ordre de l'arbre (parents avant enfants), visibles et cachés.
  const walk = (parentId: string): void => {
    for (const entry of kids.get(parentId) ?? []) {
      const visible = base.has(entry.id)
      const at =
        finalOf(entry.id) ??
        (() => {
          const shown = shownAncestor(entry.id)
          return shown === input.genesisId ? input.center : (finalOf(shown) ?? input.center)
        })()
      const common = { x: at.x, y: at.y, depth: depthOf(entry.id), parentId, folded: !visible }
      if (entry.kind === 'step')
        items.push({ ...common, kind: 'step', step: entry.step, label: rankLabel(pathOf(entry.id)) })
      else if (entry.kind === 'ghost')
        items.push({
          ...common,
          kind: 'ghost',
          ghost: entry.ghost,
          proposalId: entry.proposal.id,
          label: rankLabel(pathOf(entry.id))
        })
      else if (entry.kind === 'bar') items.push({ ...common, kind: 'bar', proposal: entry.proposal })
      else if (entry.kind === 'document') items.push({ ...common, kind: 'document', document: entry.document })
      else items.push({ ...common, kind: 'deliverable', deliverable: entry.deliverable })
      if (visible && entry.kind !== 'bar')
        edges.push({
          id: `plan-line-${entry.id}`,
          source: parentId,
          target: entry.id,
          ghost: entry.kind === 'ghost',
          annex: entry.kind === 'document' || entry.kind === 'deliverable'
        })
      walk(entry.id)
    }
  }
  walk(input.genesisId)
  return { items, edges }
}
