import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { create } from 'zustand'
import type { IdeaPart, InputSourceKind, WidgetIoStateView } from '@shared/ipc/widgetIo'
import { useUiStore } from '../app/uiStore'
import { call, IpcFailure } from '../lib/ipc'

/** Widget dont la revue (code + ce qu'il lit) est ouverte ; une seule à la fois. */
export const useWidgetReview = create<{
  readonly blockId: string | null
  open(blockId: string): void
  close(): void
}>((set) => ({
  blockId: null,
  open: (blockId) => set({ blockId }),
  close: () => set({ blockId: null })
}))

export const widgetIoKey = (blockId: string): readonly string[] => ['widgetIo', blockId]

export interface WidgetIoActions {
  readonly state: UseQueryResult<WidgetIoStateView>
  /** Branche une idée ou une prochaine étape ; `true` si c'est fait (la revue s'ouvre alors). */
  connect(sourceKind: InputSourceKind, sourceId: string): Promise<boolean>
  setParts(inputId: string, parts: readonly IdeaPart[]): Promise<void>
  disconnect(inputId: string): Promise<void>
  approve(): Promise<boolean>
}

/** Entrées d'un widget (spec 005 lot 1) : branchements, parties transmises, autorisation de la version affichée. */
export function useWidgetIo(blockId: string): WidgetIoActions {
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  const state = useQuery({
    queryKey: widgetIoKey(blockId),
    queryFn: () => call<WidgetIoStateView>('widgetIo:state', { blockId })
  })

  /** Applique l'état renvoyé par le main ; la carte (traits) et les données remises au cadre suivent. */
  const apply = useCallback(
    async (next: WidgetIoStateView): Promise<void> => {
      client.setQueryData(widgetIoKey(blockId), next)
      await Promise.all([
        client.invalidateQueries({ queryKey: ['canvas'] }),
        client.invalidateQueries({ queryKey: ['widgetInputs', blockId] })
      ])
    },
    [client, blockId]
  )

  const run = useCallback(
    async (work: () => Promise<WidgetIoStateView>, failure: string): Promise<boolean> => {
      try {
        await apply(await work())
        return true
      } catch (error) {
        showToast(error instanceof IpcFailure ? error.message : failure)
        return false
      }
    },
    [apply, showToast]
  )

  return useMemo(
    (): WidgetIoActions => ({
      state,
      connect: (sourceKind, sourceId) =>
        run(
          () => call<WidgetIoStateView>('widgetIo:connect', { blockId, sourceKind, sourceId }),
          'Le branchement n’a pas pu être créé.'
        ),
      setParts: async (inputId, parts) => {
        await run(
          () => call<WidgetIoStateView>('widgetIo:setParts', { inputId, parts }),
          'Le choix n’a pas pu être enregistré.'
        )
      },
      disconnect: async (inputId) => {
        try {
          const { batchId } = await call<{ readonly batchId: string }>('widgetIo:disconnect', { inputId })
          showToast('Entrée débranchée.', { batchId, undoneText: 'Entrée rebranchée.' })
          await Promise.all([
            client.invalidateQueries({ queryKey: widgetIoKey(blockId) }),
            client.invalidateQueries({ queryKey: ['widgetInputs', blockId] }),
            client.invalidateQueries({ queryKey: ['canvas'] }),
            client.invalidateQueries({ queryKey: ['history'] })
          ])
        } catch (error) {
          showToast(error instanceof IpcFailure ? error.message : 'L’entrée n’a pas pu être débranchée.')
        }
      },
      approve: () =>
        run(
          () => call<WidgetIoStateView>('widgetIo:approve', { blockId }),
          'L’autorisation n’a pas pu être enregistrée.'
        )
    }),
    [state, run, blockId, client, showToast]
  )
}
