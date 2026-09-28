import type { NodeProps } from '@xyflow/react'
import type { ZoneNodeType } from '../buildGraph'

/** Fond d'une zone (Incubateur / Réseau) : délimitation visuelle (Gestalt : fermeture), sans interaction. */
export function ZoneNode({ data }: NodeProps<ZoneNodeType>): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="rounded-3xl border border-content-muted/20 bg-surface-raised/40 p-6"
      style={{ width: data.width, height: data.height }}
    >
      <p className="zone-label">{data.label}</p>
    </div>
  )
}
