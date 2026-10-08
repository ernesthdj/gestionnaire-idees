import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useQueryClient } from '@tanstack/react-query'
import type { WorkflowView } from '@shared/ipc/workflow'
import { useUiStore } from '../../app/uiStore'
import { call, IpcFailure } from '../../lib/ipc'
import type { WorkflowNodeType } from '../buildGraph'
import { LivingNode } from '../living/LivingNode'
import './workflow.css'

/**
 * Nœud de la vue Workflow (spec 023) : petit cercle vivant (couleur de sa branche, pictogramme, pastille de statut),
 * titre et avancement « faites / toutes » dessous, repli « ▸ N » mémorisé par projet. Un message (projet vide, dossier
 * introuvable) s'affiche en pastille de texte.
 */
export function WorkflowNode({ data }: NodeProps<WorkflowNodeType>): React.JSX.Element {
  const { item, visual, genesisId, open } = data
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  if (item.subject.kind === 'message') {
    // Dossier introuvable (déplacé, disque débranché) : le relier comme depuis le menu du genesis.
    const relink = (): void => {
      void call('chat:linkFolder', { neuronId: genesisId, unlink: false })
        .then(() =>
          Promise.all([
            client.invalidateQueries({ queryKey: ['workflow', genesisId] }),
            client.invalidateQueries({ queryKey: ['canvas'] })
          ])
        )
        .catch((error: unknown) =>
          showToast(error instanceof IpcFailure ? error.message : 'Le dossier n’a pas pu être lié.')
        )
    }
    return (
      <div className="nopan workflow-message" role="note" data-missing={item.subject.missing ? 'true' : undefined}>
        {item.subject.text}
        {item.subject.missing ? (
          <button
            type="button"
            className="nodrag mt-2 block w-full rounded-md border border-content-muted/40 px-2 py-1 text-xs text-content hover:bg-surface"
            onClick={(event) => {
              event.stopPropagation()
              relink()
            }}
          >
            Relier le dossier…
          </button>
        ) : null}
        <Handle type="target" position={Position.Left} isConnectable={false} className="neuron-handle" />
      </div>
    )
  }
  const toggle = (): void => {
    const folded = !item.collapsed
    // Réponse immédiate : la vue en cache change d'abord, le choix est mémorisé ensuite.
    client.setQueryData<WorkflowView>(['workflow', genesisId], (current) =>
      current === undefined ? current : { ...current, folded: { ...current.folded, [item.key]: folded } }
    )
    void call('workflow:setFolded', { genesisId, key: item.key, folded }).catch(() =>
      client.invalidateQueries({ queryKey: ['workflow', genesisId] })
    )
  }
  const meta = [
    item.progress === undefined ? null : `${item.progress.done}/${item.progress.total}`,
    item.partial ? 'lecture partielle' : null
  ]
    .filter((part) => part !== null)
    .join(' · ')
  return (
    <div className="nopan" data-workflow={item.subject.kind}>
      <LivingNode
        id={item.key}
        title={item.title}
        visual={visual}
        open={open}
        {...(meta === '' ? {} : { meta })}
        {...(item.descendants === 0
          ? {}
          : { fold: { collapsed: item.collapsed, count: item.descendants, onToggle: toggle } })}
      >
        <Handle type="target" position={Position.Left} isConnectable={false} className="neuron-handle" />
        <Handle type="source" position={Position.Right} isConnectable={false} className="neuron-handle" />
      </LivingNode>
    </div>
  )
}
