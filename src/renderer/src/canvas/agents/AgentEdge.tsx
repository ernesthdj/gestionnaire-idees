import { BaseEdge, getStraightPath, type EdgeProps } from '@xyflow/react'
import { useEnds } from '../edges/useCenter'
import type { AgentEdgeType } from './agentTypes'

/**
 * Lien entre agents (T006) : « B attend A ». Trait plein, pointillés qui avancent quand le résultat de l'agent attendu
 * passe à celui qui travaille ; rouge si l'un des deux est arrêté. Le trait du nœud vers un agent qui n'attend
 * personne (le contexte) est en tirets fins.
 */
export function AgentEdge({ id, source, target, data }: EdgeProps<AgentEdgeType>): React.JSX.Element | null {
  const ends = useEnds(source, target)
  if (ends === null) return null
  const [path] = getStraightPath({ sourceX: ends.from.x, sourceY: ends.from.y, targetX: ends.to.x, targetY: ends.to.y })
  const phase = data?.phase ?? 'idle'
  return <BaseEdge id={id} path={path} className={`agent-link agent-link-${phase}`} />
}
