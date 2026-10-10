import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useQueryClient } from '@tanstack/react-query'
import { useUiStore } from '../../app/uiStore'
import { call, IpcFailure } from '../../lib/ipc'
import type { WorkflowNodeType } from '../buildGraph'
import { LivingNode } from '../living/LivingNode'
import { useRunningChats } from './runningChats'
import { useWorkflowFold } from './WorkflowCard'
import './workflow.css'

/** Nœuds Workflow qui se branchent sur un widget (spec 023 D24) : pas une branche, un message ni un groupe « Faites ». */
const CONNECTABLE: ReadonlySet<string> = new Set([
  'taskFile',
  'taskGroup',
  'fileTask',
  'spec',
  'story',
  'socle',
  'task'
])

/**
 * Nœud de la vue Workflow (spec 023) : petit cercle vivant (couleur de sa branche, pictogramme, pastille de statut),
 * titre et avancement « faites / toutes » dessous, repli « ▸ N » mémorisé par projet. Un message (projet vide, dossier
 * introuvable) s'affiche en pastille de texte.
 */
export function WorkflowNode({ data }: NodeProps<WorkflowNodeType>): React.JSX.Element {
  const { item, visual, genesisId, open } = data
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  const fold = useWorkflowFold(genesisId)
  // Tâche dont la conversation de nœud tourne : « en cours » le temps du tour (D21).
  const chatId = client.getQueryData<{ readonly neuronId: string }>(['workflow-chat', item.key])?.neuronId
  const working = useRunningChats((state) => chatId !== undefined && state.running.has(chatId))
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
  const toggle = (): void => fold(item.key, !item.collapsed)
  const meta = [
    working ? 'Claude y travaille' : null,
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
        visual={working && visual.status !== 'done' ? { ...visual, status: 'doing' } : visual}
        open={open}
        {...(meta === '' ? {} : { meta })}
        {...(item.descendants === 0
          ? {}
          : { fold: { collapsed: item.collapsed, count: item.descendants, onToggle: toggle } })}
      >
        <Handle type="target" position={Position.Left} isConnectable={false} className="neuron-handle" />
        <Handle type="source" position={Position.Right} isConnectable={false} className="neuron-handle" />
        {CONNECTABLE.has(item.subject.kind) ? (
          // Point d'accroche visible au survol : on le tire vers un widget pour lui transmettre le nœud (spec 023 D24).
          <Handle
            id="connect"
            type="source"
            position={Position.Right}
            isConnectableEnd={false}
            className="neuron-connector"
            title="Tirer vers un widget pour lui transmettre ce nœud du Workflow"
          />
        ) : null}
      </LivingNode>
    </div>
  )
}
