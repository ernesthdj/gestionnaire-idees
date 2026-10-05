import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import type { WidgetView } from '@shared/ipc/widgets'
import { useUiStore } from '../app/uiStore'
import { call, IpcFailure } from '../lib/ipc'

/** Moteur annoncé par le main pendant une génération. */
export interface AiWorker {
  readonly engine: 'claude' | 'ollama'
  readonly model: string
}

export interface WidgetActions {
  readonly widget: UseQueryResult<WidgetView>
  /** Claude génère (de l'envoi à la réponse). */
  readonly busy: boolean
  /** Moteur annoncé par le main pendant la génération. */
  readonly worker: AiWorker | null
  prompt(text: string): Promise<boolean>
  restore(versionId: string): Promise<void>
}

function workerOf(payload: unknown, blockId: string): AiWorker | null | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined
  const event = payload as { blockId?: unknown; engine?: unknown; model?: unknown }
  if (event.blockId !== blockId) return undefined
  if (event.engine !== 'claude' && event.engine !== 'ollama') return null
  return { engine: event.engine, model: typeof event.model === 'string' ? event.model : '' }
}

/** Données et actions d'un widget de la carte (spec 004) : conversation, versions, génération par Claude. */
export function useWidget(blockId: string): WidgetActions {
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  const widget = useQuery({ queryKey: ['widget', blockId], queryFn: () => call<WidgetView>('widget:get', { blockId }) })
  const [busy, setBusy] = useState(false)
  const [worker, setWorker] = useState<AiWorker | null>(null)

  useEffect(() => {
    const offs = [
      window.api.on('widget:thinking', (payload) => {
        const announced = workerOf(payload, blockId)
        if (announced === undefined) return
        if (announced !== null) setWorker(announced)
      }),
      window.api.on('widget:thought', (payload) => {
        if (workerOf(payload, blockId) === undefined) return
        setWorker(null)
        void Promise.all([
          client.invalidateQueries({ queryKey: ['widget', blockId] }),
          client.invalidateQueries({ queryKey: ['widgetIo', blockId] })
        ])
      })
    ]
    return () => offs.forEach((off) => off())
  }, [blockId, client])

  const prompt = useCallback(
    async (text: string): Promise<boolean> => {
      setBusy(true)
      try {
        client.setQueryData(['widget', blockId], await call<WidgetView>('widget:prompt', { blockId, text }))
        return true
      } catch (error) {
        showToast(error instanceof IpcFailure ? error.message : 'La demande n’a pas pu être envoyée à Claude.')
        await client.invalidateQueries({ queryKey: ['widget', blockId] })
        return false
      } finally {
        setBusy(false)
        setWorker(null)
      }
    },
    [blockId, client, showToast]
  )

  const restore = useCallback(
    async (versionId: string): Promise<void> => {
      try {
        client.setQueryData(['widget', blockId], await call<WidgetView>('widget:restore', { blockId, versionId }))
      } catch (error) {
        showToast(error instanceof IpcFailure ? error.message : 'La version n’a pas pu être restaurée.')
      }
    },
    [blockId, client, showToast]
  )

  return { widget, busy, worker, prompt, restore }
}
