import { memo, type ComponentType } from 'react'
import type { Node, NodeProps } from '@xyflow/react'

/**
 * Nœud qui ne se redessine que si son contenu change (spec 022 D4) : pendant un glissement, la carte donne une nouvelle
 * position à chaque image ; React Flow déplace le nœud, et son contenu (orbe, pictogramme, pastilles, widget) n'est
 * pas recalculé. Les positions reçues en propriétés sont donc ignorées ; le reste est comparé.
 */
export function stillNode<T extends Node>(Component: ComponentType<NodeProps<T>>): ComponentType<NodeProps<T>> {
  return memo(
    Component,
    (before, after) =>
      before.id === after.id &&
      before.data === after.data &&
      before.selected === after.selected &&
      before.dragging === after.dragging &&
      before.width === after.width &&
      before.height === after.height
  )
}
