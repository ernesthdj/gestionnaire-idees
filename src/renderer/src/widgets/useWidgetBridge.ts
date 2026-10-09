import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react'
import type { WidgetEmitView, WidgetInputsView } from '@shared/ipc/widgetIo'
import { call, IpcFailure } from '../lib/ipc'
import { createThrottle } from './emitThrottle'

export const widgetResultKey = (resultBlockId: string): readonly string[] => ['widgetResult', resultBlockId]
export const widgetStateKey = (blockId: string): readonly string[] => ['widgetState', blockId]

/** État d'un widget (spec 026) : celui à remettre au cadre, et où envoyer ce qu'il enregistre. */
interface StateChannel {
  /** `undefined` tant que l'état n'est pas lu ; `null` si le widget n'en a pas. */
  readonly state: unknown
  readonly onSave: (data: unknown) => void
}

/**
 * Canal `postMessage` avec UN cadre isolé (spec 005 FR-004) :
 * - le cadre est reconnu par sa fenêtre (`event.source`), jamais par son origine (elle est opaque) ;
 * - seuls les messages du contrat sont écoutés (« prêt », « résultat » si `onOutput` est fourni, « état » si
 *   `stateChannel` l'est) ;
 * - l'état est remis une fois le cadre prêt (spec 026), les entrées quand le cadre est prêt puis à chaque changement.
 * Renvoie de quoi signaler au cadre un résultat ou un état refusé.
 */
export function useFrameChannel(
  frame: RefObject<HTMLIFrameElement | null>,
  inputs: readonly unknown[] | undefined,
  onOutput?: (data: unknown) => void,
  stateChannel?: StateChannel
): (message: string) => void {
  const ready = useRef(false)
  const state = stateChannel?.state
  const onSave = stateChannel?.onSave

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

  // Le cadre ne garde que le premier état reçu : le renvoyer (état lu après « prêt ») ne change rien ensuite.
  const sendState = useCallback((): void => {
    if (state !== undefined) post({ type: 'gi:state', state })
  }, [post, state])

  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      const current = frame.current
      if (current === null || event.source !== current.contentWindow) return
      const message: unknown = event.data
      if (typeof message !== 'object' || message === null || !('type' in message)) return
      if (message.type === 'gi:ready') {
        ready.current = true
        sendState()
        send()
      } else if (message.type === 'gi:output' && onOutput !== undefined && 'data' in message) {
        onOutput(message.data)
      } else if (message.type === 'gi:saveState' && onSave !== undefined && 'data' in message) {
        onSave(message.data)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [frame, send, sendState, onOutput, onSave])

  // Les données changent (autorisation donnée, partie décochée, relance) : le cadre déjà prêt les reçoit aussitôt.
  useEffect(() => {
    if (ready.current) send()
  }, [send])
  useEffect(() => {
    if (ready.current) sendState()
  }, [sendState])

  return useCallback((message: string): void => post({ type: 'gi:refused', message }), [post])
}

/**
 * Pont entre l'application et le cadre isolé d'un widget. Le main décide de ce qui est remis (rien sans
 * autorisation) et de ce qui est gardé d'un résultat ou d'un état (bornes) ; ici on ne fait que relayer vers et depuis
 * LE cadre de ce widget. Les résultats et les états émis en rafale sont regroupés ; l'état en attente part à la
 * fermeture.
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
  // L'état n'est relu qu'à l'ouverture : ensuite le cache suit ce que le widget enregistre.
  const saved = useQuery({
    queryKey: widgetStateKey(blockId),
    queryFn: () => call<{ readonly state: unknown }>('widgetIo:savedState', { blockId }),
    enabled: versionId !== null,
    staleTime: Infinity
  })
  const data = inputs.data
  const refuse = useRef<(message: string) => void>(() => undefined)
  const report = useCallback(
    (error: unknown, fallback: string): void => refuse.current(error instanceof IpcFailure ? error.message : fallback),
    []
  )

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
          .catch((error: unknown) => report(error, 'Le résultat n’a pas pu être enregistré.'))
      }),
    [client, blockId, versionId, report]
  )
  useEffect(() => () => throttle.cancel(), [throttle])

  const stateThrottle = useMemo(
    () =>
      createThrottle((state: unknown): void => {
        client.setQueryData(widgetStateKey(blockId), { state })
        void call('widgetIo:saveState', { blockId, data: state }).catch((error: unknown) =>
          report(error, 'L’état n’a pas pu être enregistré.')
        )
      }),
    [client, blockId, report]
  )
  useEffect(() => () => stateThrottle.flush(), [stateThrottle])

  const onOutput = useCallback((result: unknown): void => throttle.push(result), [throttle])
  const onSave = useCallback((state: unknown): void => stateThrottle.push(state), [stateThrottle])
  const stateChannel = useMemo(() => ({ state: saved.data?.state, onSave }), [saved.data, onSave])
  const refuseNow = useFrameChannel(frame, data?.inputs, onOutput, stateChannel)
  useEffect(() => {
    refuse.current = refuseNow
  }, [refuseNow])

  return data
}
