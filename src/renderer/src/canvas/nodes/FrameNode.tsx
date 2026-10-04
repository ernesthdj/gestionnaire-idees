import { NodeResizer, type NodeProps } from '@xyflow/react'
import { BLOCK_LIMITS } from '@shared/ipc/canvas'
import type { FrameNodeType } from '../buildGraph'
import { useBlockActions } from '../useBlockActions'
import { ClaudeBadge } from './ClaudeBadge'

const LIMITS = BLOCK_LIMITS.frame

/**
 * Cadre de regroupement (spec 007) : un titre et une zone qui englobe un lot dessiné par Claude. Affiché sous les
 * autres éléments ; le supprimer retire aussi son contenu (côté main, même opération d'Historique).
 */
export function FrameNode({ id, data, selected, width, height }: NodeProps<FrameNodeType>): React.JSX.Element {
  const { block } = data
  const actions = useBlockActions()
  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={LIMITS.minWidth}
        minHeight={LIMITS.minHeight}
        maxWidth={LIMITS.maxWidth}
        maxHeight={LIMITS.maxHeight}
        onResizeEnd={(_event, next) => void actions.save(id, next)}
      />
      <section
        aria-label={`Cadre « ${block.title ?? 'Cadre'} »`}
        className="group relative h-full w-full rounded-xl border-2 border-dashed border-content-muted/40 bg-surface/40"
        style={{ width: width ?? block.width, height: height ?? block.height }}
      >
        <header className="flex items-center gap-2 px-4 pt-2">
          <h2 className="text-base font-semibold text-content">{block.title ?? 'Cadre'}</h2>
          {block.origin === 'claude' ? <ClaudeBadge /> : null}
          <button
            type="button"
            aria-label={`Supprimer le cadre « ${block.title ?? 'Cadre'} »`}
            onClick={() => void actions.remove(id, 'frame')}
            className="nodrag ml-auto flex h-7 w-7 items-center justify-center rounded-md bg-surface opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-surface-raised"
          >
            ×
          </button>
        </header>
      </section>
    </>
  )
}
