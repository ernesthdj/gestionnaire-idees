import { BaseEdge, EdgeLabelRenderer, getStraightPath, type Edge, type EdgeProps } from '@xyflow/react'
import { useEnds } from './useCenter'

import type { ElementRelation } from '@shared/ipc/canvas'
import type { LinkProvenance } from '@shared/ipc/reprise'

export type MapLinkEdgeData = {
  readonly label: string | null
  /** Relation d'une carte de structure (spec 009) : style du trait. */
  readonly relation?: ElementRelation | null
  /** Appels mesurés par l'analyse (spec 017 US7) : trait distinct, selon leur fiabilité. */
  readonly measured?: LinkProvenance
  /** Lien d'une carte de structure : agrégé au niveau 1 (`rest`) ou de l'élément en focus (spec 017 D15). */
  readonly layer?: 'rest' | 'focus'
  /** Dépendance qui sort du cœur dans la vue Architecture (spec 017 D20). */
  readonly violation?: boolean
}
export type MapLinkEdgeType = Edge<MapLinkEdgeData, 'mapLink'>

/** Lien libre de la carte (spec 007) : trait fin, libellé toujours visible au milieu (texte, jamais du HTML). */
export function MapLinkEdge({ id, source, target, data }: EdgeProps<MapLinkEdgeType>): React.JSX.Element | null {
  const ends = useEnds(source, target)
  if (ends === null) return null
  const { from, to } = ends
  const [path, labelX, labelY] = getStraightPath({ sourceX: from.x, sourceY: from.y, targetX: to.x, targetY: to.y })
  const label = data?.label ?? null
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        className={`map-link-line${data?.relation === undefined || data.relation === null ? '' : ` relation-${data.relation}`}${
          data?.measured === undefined ? '' : ` measured measured-${data.measured}`
        }${data?.layer === undefined ? '' : ` structure-${data.layer}`}${data?.violation === true ? ' violation' : ''}`}
      />
      {label === null || label === '' ? null : (
        <EdgeLabelRenderer>
          <span
            data-layer={data?.layer}
            data-violation={data?.violation === true ? 'true' : undefined}
            className="map-link-label pointer-events-none absolute rounded bg-surface px-1.5 py-0.5 text-[11px] text-content-muted shadow-sm"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {label}
          </span>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
