/**
 * Aspect d'un nœud vivant (spec 022 D11, D17) : profondeur, grande branche (enfant direct de la racine, transmise à
 * toute sa descendance), taille selon la profondeur, pictogramme et statut. La racine d'un arbre (idée de départ,
 * projet, « Toi ») est un orbe. Fonctions pures.
 */

export type NodeIconKey =
  | 'step'
  | 'idea'
  | 'document'
  | 'final'
  | 'deliverable'
  | 'module'
  | 'component'
  | 'data'
  | 'task'
  | 'family'
  | 'skillPerso'
  | 'skillProjet'
  | 'skillPlugin'
  | 'project'
  | 'you'
  | 'feature'
  | 'interface'
  | 'decision'
  | 'operation'
  | 'branchActive'
  | 'branchUpcoming'
  | 'branchDelivered'
  | 'branchBrainstorm'
  | 'spec'
  | 'story'
  | 'socle'
  | 'info'

/** Statut affiché en pastille (pleine, à moitié, vide ; rouge si bloqué). */
export type NodeStatus = 'done' | 'doing' | 'todo' | 'blocked'

export interface TreeNodeInput {
  readonly id: string
  /** Parent dans l'arbre ; `null` (ou un parent absent) : racine. */
  readonly parentId: string | null
  readonly icon: NodeIconKey
  readonly status?: NodeStatus
}

export interface NodeVisual {
  /** 0 pour une racine, 1 pour ses enfants… */
  readonly depth: number
  /** Grande branche (1 à BRANCH_COUNT) ; `null` pour une racine. */
  readonly branch: number | null
  /** Diamètre d'un sous-nœud (px) ; 0 pour une racine (l'orbe a sa propre taille). */
  readonly size: number
  readonly icon: NodeIconKey
  readonly status?: NodeStatus
  readonly orb: boolean
}

export const BRANCH_COUNT = 10
/** Diamètre d'un sous-nœud selon sa profondeur (1, 2, 3, 4 et au-delà). */
export const SUB_NODE_SIZES = [58, 44, 36, 30] as const
/** Garde contre un arbre malformé (cycle) : au-delà, le nœud est traité comme une racine. */
const MAX_DEPTH = 64

export function subNodeSize(depth: number): number {
  return SUB_NODE_SIZES[Math.min(Math.max(depth, 1), SUB_NODE_SIZES.length) - 1] as number
}

export function nodeVisuals(nodes: readonly TreeNodeInput[]): ReadonlyMap<string, NodeVisual> {
  const byId = new Map(nodes.map((node) => [node.id, node] as const))
  const parentOf = (node: TreeNodeInput): TreeNodeInput | undefined =>
    node.parentId === null ? undefined : byId.get(node.parentId)
  // Rang de chaque enfant direct d'une racine parmi ses frères (ordre donné) : sa grande branche.
  const branchOfTop = new Map<string, number>()
  const rankAmongSiblings = new Map<string, number>()
  for (const node of nodes) {
    const parent = parentOf(node)
    if (parent === undefined) continue
    const rank = rankAmongSiblings.get(parent.id) ?? 0
    rankAmongSiblings.set(parent.id, rank + 1)
    branchOfTop.set(node.id, (rank % BRANCH_COUNT) + 1)
  }
  const out = new Map<string, NodeVisual>()
  for (const node of nodes) {
    // Remonte jusqu'à la racine : la profondeur, et l'ancêtre enfant direct de la racine (qui donne la branche).
    let depth = 0
    let top: TreeNodeInput = node
    let current = parentOf(node)
    while (current !== undefined && depth < MAX_DEPTH) {
      depth++
      const above = parentOf(current)
      if (above !== undefined) top = current
      current = above
    }
    const root = depth === 0 || depth >= MAX_DEPTH
    out.set(node.id, {
      depth: root ? 0 : depth,
      branch: root ? null : (branchOfTop.get(top.id) ?? null),
      size: root ? 0 : subNodeSize(depth),
      icon: node.icon,
      ...(node.status === undefined ? {} : { status: node.status }),
      orb: root
    })
  }
  return out
}
