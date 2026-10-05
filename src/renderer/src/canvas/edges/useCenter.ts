import { useInternalNode } from '@xyflow/react'

/** Centre d'un nœud mesuré (les neurones n'ont pas de poignées : les liens relient les centres). */
export function useCenter(id: string): { x: number; y: number } | null {
  const node = useInternalNode(id)
  if (node === undefined) return null
  const { x, y } = node.internals.positionAbsolute
  return { x: x + (node.measured.width ?? 0) / 2, y: y + (node.measured.height ?? 0) / 2 }
}
