import type { NodeProps } from '@xyflow/react'
import type { LayerBandNodeType } from '../buildGraph'

/**
 * Bande d'une couche dans la vue Architecture (spec 017 D20) : fond discret derrière les éléments, nom de la couche
 * et nombre d'éléments dans la colonne de gauche. Elle n'intercepte aucun clic.
 */
export function LayerBandNode({ data }: NodeProps<LayerBandNodeType>): React.JSX.Element {
  const { band } = data
  const unclassified = band.layer === null
  return (
    <div
      className={`pointer-events-none flex rounded-xl border bg-content-muted/5 ${
        unclassified ? 'border-dashed border-content-muted/40' : 'border-content-muted/30'
      }`}
      style={{ width: band.width, height: band.height }}
    >
      <div className="flex w-44 shrink-0 flex-col justify-center gap-1 border-r border-content-muted/20 px-4">
        <span className="text-sm font-semibold text-content">{band.label}</span>
        <span className="text-xs text-content-muted">
          {band.count} élément{band.count > 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}
