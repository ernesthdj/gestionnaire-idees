import { BaseEdge, getStraightPath, type Edge, type EdgeProps } from '@xyflow/react'
import { useCenter } from './useCenter'

export type BranchEdgeData = {
  /** Trait plein (sous-neurone), pointillé (suggestion, question), ambre (vers une idée), bleu (prochaine étape). */
  readonly style: 'solid' | 'dashed' | 'idea' | 'idea-dashed' | 'step' | 'io'
}
export type BranchEdgeType = Edge<BranchEdgeData, 'branch'>

/** Trait de l'arbre d'une idée ouverte, du centre du parent au centre de l'enfant (sous les nœuds). */
export function BranchEdge({ id, source, target, data }: EdgeProps<BranchEdgeType>): React.JSX.Element | null {
  const from = useCenter(source)
  const to = useCenter(target)
  if (from === null || to === null || data === undefined) return null
  const [path] = getStraightPath({ sourceX: from.x, sourceY: from.y, targetX: to.x, targetY: to.y })
  const dashed = data.style === 'dashed' || data.style === 'idea-dashed'
  const idea = data.style === 'idea' || data.style === 'idea-dashed'
  return (
    <BaseEdge
      id={id}
      path={path}
      className={`dive-line${dashed ? ' dive-line-dashed' : ''}${idea ? ' idea-line' : ''}${data.style === 'step' ? ' step-line' : ''}${data.style === 'io' ? ' io-line' : ''}`}
    />
  )
}
