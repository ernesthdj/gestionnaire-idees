import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, type RefObject } from 'react'
import type { WidgetInputsView } from '@shared/ipc/widgetIo'
import { call } from '../lib/ipc'

/**
 * Pont entre l'application et le cadre isolé d'un widget (spec 005 FR-004). Le main décide de ce qui est remis
 * (rien sans autorisation) ; ici on ne fait que relayer vers LE cadre de ce widget :
 * - le cadre est reconnu par sa fenêtre (`event.source`), jamais par son origine (elle est opaque) ;
 * - seul le message « prêt » du cadre est écouté ; tout autre message est ignoré.
 */
export function useWidgetBridge(
  frame: RefObject<HTMLIFrameElement | null>,
  blockId: string,
  versionId: string | null,
  /** Compteur de relance : relancer le widget relit aussi ses entrées (idées modifiées entre-temps). */
  run: number
): WidgetInputsView | undefined {
  const inputs = useQuery({
    queryKey: ['widgetInputs', blockId, versionId, run],
    queryFn: () => call<WidgetInputsView>('widgetIo:inputs', { blockId, versionId }),
    enabled: versionId !== null
  })
  const data = inputs.data
  const ready = useRef(false)

  const send = useCallback((): void => {
    const target = frame.current?.contentWindow
    if (target === null || target === undefined || data === undefined) return
    // Origine opaque (bac à sable sans même origine) : la cible est la fenêtre du cadre, pas une origine.
    target.postMessage({ type: 'gi:inputs', inputs: data.inputs }, '*')
  }, [frame, data])

  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      const current = frame.current
      if (current === null || event.source !== current.contentWindow) return
      const message: unknown = event.data
      if (typeof message !== 'object' || message === null || !('type' in message) || message.type !== 'gi:ready') return
      ready.current = true
      send()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [frame, send])

  // Les données changent (autorisation donnée, partie décochée, relance) : le cadre déjà prêt les reçoit aussitôt.
  useEffect(() => {
    if (ready.current) send()
  }, [send])

  return data
}
