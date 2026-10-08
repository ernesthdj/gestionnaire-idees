import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { DeliverableView } from '@shared/ipc/finals'
import { useUiStore } from '../../app/uiStore'
import type { DeliverableNodeType } from '../buildGraph'
import { LivingNode } from '../living/LivingNode'

/** Titre d'un livrable : nombre de fichiers. */
export const deliverableTitle = (deliverable: DeliverableView): string => {
  const count = deliverable.files.length
  return `Livrable · ${count} fichier${count > 1 ? 's' : ''}`
}

/**
 * Fichiers créés ou modifiés par Claude pour une action finale (spec 013 US2) ; un clic ouvre le fichier dans le
 * lecteur de la carte (différence et contenu, en lecture seule). Affichés dans la carte de détails du livrable.
 */
export function DeliverableFiles({ deliverable }: { readonly deliverable: DeliverableView }): React.JSX.Element {
  const openViewer = useUiStore((state) => state.openViewer)
  const count = deliverable.files.length
  return (
    <div className="text-sm">
      {deliverable.executing ? (
        <p role="status" className="mb-1 text-xs text-action">
          Claude écrit…
        </p>
      ) : null}
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
                className="nodrag flex w-full items-center gap-2 rounded px-1 text-left hover:bg-surface-raised"
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
  )
}

/**
 * Livrable d'une action finale (spec 013) en petit cercle vivant (spec 022 D11) sous son action : pictogramme livrable,
 * trombone (ses fichiers se lisent dans la carte), statut « en cours » pendant que Claude écrit. Il se glisse comme
 * avant (décalage mémorisé).
 */
export function DeliverableNode({ data }: NodeProps<DeliverableNodeType>): React.JSX.Element {
  const { deliverable, dimmed, visual, open } = data
  return (
    <div className={`nopan living-deliverable${dimmed ? ' plan-dimmed' : ''}`}>
      <LivingNode
        id={`deliverable-${deliverable.neuronId}`}
        title={deliverableTitle(deliverable)}
        visual={deliverable.executing ? { ...visual, status: 'doing' } : visual}
        hasFiles={deliverable.files.length > 0}
        open={open}
      >
        <Handle id="top" type="target" position={Position.Top} isConnectable={false} className="neuron-handle" />
        <Handle id="bottom" type="source" position={Position.Bottom} isConnectable={false} className="neuron-handle" />
      </LivingNode>
    </div>
  )
}
