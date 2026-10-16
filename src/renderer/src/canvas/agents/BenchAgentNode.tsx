import { Handle, Position, type NodeProps } from '@xyflow/react'
import { AgentIdCard } from './AgentIdCard'
import type { BenchAgentNodeType } from './agentTypes'
import './agents.css'

/**
 * Agent posé libre sur la carte (L1o D26) : sa carte d'identité, qu'on déplace où l'on veut ; on tire un lien de sa
 * poignée vers une tâche ou un nœud du Workflow pour l'y connecter. Clic droit : le retirer de la carte.
 */
export function BenchAgentNode({ data }: NodeProps<BenchAgentNodeType>): React.JSX.Element {
  return (
    <div
      className="agent-bench-node"
      role="group"
      aria-label={`${data.profile.name}, agent libre : tire un lien vers une tâche pour l’y connecter`}
    >
      <AgentIdCard profile={data.profile} note="à relier" />
      <Handle
        type="source"
        position={Position.Right}
        className="agent-bench-handle"
        title="Tirer vers une tâche ou un nœud du Workflow pour y connecter l’agent"
      />
    </div>
  )
}
