import { useState } from 'react'

/**
 * Liste fenêtrée (spec 021 T016) : au-delà de quelques centaines de lignes, seules celles visibles (plus une marge) sont
 * dessinées ; la hauteur totale est gardée, le défilement reste naturel. Lignes de hauteur fixe.
 */
export function WindowedList<T>({
  items,
  rowHeight,
  height,
  renderRow,
  label,
  overscan = 10
}: {
  readonly items: readonly T[]
  readonly rowHeight: number
  /** Hauteur visible de la liste, en pixels. */
  readonly height: number
  readonly renderRow: (item: T, index: number) => React.ReactNode
  readonly label: string
  readonly overscan?: number
}): React.JSX.Element {
  const [scroll, setScroll] = useState(0)
  const first = Math.max(0, Math.floor(scroll / rowHeight) - overscan)
  const last = Math.min(items.length, Math.ceil((scroll + height) / rowHeight) + overscan)
  return (
    <div
      role="list"
      aria-label={label}
      className="overflow-y-auto"
      style={{ height }}
      onScroll={(event) => setScroll(event.currentTarget.scrollTop)}
    >
      <div style={{ height: items.length * rowHeight, position: 'relative' }}>
        {items.slice(first, last).map((item, offset) => (
          <div
            key={first + offset}
            role="listitem"
            style={{ position: 'absolute', top: (first + offset) * rowHeight, left: 0, right: 0, height: rowHeight }}
          >
            {renderRow(item, first + offset)}
          </div>
        ))}
      </div>
    </div>
  )
}
