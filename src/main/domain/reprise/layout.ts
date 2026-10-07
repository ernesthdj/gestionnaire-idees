import type { CodeCategory } from '@shared/ipc/reprise'

/** Colonnes de lecture (spec 017 R3-7) : le flux entre à gauche, passe par le cœur, sort vers l'extérieur. */
export const COLUMNS: readonly CodeCategory[] = ['orchestration', 'domain', 'infrastructure', 'plumbing']
export const COLUMN_WIDTH = 280
export const ROW_HEIGHT = 96
/** Nœud dossier à onglets (D16) : sa liste de fichiers défile dans un nœud de hauteur fixe. */
export const FOLDER_ROW_HEIGHT = 272

export interface LayoutNode {
  readonly key: string
  readonly category: CodeCategory
}

/**
 * Mise en page en colonnes par catégorie (Sugiyama simplifié) : dans chaque colonne, les nœuds sont ordonnés par le
 * barycentre de leurs voisins des autres colonnes, pour limiter les croisements. Les nœuds déplacés par mentalyas
 * gardent leur place. Fonction pure.
 */
export function columnLayout(
  nodes: readonly LayoutNode[],
  edges: readonly { readonly from: string; readonly to: string }[],
  pinned: ReadonlyMap<string, { readonly x: number; readonly y: number }> = new Map(),
  rowHeight: number = ROW_HEIGHT
): Map<string, { readonly x: number; readonly y: number }> {
  const used = COLUMNS.filter((category) => nodes.some((node) => node.category === category))
  const columnOf = new Map(nodes.map((node) => [node.key, used.indexOf(node.category)] as const))
  const neighbours = new Map<string, string[]>()
  for (const edge of edges) {
    neighbours.set(edge.from, [...(neighbours.get(edge.from) ?? []), edge.to])
    neighbours.set(edge.to, [...(neighbours.get(edge.to) ?? []), edge.from])
  }
  const columns = used.map((category) =>
    nodes
      .filter((node) => node.category === category)
      .map((node) => node.key)
      .sort((a, b) => (neighbours.get(b)?.length ?? 0) - (neighbours.get(a)?.length ?? 0) || a.localeCompare(b))
  )
  const rank = new Map<string, number>()
  const refresh = (): void => columns.forEach((column) => column.forEach((key, index) => rank.set(key, index)))
  refresh()
  for (let pass = 0; pass < 4; pass++) {
    for (const column of columns) {
      const centre = (key: string): number => {
        const others = (neighbours.get(key) ?? []).filter((other) => columnOf.get(other) !== columnOf.get(key))
        return others.length === 0
          ? (rank.get(key) ?? 0)
          : others.reduce((sum, other) => sum + (rank.get(other) ?? 0), 0) / others.length
      }
      column.sort((a, b) => centre(a) - centre(b) || a.localeCompare(b))
    }
    refresh()
  }
  const positions = new Map<string, { x: number; y: number }>()
  columns.forEach((column, index) =>
    column.forEach((key, row) => positions.set(key, pinned.get(key) ?? { x: index * COLUMN_WIDTH, y: row * rowHeight }))
  )
  return positions
}
