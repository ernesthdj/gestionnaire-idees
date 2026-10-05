import { BaseEdge, EdgeLabelRenderer, getStraightPath, type Edge, type EdgeProps } from '@xyflow/react'
import { useCenter } from './useCenter'

import type { ElementRelation } from '@shared/ipc/canvas'

export type MapLinkEdgeData = {
  readonly label: string | null
  /** Relation d'une carte de structure (spec 009) : style du trait. */
  readonly relation?: ElementRelation | null
}
export type MapLinkEdgeType = Edge<MapLinkEdgeData, 'mapLink'>

/** Lien libre de la carte (spec 007) : trait fin, libellé toujours visible au milieu (texte, jamais du HTML). */
export function MapLinkEdge({ id, source, target, data }: EdgeProps<MapLinkEdgeType>): React.JSX.Element | null {
  const from = useCenter(source)
  const to = useCenter(target)
  if (from === null || to === null) return null
  const [path, labelX, labelY] = getStraightPath({ sourceX: from.x, sourceY: from.y, targetX: to.x, targetY: to.y })
  const label = data?.label ?? null
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        className={`map-link-line${data?.relation === undefined || data.relation === null ? '' : ` relation-${data.relation}`}`}
      />
      {label === null || label === '' ? null : (
        <EdgeLabelRenderer>
          <span
            className="pointer-events-none absolute rounded bg-surface px-1.5 py-0.5 text-[11px] text-content-muted shadow-sm"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {label}
          </span>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
