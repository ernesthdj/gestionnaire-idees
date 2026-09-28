import { NodeResizer, type NodeProps } from '@xyflow/react'
import { useQueryClient } from '@tanstack/react-query'
import { BLOCK_SIZE_LIMITS } from '@shared/ipc/canvas'
import { call } from '../../lib/ipc'
import type { BlockNodeType } from '../buildGraph'

/**
 * Bloc libre (FR-026) : conteneur vide que l'on place, déplace, redimensionne et supprime. Il accueillera les
 * mini-widgets de la v2 ; en MVP-1 il n'affiche ni n'exécute aucun contenu.
 */
export function BlockNode({ id, selected }: NodeProps<BlockNodeType>): React.JSX.Element {
  const client = useQueryClient()
  const refresh = (): Promise<void> => client.invalidateQueries({ queryKey: ['canvas'] })

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={BLOCK_SIZE_LIMITS.min}
        minHeight={BLOCK_SIZE_LIMITS.min}
        maxWidth={BLOCK_SIZE_LIMITS.max}
        maxHeight={BLOCK_SIZE_LIMITS.max}
        onResizeEnd={(_event, box) => {
          void call('canvas:updateBlock', { id, x: box.x, y: box.y, width: box.width, height: box.height })
            .then(refresh)
            .catch(() => undefined)
        }}
      />
      <div className="relative flex h-full w-full items-center justify-center rounded-xl border-2 border-dashed border-content-muted/50 bg-surface-raised/60 p-4 text-center text-xs text-content-muted">
        <span aria-hidden="true">Bloc vide — les mini-widgets arrivent en v2</span>
        <button
          type="button"
          aria-label="Supprimer le bloc"
          onClick={() => {
            void call('canvas:deleteBlock', { id })
              .then(refresh)
              .catch(() => undefined)
          }}
          className="nodrag absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-md hover:bg-surface"
        >
          ×
        </button>
      </div>
    </>
  )
}
