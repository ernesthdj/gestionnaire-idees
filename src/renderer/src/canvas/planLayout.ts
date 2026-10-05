import type { ProposalView, StepView } from '@shared/ipc/canvas'
import { rankLabel } from '@shared/plan/rankLabel'

/**
 * Disposition d'un plan d'attaque (spec 011 R4) : arbre de gauche à droite, une colonne par niveau, enfants d'un
 * même parent de haut en bas par rang, chaque parent centré sur ses enfants. Fonction pure et déterministe : elle ne
 * dépend que de l'arbre ; ajouter un nœud n'agrandit que sa branche (seul ce qui est en dessous se décale).
 */

/** Tailles des cartes : étape (niveau 1) et sous-étape (niveau 2+). */
export const PLAN_SIZES = {
  step: { width: 240, height: 72 },
  subStep: { width: 200, height: 52 },
  bar: { width: 240, height: 40 }
} as const
/** Écart entre le centre du genesis et la première colonne, puis d'une colonne à la suivante. */
const FIRST_COLUMN = 240
const COLUMN = 300
const ROW_GAP = 16

export const planSize = (depth: number): { readonly width: number; readonly height: number } =>
  depth <= 1 ? PLAN_SIZES.step : PLAN_SIZES.subStep

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
}

export interface PlanLayout {
  readonly items: readonly PlacedPlanItem[]
  readonly edges: readonly PlanEdge[]
}

/** Identifiants des nœuds de carte d'un fantôme et de la barre de sa proposition. */
export const ghostNodeId = (itemId: string): string => `ghost-${itemId}`
export const barNodeId = (proposalId: string): string => `plan-bar-${proposalId}`

type Child =
  | { readonly kind: 'step'; readonly step: StepView }
  | { readonly kind: 'ghost'; readonly ghost: ProposalView['items'][number]; readonly proposal: ProposalView }
  | { readonly kind: 'bar'; readonly proposal: ProposalView }

export function planLayout(input: {
  readonly genesisId: string
  readonly center: { readonly x: number; readonly y: number }
  /** Étapes de ce genesis. */
  readonly steps: readonly StepView[]
  /** Propositions en attente dont le parent est ce genesis ou une de ses étapes. */
  readonly proposals: readonly ProposalView[]
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

  const idOf = (child: Child): string =>
    child.kind === 'step'
      ? child.step.id
      : child.kind === 'ghost'
        ? ghostNodeId(child.ghost.id)
        : barNodeId(child.proposal.id)
  const ownHeight = (child: Child, depth: number): number =>
    child.kind === 'bar' ? PLAN_SIZES.bar.height : planSize(depth).height
  // Hauteur d'un sous-arbre : la sienne, ou celle de ses enfants empilés si elle est plus grande.
  const heights = new Map<string, number>()
  const heightOf = (child: Child, depth: number): number => {
    const id = idOf(child)
    const known = heights.get(id)
    if (known !== undefined) return known
    const kids = child.kind === 'step' ? (children.get(child.step.id) ?? []) : []
    const stacked =
      kids.reduce((sum, kid) => sum + heightOf(kid, depth + 1), 0) + Math.max(kids.length - 1, 0) * ROW_GAP
    const height = Math.max(ownHeight(child, depth), stacked)
    heights.set(id, height)
    return height
  }

  const items: PlacedPlanItem[] = []
  const edges: PlanEdge[] = []
  const place = (parentId: string, ranks: readonly number[], depth: number, centerY: number): void => {
    const kids = children.get(parentId) ?? []
    if (kids.length === 0) return
    const total = kids.reduce((sum, kid) => sum + heightOf(kid, depth), 0) + (kids.length - 1) * ROW_GAP
    const x = input.center.x + FIRST_COLUMN + (depth - 1) * COLUMN
    const existing = kids.filter((kid) => kid.kind === 'step').length
    let top = centerY - total / 2
    for (const kid of kids) {
      const height = heightOf(kid, depth)
      const y = top + height / 2
      top += height + ROW_GAP
      if (kid.kind === 'bar') {
        items.push({ kind: 'bar', proposal: kid.proposal, depth, x, y })
        continue
      }
      if (kid.kind === 'ghost') {
        // Rang à la naissance : après les étapes existantes, dans l'ordre proposé.
        const label = rankLabel([...ranks, existing + kid.ghost.rank])
        items.push({ kind: 'ghost', ghost: kid.ghost, proposalId: kid.proposal.id, parentId, depth, label, x, y })
        edges.push({
          id: `plan-line-${ghostNodeId(kid.ghost.id)}`,
          source: parentId,
          target: ghostNodeId(kid.ghost.id),
          ghost: true
        })
        continue
      }
      const path = [...ranks, kid.step.rank]
      items.push({ kind: 'step', step: kid.step, label: rankLabel(path), x, y })
      edges.push({ id: `plan-line-${kid.step.id}`, source: parentId, target: kid.step.id, ghost: false })
      place(kid.step.id, path, depth + 1, y)
    }
  }
  place(input.genesisId, [], 1, input.center.y)
  return { items, edges }
}
