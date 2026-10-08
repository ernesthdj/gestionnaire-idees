import type { CSSProperties } from 'react'
import { BaseEdge, getStraightPath, type Edge, type EdgeProps } from '@xyflow/react'
import { useEnds } from './useCenter'

export type BranchEdgeData = {
  /**
   * Trait plein (arbre : notes, carte de structure, plan d'attaque), pointillé (vers un fantôme proposé par Claude),
   * entrée d'un widget (`io`).
   */
  readonly style: 'solid' | 'dashed' | 'io'
  /** Grande branche du nœud d'arrivée (spec 022 D17) : le trait en prend la couleur. */
  readonly branch?: number | null
}
export type BranchEdgeType = Edge<BranchEdgeData, 'branch'>

/** Trait d'un arbre de la carte, du centre du parent au centre de l'enfant (sous les nœuds). */
export function BranchEdge({ id, source, target, data }: EdgeProps<BranchEdgeType>): React.JSX.Element | null {
  const ends = useEnds(source, target)
  if (ends === null || data === undefined) return null
  const { from, to } = ends
  const [path] = getStraightPath({ sourceX: from.x, sourceY: from.y, targetX: to.x, targetY: to.y })
  const style = data.style === 'io' ? ' io-line' : data.style === 'dashed' ? ' branch-line-dashed' : ''
  const hue =
    data.branch === undefined || data.branch === null
      ? undefined
      : ({ '--edge-hue': `var(--color-branch-${data.branch})` } as CSSProperties)
  return (
    <BaseEdge
      id={id}
      path={path}
      className={`branch-line${style}${hue === undefined ? '' : ' branch-line-hued'}`}
      {...(hue === undefined ? {} : { style: hue })}
    />
  )
}
