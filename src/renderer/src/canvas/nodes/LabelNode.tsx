import { NodeResizer, type NodeProps } from '@xyflow/react'
import { useEffect, useId, useRef, useState } from 'react'
import { BLOCK_LIMITS, LABEL_MAX_CHARS } from '@shared/ipc/canvas'
import { useUiStore } from '../../app/uiStore'
import type { LabelNodeType } from '../buildGraph'
import { useBlockActions } from '../useBlockActions'

const LIMITS = BLOCK_LIMITS.label

/**
 * Note posée sur la carte (spec 004 US2) : un texte libre (titre de zone, rappel, légende). Double-clic ou
 * « Modifier » pour écrire ; Échap, Ctrl+Entrée ou un clic ailleurs enregistrent. Une note neuve s'ouvre en écriture.
 */
export function LabelNode({ id, data, selected, width, height }: NodeProps<LabelNodeType>): React.JSX.Element {
  const { block } = data
  const actions = useBlockActions()
  const fieldId = useId()
  // Seule la note qu'on vient de poser s'ouvre en écriture (jamais une note vide retrouvée au rechargement).
  const justCreated = useUiStore((state) => state.bornId === id)
  const [editing, setEditing] = useState(justCreated)
  const [draft, setDraft] = useState(block.text ?? '')
  const field = useRef<HTMLTextAreaElement>(null)
  const box = { x: block.x, y: block.y, width: width ?? block.width, height: height ?? block.height }

  useEffect(() => {
    if (editing) field.current?.focus()
  }, [editing])

  const commit = (): void => {
    setEditing(false)
    if (draft !== (block.text ?? '')) void actions.save(id, box, draft)
  }

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
      <div
        className="group relative h-full w-full overflow-hidden rounded-lg border border-content-muted/30 bg-surface-raised/80 px-3 py-2 text-content shadow-sm"
        onDoubleClick={(event) => {
          event.stopPropagation()
          setEditing(true)
        }}
      >
        {editing ? (
          <>
            <label htmlFor={fieldId} className="sr-only">
              Texte de la note
            </label>
            <textarea
              ref={field}
              id={fieldId}
              value={draft}
              maxLength={LABEL_MAX_CHARS}
              placeholder="Ta note…"
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commit}
              onKeyDown={(event) => {
                event.stopPropagation()
                if (event.key === 'Escape' || (event.key === 'Enter' && event.ctrlKey)) {
                  event.preventDefault()
                  commit()
                }
              }}
              className="nodrag nowheel h-full w-full resize-none bg-transparent text-sm leading-relaxed outline-none"
            />
          </>
        ) : (
          <p className="h-full overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap">
            {block.text === '' || block.text === null ? (
              <span className="text-content-muted">Note vide</span>
            ) : (
              block.text
            )}
          </p>
        )}
        {editing ? null : (
          <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
            <button
              type="button"
              aria-label="Modifier la note"
              onClick={() => setEditing(true)}
              className="nodrag flex h-7 w-7 items-center justify-center rounded-md bg-surface text-xs hover:bg-surface-raised"
            >
              ✎
            </button>
            <button
              type="button"
              aria-label="Supprimer la note"
              onClick={() => void actions.remove(id, 'label')}
              className="nodrag flex h-7 w-7 items-center justify-center rounded-md bg-surface hover:bg-surface-raised"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </>
  )
}
