import { useInternalNode, type InternalNode } from '@xyflow/react'

interface Point {
  readonly x: number
  readonly y: number
}

/** Centre d'un nœud mesuré (les neurones n'ont pas de poignées : les liens relient les centres). */
export function useCenter(id: string): Point | null {
  const node = useInternalNode(id)
  return node === undefined ? null : centerOf(node)
}

function centerOf(node: InternalNode): Point {
  const { x, y } = node.internals.positionAbsolute
  return { x: x + (node.measured.width ?? 0) / 2, y: y + (node.measured.height ?? 0) / 2 }
}

/** Nœuds rectangulaires (un lien s'arrête à leur bord) : aucun depuis la spec 022, où les éléments sont ronds. */
const RECTANGLES: ReadonlySet<string> = new Set<string>()

/**
 * Point où le segment du centre d'un rectangle vers `toward` en traverse le bord ; le centre si `toward` est dedans.
 * Pur.
 */
export function borderPoint(center: Point, width: number, height: number, toward: Point): Point {
  const dx = toward.x - center.x
  const dy = toward.y - center.y
  if (dx === 0 && dy === 0) return center
  const scale = Math.min(
    dx === 0 ? Infinity : width / 2 / Math.abs(dx),
    dy === 0 ? Infinity : height / 2 / Math.abs(dy)
  )
  return scale >= 1 ? center : { x: center.x + dx * scale, y: center.y + dy * scale }
}

/** Les deux bouts d'un lien : centre d'un nœud rond, bord d'un élément de carte de structure. */
export function useEnds(source: string, target: string): { readonly from: Point; readonly to: Point } | null {
  const a = useInternalNode(source)
  const b = useInternalNode(target)
  if (a === undefined || b === undefined) return null
  const ca = centerOf(a)
  const cb = centerOf(b)
  const end = (node: InternalNode, center: Point, toward: Point): Point =>
    node.type !== undefined && RECTANGLES.has(node.type)
      ? borderPoint(center, node.measured.width ?? 0, node.measured.height ?? 0, toward)
      : center
  return { from: end(a, ca, cb), to: end(b, cb, ca) }
}
