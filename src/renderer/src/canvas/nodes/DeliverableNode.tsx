import { useQueryClient } from '@tanstack/react-query'
import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react'
import { DELIVERABLE_SIZE_LIMITS } from '@shared/ipc/finals'
import { useUiStore } from '../../app/uiStore'
import { call, IpcFailure } from '../../lib/ipc'
import type { DeliverableNodeType } from '../buildGraph'
import { BoltIcon } from './PlanNode'

/**
 * Livrable d'une action finale (spec 013 US2) : annexe sous l'action, liste des fichiers créés ou modifiés par
 * Claude dans le projet lié. Se glisse et se redimensionne comme un document.
 */
export function DeliverableNode({ data, selected }: NodeProps<DeliverableNodeType>): React.JSX.Element {
  const { deliverable, title, dimmed } = data
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  const openViewer = useUiStore((state) => state.openViewer)
  const count = deliverable.files.length

  const resize = async (width: number, height: number): Promise<void> => {
    try {
      await call('deliverable:resize', {
        neuronId: deliverable.neuronId,
        width: Math.round(width),
        height: Math.round(height)
      })
      await client.invalidateQueries({ queryKey: ['canvas'] })
    } catch (error) {
      showToast(error instanceof IpcFailure ? error.message : 'La taille n’a pas pu être enregistrée.')
    }
  }

  return (
    <section
      aria-label={`Livrable de « ${title} »`}
      className={`deliverable-node flex h-full w-full flex-col overflow-hidden rounded-xl border-2 border-action bg-surface text-content shadow-lg${dimmed ? ' plan-dimmed' : ''}`}
    >
      <NodeResizer
        isVisible={selected === true}
        minWidth={DELIVERABLE_SIZE_LIMITS.minWidth}
        minHeight={DELIVERABLE_SIZE_LIMITS.minHeight}
        maxWidth={DELIVERABLE_SIZE_LIMITS.maxWidth}
        maxHeight={DELIVERABLE_SIZE_LIMITS.maxHeight}
        onResizeEnd={(_event, box) => void resize(box.width, box.height)}
      />
      <Handle id="top" type="target" position={Position.Top} isConnectable={false} className="neuron-handle" />
      <Handle id="bottom" type="source" position={Position.Bottom} isConnectable={false} className="neuron-handle" />
      <header className="flex h-9 shrink-0 items-center gap-2 border-b border-content-muted/20 bg-surface-raised px-3 text-xs">
        <BoltIcon className="text-action" />
        <span className="min-w-0 flex-1 truncate font-semibold">
          Livrable · {count} fichier{count > 1 ? 's' : ''}
        </span>
        {deliverable.executing ? (
          <span role="status" className="text-action">
            Claude écrit…
          </span>
        ) : null}
      </header>
      <div className="nodrag nowheel min-h-0 flex-1 overflow-y-auto px-3 py-2 text-sm" tabIndex={0}>
        {deliverable.runs.length === 0 ? null : (
          <ul aria-label="Résultats des commandes" className="mb-2 flex flex-wrap gap-1">
            {deliverable.runs.map((run) => (
              <li
                key={run.script}
                className={`rounded px-1.5 text-xs font-semibold ${run.ok ? 'bg-pro/15 text-pro' : 'bg-con/15 text-con'}`}
              >
                {run.script} {run.ok ? '✓' : run.timedOut ? '⏱ délai dépassé' : '✗'}
              </li>
            ))}
          </ul>
        )}
        {count === 0 ? (
          <p className="text-content-muted">
            {deliverable.executing
              ? 'Claude lit le projet et prépare le livrable…'
              : 'Aucun fichier du projet écrit (documents éventuels : annexés à l’action).'}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {deliverable.files.map((file) => (
              <li key={file.path}>
                <button
                  type="button"
                  onClick={() => openViewer(deliverable.neuronId, file.path)}
                  aria-label={`Lire ${file.path} (${file.status === 'cree' ? 'créé' : 'modifié'})`}
                  className="flex w-full items-center gap-2 rounded px-1 text-left hover:bg-surface-raised"
                >
                  <span
                    className={`shrink-0 rounded px-1.5 text-xs font-semibold ${file.status === 'cree' ? 'bg-pro/15 text-pro' : 'bg-accent/15 text-accent'}`}
                  >
                    {file.status === 'cree' ? 'créé' : 'modifié'}
                  </span>
                  <code className="min-w-0 truncate text-xs" title={file.path}>
                    {file.path}
                  </code>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
