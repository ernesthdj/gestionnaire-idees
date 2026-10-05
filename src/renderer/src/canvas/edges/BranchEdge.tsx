import { BaseEdge, getStraightPath, type Edge, type EdgeProps } from '@xyflow/react'
import { useCenter } from './useCenter'

export type BranchEdgeData = {
  /**
   * Trait plein (arbre : notes, carte de structure, plan d'attaque), pointillé (vers un fantôme proposé par Claude),
   * entrée d'un widget (`io`).
   */
  readonly style: 'solid' | 'dashed' | 'io'
}
export type BranchEdgeType = Edge<BranchEdgeData, 'branch'>

/** Trait d'un arbre de la carte, du centre du parent au centre de l'enfant (sous les nœuds). */
export function BranchEdge({ id, source, target, data }: EdgeProps<BranchEdgeType>): React.JSX.Element | null {
  const from = useCenter(source)
  const to = useCenter(target)
  if (from === null || to === null || data === undefined) return null
  const [path] = getStraightPath({ sourceX: from.x, sourceY: from.y, targetX: to.x, targetY: to.y })
  const style = data.style === 'io' ? ' io-line' : data.style === 'dashed' ? ' branch-line-dashed' : ''
  return <BaseEdge id={id} path={path} className={`branch-line${style}`} />
}
