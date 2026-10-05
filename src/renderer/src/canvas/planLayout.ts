import type { ProposalView, StepView } from '@shared/ipc/canvas'
import type { DocumentView } from '@shared/ipc/documents'
import { rankLabel } from '@shared/plan/rankLabel'

/**
 * Disposition d'un plan d'attaque (spec 011 R4, D7 ; spec 012 D4) : arbre de gauche à droite, une colonne par niveau,
 * enfants d'un même parent de haut en bas par rang, chaque parent centré sur ses enfants. Les documents d'un nœud sont
 * ses ANNEXES : empilés juste sous lui (sous le genesis pour les siens). Fonction pure et déterministe : la place de
 * base ne dépend que de l'arbre ; un décalage glissé par mentalyas déplace l'étape et toute sa branche.
 */

/** Tailles des cartes : étape (niveau 1) et sous-étape (niveau 2+). */
export const PLAN_SIZES = {
  step: { width: 240, height: 72 },
  subStep: { width: 200, height: 52 },
  bar: { width: 240, height: 40 }
} as const
const ROW_GAP = 16
/** Écart entre un nœud et son annexe (document) placée dessous. */
const ANNEX_GAP = 24
/** Écart entre le centre du genesis et le haut de ses annexes. */
const GENESIS_ANNEX_TOP = 72
/** Écart entre le bord droit du genesis et la première colonne, puis entre deux colonnes. */
const GENESIS_GAP = 120
const COLUMN_GAP = 60

export const planSize = (depth: number): { readonly width: number; readonly height: number } =>
  depth <= 1 ? PLAN_SIZES.step : PLAN_SIZES.subStep

type Point = { readonly x: number; readonly y: number }

export type PlacedPlanItem =
  | { readonly kind: 'step'; readonly step: StepView; readonly label: string; readonly x: number; readonly y: number }
  | {
      readonly kind: 'ghost'
      readonly ghost: ProposalView['items'][number]
      readonly proposalId: string
      readonly parentId: string
      readonly depth: number
      readonly label: string
      readonly x: number
      readonly y: number
    }
  | { readonly kind: 'document'; readonly document: DocumentView; readonly x: number; readonly y: number }
  | {
      readonly kind: 'bar'
      readonly proposal: ProposalView
      readonly depth: number
      readonly x: number
      readonly y: number
    }

export interface PlanEdge {
  readonly id: string
  readonly source: string
  readonly target: string
  /** Trait vers un fantôme (pointillé). */
  readonly ghost: boolean
  /** Trait vertical vers une annexe (du bas du nœud au haut du document). */
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

type Child =
  | { readonly kind: 'step'; readonly step: StepView }
  | { readonly kind: 'ghost'; readonly ghost: ProposalView['items'][number]; readonly proposal: ProposalView }
  | { readonly kind: 'bar'; readonly proposal: ProposalView }

const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y })

export function planLayout(input: {
  readonly genesisId: string
  readonly center: Point
  /** Étapes de ce genesis. */
  readonly steps: readonly StepView[]
  /** Propositions en attente dont le parent est ce genesis ou une de ses étapes. */
  readonly proposals: readonly ProposalView[]
  /** Documents rattachés à ce genesis ou à ses étapes (spec 012) : annexes sous leur neurone. */
  readonly documents?: readonly DocumentView[]
}): PlanLayout {
  const children = new Map<string, Child[]>()
  const push = (parentId: string, child: Child): void => {
    children.set(parentId, [...(children.get(parentId) ?? []), child])
  }
  for (const step of [...input.steps].sort((a, b) => a.rank - b.rank)) push(step.parentId, { kind: 'step', step })
  for (const proposal of input.proposals) {
    push(proposal.parentId, { kind: 'bar', proposal })
    for (const ghost of [...proposal.items].sort((a, b) => a.rank - b.rank))
      push(proposal.parentId, { kind: 'ghost', ghost, proposal })
  }
  const annexes = new Map<string, DocumentView[]>()
  for (const document of input.documents ?? []) {
    annexes.set(document.neuronId, [...(annexes.get(document.neuronId) ?? []), document])
  }
  const annexHeight = (neuronId: string): number =>
    (annexes.get(neuronId) ?? []).reduce((sum, document) => sum + ANNEX_GAP + document.height, 0)

  const idOf = (child: Child): string =>
    child.kind === 'step'
      ? child.step.id
      : child.kind === 'ghost'
        ? ghostNodeId(child.ghost.id)
        : barNodeId(child.proposal.id)
  const cardOf = (child: Child, depth: number): { readonly width: number; readonly height: number } =>
    child.kind === 'bar' ? PLAN_SIZES.bar : planSize(depth)
  // Bloc d'un nœud : sa carte et ses annexes empilées dessous ; sa largeur est celle du plus large.
  const blockOf = (child: Child, depth: number): { readonly width: number; readonly height: number } => {
    const card = cardOf(child, depth)
    if (child.kind !== 'step') return card
    const documents = annexes.get(child.step.id) ?? []
    return {
      width: Math.max(card.width, ...documents.map((document) => document.width)),
      height: card.height + annexHeight(child.step.id)
    }
  }
  // Hauteur d'un sous-arbre : celle de son bloc, ou celle de ses enfants empilés si elle est plus grande.
  const heights = new Map<string, number>()
  const heightOf = (child: Child, depth: number): number => {
    const id = idOf(child)
    const known = heights.get(id)
    if (known !== undefined) return known
    const kids = child.kind === 'step' ? (children.get(child.step.id) ?? []) : []
    const stacked =
      kids.reduce((sum, kid) => sum + heightOf(kid, depth + 1), 0) + Math.max(kids.length - 1, 0) * ROW_GAP
    const height = Math.max(blockOf(child, depth).height, stacked)
    heights.set(id, height)
    return height
  }

  // Première passe : ordre vertical et colonne de chaque élément ; une colonne a la largeur de son bloc le plus large.
  const pending: {
    readonly depth: number
    readonly width: number
    readonly build: (left: number) => PlacedPlanItem[]
  }[] = []
  const columnWidths: number[] = []
  const edges: PlanEdge[] = []
  const annexEdges = (neuronId: string): void => {
    for (const document of annexes.get(neuronId) ?? []) {
      const target = documentNodeId(document.id)
      edges.push({ id: `plan-line-${target}`, source: neuronId, target, ghost: false, annex: true })
    }
  }
  /**
   * Annexes empilées sous un nœud dont le bas est à `bottom`, calées sur un bord (gauche d'une colonne, ou droit sous le
   * genesis pour ne pas empiéter sur la colonne de ses étapes) ; elles suivent `shift` + leur propre décalage.
   */
  const placeAnnexes = (
    neuronId: string,
    edge: { readonly left: number } | { readonly right: number },
    bottom: number,
    shift: Point
  ): PlacedPlanItem[] => {
    let top = bottom
    return (annexes.get(neuronId) ?? []).map((document): PlacedPlanItem => {
      top += ANNEX_GAP
      const x = 'left' in edge ? edge.left + document.width / 2 : edge.right - document.width / 2
      const base = { x, y: top + document.height / 2 }
      top += document.height
      return { kind: 'document', document, ...add(add(base, shift), document.offset) }
    })
  }
  const place = (parentId: string, ranks: readonly number[], depth: number, centerY: number, shift: Point): void => {
    const kids = children.get(parentId) ?? []
    if (kids.length === 0) return
    const total = kids.reduce((sum, kid) => sum + heightOf(kid, depth), 0) + (kids.length - 1) * ROW_GAP
    const existing = kids.filter((kid) => kid.kind === 'step').length
    let top = centerY - total / 2
    for (const kid of kids) {
      const span = heightOf(kid, depth)
      const middle = top + span / 2
      top += span + ROW_GAP
      const card = cardOf(kid, depth)
      const block = blockOf(kid, depth)
      columnWidths[depth] = Math.max(columnWidths[depth] ?? 0, block.width)
      // La carte occupe le haut de son bloc, centré sur son sous-arbre.
      const cardY = middle - block.height / 2 + card.height / 2
      const at = (left: number): Point => ({ x: left + card.width / 2, y: cardY })
      if (kid.kind === 'bar') {
        pending.push({
          depth,
          width: card.width,
          build: (left) => [{ kind: 'bar', proposal: kid.proposal, depth, ...add(at(left), shift) }]
        })
        continue
      }
      if (kid.kind === 'ghost') {
        // Rang à la naissance : après les étapes existantes, dans l'ordre proposé.
        const label = rankLabel([...ranks, existing + kid.ghost.rank])
        pending.push({
          depth,
          width: card.width,
          build: (left) => [
            {
              kind: 'ghost',
              ghost: kid.ghost,
              proposalId: kid.proposal.id,
              parentId,
              depth,
              label,
              ...add(at(left), shift)
            }
          ]
        })
        edges.push({ id: `plan-line-${idOf(kid)}`, source: parentId, target: idOf(kid), ghost: true, annex: false })
        continue
      }
      const path = [...ranks, kid.step.rank]
      // Le décalage glissé d'une étape s'ajoute à celui de ses ancêtres : toute la branche suit.
      const own = add(shift, kid.step.offset)
      pending.push({
        depth,
        width: card.width,
        build: (left) => [
          { kind: 'step', step: kid.step, label: rankLabel(path), ...add(at(left), own) },
          ...placeAnnexes(kid.step.id, { left }, cardY + card.height / 2, own)
        ]
      })
      edges.push({ id: `plan-line-${kid.step.id}`, source: parentId, target: kid.step.id, ghost: false, annex: false })
      annexEdges(kid.step.id)
      place(kid.step.id, path, depth + 1, middle, own)
    }
  }
  place(input.genesisId, [], 1, input.center.y, { x: 0, y: 0 })

  // Seconde passe : colonnes calées à gauche, chacune après la précédente.
  const lefts: number[] = []
  for (let depth = 1; depth < columnWidths.length; depth += 1) {
    lefts[depth] =
      depth === 1 ? input.center.x + GENESIS_GAP : (lefts[depth - 1] ?? 0) + (columnWidths[depth - 1] ?? 0) + COLUMN_GAP
  }
  const items = pending.flatMap((entry) => entry.build(lefts[entry.depth] ?? 0))
  // Annexes du genesis : sous lui, bord droit avant la colonne de ses étapes (la physique le place ; elles le suivent).
  annexEdges(input.genesisId)
  items.push(
    ...placeAnnexes(
      input.genesisId,
      { right: input.center.x + GENESIS_GAP - COLUMN_GAP / 2 },
      input.center.y + GENESIS_ANNEX_TOP - ANNEX_GAP,
      { x: 0, y: 0 }
    )
  )
  return { items, edges }
}
