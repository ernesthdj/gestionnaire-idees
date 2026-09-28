import { BaseEdge, EdgeLabelRenderer, getStraightPath, useInternalNode, useStore, type EdgeProps } from '@xyflow/react'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { call } from '../../lib/ipc'
import type { LinkEdgeType } from '../buildGraph'
import { useCanvasHover } from '../hoverStore'

/** Centre d'un nœud mesuré (les neurones n'ont pas de poignées : les liens relient les centres). */
function useCenter(id: string): { x: number; y: number } | null {
  const node = useInternalNode(id)
  if (node === undefined) return null
  const { x, y } = node.internals.positionAbsolute
  return { x: x + (node.measured.width ?? 0) / 2, y: y + (node.measured.height ?? 0) / 2 }
}

/**
 * Lien entre deux idées (FR-010) : trait discret dont le libellé n'apparaît qu'au survol ou au focus du lien ou de
 * l'une de ses idées ; un lien suggéré par l'IA est en pointillés et se décide sur place (✓ / ✗).
 */
export function LinkEdge({ id, source, target, data }: EdgeProps<LinkEdgeType>): React.JSX.Element | null {
  const client = useQueryClient()
  const [busy, setBusy] = useState(false)
  const setEdge = useCanvasHover((state) => state.setEdge)
  const hovered = useCanvasHover((state) => state.edgeId === id || state.nodeId === source || state.nodeId === target)
  const endpointSelected = useStore(
    (state) => state.nodeLookup.get(source)?.selected === true || state.nodeLookup.get(target)?.selected === true
  )
  const from = useCenter(source)
  const to = useCenter(target)
  if (from === null || to === null || data === undefined) return null
  const { link, dimmed } = data
  const suggested = link.status === 'suggested'
  const emphasized = hovered || endpointSelected
  const showLabel = suggested || emphasized
  const [path, labelX, labelY] = getStraightPath({ sourceX: from.x, sourceY: from.y, targetX: to.x, targetY: to.y })

  const decide = async (accept: boolean): Promise<void> => {
    setBusy(true)
    try {
      await call('links:decide', { linkId: link.id, accept })
      await Promise.all([
        client.invalidateQueries({ queryKey: ['canvas'] }),
        client.invalidateQueries({ queryKey: ['pending'] }),
        client.invalidateQueries({ queryKey: ['history'] })
      ])
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: 'var(--color-content-muted)',
          strokeWidth: emphasized ? 2.5 : 1.5,
          strokeDasharray: suggested ? '6 6' : undefined,
          opacity: dimmed ? 0.15 : emphasized ? 0.9 : 0.45
        }}
      />
      {showLabel ? (
        <EdgeLabelRenderer>
          <div
            onMouseEnter={() => setEdge(id)}
            onMouseLeave={() => setEdge(null)}
            className="nodrag nopan absolute flex items-center gap-1 rounded-full border border-content-muted/30 bg-surface px-2 py-0.5 text-xs text-content"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
              opacity: dimmed ? 0.3 : 1
            }}
            title={link.justification ?? undefined}
          >
            <span>{link.label}</span>
            {suggested ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void decide(true)}
                  aria-label={`Accepter le lien « ${link.label} » entre ${link.a.title} et ${link.b.title}`}
                  className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-surface-raised"
                >
                  ✓
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void decide(false)}
                  aria-label={`Refuser le lien « ${link.label} » entre ${link.a.title} et ${link.b.title}`}
                  className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-surface-raised"
                >
                  ✗
                </button>
              </>
            ) : null}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}
