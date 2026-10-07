/**
 * Disposition de l'arbre de skills (spec 020 research R9) : un tronc « Toi » au centre, une branche par groupe (familles
 * au lot A, domaines au lot B) répartie en éventail sur 360°, les skills le long de leur branche en rangées de 3
 * perpendiculaires. Fonction pure et déterministe : mêmes entrées, mêmes positions ; aucun chevauchement.
 */

export const SKILL_NODE = { width: 208, height: 104 } as const
export const TREE = {
  /** Distance du tronc à l'étiquette de la branche. */
  labelRadius: 220,
  /** Distance du tronc à la première rangée de skills. */
  firstRow: 400,
  /** Pas entre deux rangées le long de la branche. */
  rowStep: 240,
  /** Pas entre deux skills d'une même rangée (perpendiculaire à la branche). */
  across: 240,
  perRow: 3
} as const

export interface TreeGroup {
  readonly id: string
  readonly label: string
  /** Skills de la branche, déjà dans l'ordre voulu (note décroissante puis nom). */
  readonly items: readonly string[]
}

export interface Point {
  readonly x: number
  readonly y: number
}

export interface TreeLayout {
  /** Centre de chaque skill. */
  readonly items: ReadonlyMap<string, Point>
  /** Centre de l'étiquette de chaque branche. */
  readonly labels: ReadonlyMap<string, Point>
  readonly trunk: Point
}

const round = (value: number): number => Math.round(value)

export function layoutTree(groups: readonly TreeGroup[]): TreeLayout {
  const items = new Map<string, Point>()
  const labels = new Map<string, Point>()
  const count = groups.length
  // Plus de branches : on éloigne les rangées pour que deux branches voisines ne se touchent pas.
  const spread = count <= 1 ? 1 : Math.max(1, (TREE.across * TREE.perRow) / ((2 * Math.PI * TREE.firstRow) / count))
  groups.forEach((group, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / Math.max(1, count)
    const along = { x: Math.cos(angle), y: Math.sin(angle) }
    const across = { x: -along.y, y: along.x }
    labels.set(group.id, { x: round(along.x * TREE.labelRadius), y: round(along.y * TREE.labelRadius) })
    group.items.forEach((id, position) => {
      const row = Math.floor(position / TREE.perRow)
      const inRow = Math.min(TREE.perRow, group.items.length - row * TREE.perRow)
      const column = (position % TREE.perRow) - (inRow - 1) / 2
      const distance = TREE.firstRow * spread + row * TREE.rowStep
      items.set(id, {
        x: round(along.x * distance + across.x * column * TREE.across),
        y: round(along.y * distance + across.y * column * TREE.across)
      })
    })
  })
  return { items, labels, trunk: { x: 0, y: 0 } }
}

/** Deux nœuds de skill se chevauchent-ils (centres donnés) ? */
export function overlaps(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < SKILL_NODE.width && Math.abs(a.y - b.y) < SKILL_NODE.height
}
