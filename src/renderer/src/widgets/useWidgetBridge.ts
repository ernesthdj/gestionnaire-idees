import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react'
import type { WidgetEmitView, WidgetInputsView } from '@shared/ipc/widgetIo'
import { call, IpcFailure } from '../lib/ipc'
import { createThrottle } from './emitThrottle'

export const widgetResultKey = (resultBlockId: string): readonly string[] => ['widgetResult', resultBlockId]

/**
 * Canal `postMessage` avec UN cadre isolé (spec 005 FR-004) :
 * - le cadre est reconnu par sa fenêtre (`event.source`), jamais par son origine (elle est opaque) ;
 * - seuls les messages du contrat sont écoutés (« prêt », et « résultat » si `onOutput` est fourni) ;
 * - les entrées sont remises quand le cadre est prêt, puis à chaque changement.
 * Renvoie de quoi signaler au cadre un résultat refusé.
 */
export function useFrameChannel(
  frame: RefObject<HTMLIFrameElement | null>,
  inputs: readonly unknown[] | undefined,
  onOutput?: (data: unknown) => void
): (message: string) => void {
  const ready = useRef(false)

  const post = useCallback(
    (message: Readonly<Record<string, unknown>>): void => {
      // Origine opaque (bac à sable sans même origine) : la cible est la fenêtre du cadre, pas une origine.
      frame.current?.contentWindow?.postMessage(message, '*')
    },
    [frame]
  )

  const send = useCallback((): void => {
    if (inputs !== undefined) post({ type: 'gi:inputs', inputs })
  }, [post, inputs])

  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      const current = frame.current
      if (current === null || event.source !== current.contentWindow) return
      const message: unknown = event.data
      if (typeof message !== 'object' || message === null || !('type' in message)) return
      if (message.type === 'gi:ready') {
        ready.current = true
        send()
      } else if (message.type === 'gi:output' && onOutput !== undefined && 'data' in message) {
        onOutput(message.data)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [frame, send, onOutput])

  // Les données changent (autorisation donnée, partie décochée, relance) : le cadre déjà prêt les reçoit aussitôt.
  useEffect(() => {
    if (ready.current) send()
  }, [send])

  return useCallback((message: string): void => post({ type: 'gi:refused', message }), [post])
}

/**
 * Pont entre l'application et le cadre isolé d'un widget. Le main décide de ce qui est remis (rien sans
 * autorisation) et de ce qui est gardé d'un résultat (bornes) ; ici on ne fait que relayer vers et depuis LE cadre
 * de ce widget. Les résultats émis en rafale sont regroupés.
 */
export function useWidgetBridge(
  frame: RefObject<HTMLIFrameElement | null>,
  blockId: string,
  versionId: string | null,
  /** Compteur de relance : relancer le widget relit aussi ses entrées (idées modifiées entre-temps). */
  run: number
): WidgetInputsView | undefined {
  const client = useQueryClient()
  const inputs = useQuery({
    queryKey: ['widgetInputs', blockId, versionId, run],
    queryFn: () => call<WidgetInputsView>('widgetIo:inputs', { blockId, versionId }),
    enabled: versionId !== null
  })
  const data = inputs.data
  const refuse = useRef<(message: string) => void>(() => undefined)

  const throttle = useMemo(
    () =>
      createThrottle((result: unknown): void => {
        void call<WidgetEmitView>('widgetIo:emit', { blockId, versionId, data: result })
          .then((emitted) =>
            Promise.all([
              client.invalidateQueries({ queryKey: widgetResultKey(emitted.resultBlockId) }),
              emitted.created ? client.invalidateQueries({ queryKey: ['canvas'] }) : undefined
            ])
          )
          .catch((error: unknown) => {
            refuse.current(error instanceof IpcFailure ? error.message : 'Le résultat n’a pas pu être enregistré.')
          })
      }),
    [client, blockId, versionId]
  )
  useEffect(() => () => throttle.cancel(), [throttle])

  const onOutput = useCallback((result: unknown): void => throttle.push(result), [throttle])
  const refuseNow = useFrameChannel(frame, data?.inputs, onOutput)
  useEffect(() => {
    refuse.current = refuseNow
  }, [refuseNow])

  return data
}
