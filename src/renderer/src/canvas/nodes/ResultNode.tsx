import { useQuery } from '@tanstack/react-query'
import { NodeResizer, type NodeProps } from '@xyflow/react'
import { useMemo, useRef, useState } from 'react'
import { BLOCK_LIMITS } from '@shared/ipc/canvas'
import type { ResultFrameInput, WidgetResultView } from '@shared/ipc/widgetIo'
import { useEffectiveSettings } from '../../app/useAppSettings'
import { call } from '../../lib/ipc'
import { useFrameChannel, widgetResultKey } from '../../widgets/useWidgetBridge'
import { resolvedScheme, resultFrameUrl } from '../../widgets/widgetFrame'
import type { ResultNodeType } from '../buildGraph'
import { useBlockActions } from '../useBlockActions'

const LIMITS = BLOCK_LIMITS.result

/**
 * Cadre résultat (spec 005 US2) : affiche le dernier résultat publié par son widget, dans une vue générique
 * (valeur, liste, tableau, arbre). Aussi isolé qu'un widget — même bac à sable, et il ne reçoit que ce résultat.
 * Il se déplace, se redimensionne et se supprime comme tout bloc ; la prochaine émission du widget le recrée.
 */
export function ResultNode({ id, selected, dragging }: NodeProps<ResultNodeType>): React.JSX.Element {
  const blockActions = useBlockActions()
  const settings = useEffectiveSettings()
  const scheme = resolvedScheme(settings.theme)
  const [resizing, setResizing] = useState(false)
  const result = useQuery({
    queryKey: widgetResultKey(id),
    queryFn: () => call<WidgetResultView>('widgetIo:result', { blockId: id })
  })
  const view = result.data
  const inputs = useMemo(
    (): readonly ResultFrameInput[] | undefined =>
      view === undefined ? undefined : [{ kind: 'result', data: view.data }],
    [view]
  )
  const frame = useRef<HTMLIFrameElement>(null)
  useFrameChannel(frame, inputs)
  const title = view?.widgetTitle === null || view === undefined ? 'Résultat' : `Résultat · ${view.widgetTitle}`

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={LIMITS.minWidth}
        minHeight={LIMITS.minHeight}
        maxWidth={LIMITS.maxWidth}
        maxHeight={LIMITS.maxHeight}
        onResizeStart={() => setResizing(true)}
        onResizeEnd={(_event, box) => {
          setResizing(false)
          void blockActions.save(id, box)
        }}
      />
      <section
        aria-label={title}
        className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-accent/60 bg-surface text-content shadow-lg"
      >
        <header className="flex h-8 shrink-0 cursor-grab items-center gap-1 border-b border-content-muted/20 bg-surface-raised px-2 text-xs active:cursor-grabbing">
          <span aria-hidden="true">⇥</span>
          <span className="flex-1 truncate font-semibold">{title}</span>
          <button
            type="button"
            aria-label="Supprimer le cadre résultat"
            title="Supprimer (le widget le recrée à son prochain résultat)"
            onClick={() => void blockActions.remove(id, 'result')}
            className="nodrag flex h-7 w-7 items-center justify-center rounded-md hover:bg-surface"
          >
            ×
          </button>
        </header>
        {result.isError ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-center text-xs text-content-muted">
            Ce résultat n’a pas pu être chargé.
          </div>
        ) : (
          <iframe
            ref={frame}
            key={scheme}
            title={title}
            src={resultFrameUrl(id, scheme)}
            // Même bac à sable qu'un widget : scripts seulement, aucun réseau (CSP du document).
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            allow=""
            className={`nodrag nowheel min-h-0 w-full flex-1 border-0 bg-surface ${resizing || dragging ? 'pointer-events-none' : ''}`}
          />
        )}
      </section>
    </>
  )
}
