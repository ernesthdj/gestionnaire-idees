import { NodeResizer, type NodeProps } from '@xyflow/react'
import { BLOCK_LIMITS } from '@shared/ipc/canvas'
import type { BlockNodeType } from '../buildGraph'
import { useBlockActions } from '../useBlockActions'

const LIMITS = BLOCK_LIMITS.empty

/**
 * Bloc libre (FR-026) : conteneur vide que l'on place, déplace, redimensionne et supprime. Les notes et les
 * widgets (spec 004) sont des blocs typés, créés depuis le clic droit.
 */
export function BlockNode({ id, selected }: NodeProps<BlockNodeType>): React.JSX.Element {
  const actions = useBlockActions()
  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={LIMITS.minWidth}
        minHeight={LIMITS.minHeight}
        maxWidth={LIMITS.maxWidth}
        maxHeight={LIMITS.maxHeight}
        onResizeEnd={(_event, box) => void actions.save(id, box)}
      />
      <div className="relative flex h-full w-full items-center justify-center rounded-xl border-2 border-dashed border-content-muted/50 bg-surface-raised/60 p-4 text-center text-xs text-content-muted">
        <span aria-hidden="true">Bloc vide</span>
        <button
          type="button"
          aria-label="Supprimer le bloc"
          onClick={() => void actions.remove(id, 'empty')}
          className="nodrag absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-md hover:bg-surface"
        >
          ×
        </button>
      </div>
    </>
  )
}
