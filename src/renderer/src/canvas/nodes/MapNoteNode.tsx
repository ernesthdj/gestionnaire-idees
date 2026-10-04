import { NodeResizer, type NodeProps } from '@xyflow/react'
import { BLOCK_LIMITS } from '@shared/ipc/canvas'
import type { MapNoteNodeType } from '../buildGraph'
import { useBlockActions } from '../useBlockActions'
import { ClaudeBadge } from './ClaudeBadge'

const LIMITS = BLOCK_LIMITS.note

/**
 * Note titrée (spec 007) : posée par Claude Code par le pont MCP, ou par mentalyas. Titre, texte (affiché comme du
 * texte, jamais interprété : FR-018), badge « par Claude ». Redimensionnable et supprimable comme tout bloc.
 */
export function MapNoteNode({ id, data, selected, width, height }: NodeProps<MapNoteNodeType>): React.JSX.Element {
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
      <article
        className="group relative flex h-full w-full flex-col gap-1 overflow-hidden rounded-lg border border-content-muted/30 bg-surface-raised px-3 py-2 text-content shadow-sm"
        style={{ width: width ?? block.width, height: height ?? block.height }}
      >
        <header className="flex items-start justify-between gap-2">
          <h3 className="text-sm leading-snug font-semibold break-words">{block.title ?? 'Note'}</h3>
          {block.origin === 'claude' ? <ClaudeBadge /> : null}
        </header>
        {block.text === null || block.text === '' ? null : (
          <p className="nowheel min-h-0 flex-1 overflow-y-auto text-xs leading-relaxed whitespace-pre-wrap text-content-muted">
            {block.text}
          </p>
        )}
        <button
          type="button"
          aria-label={`Supprimer la note « ${block.title ?? 'Note'} »`}
          onClick={() => void actions.remove(id, 'note')}
          className="nodrag absolute right-1 bottom-1 flex h-7 w-7 items-center justify-center rounded-md bg-surface opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-surface-raised"
        >
          ×
        </button>
      </article>
    </>
  )
}
