import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { useUiStore } from '../app/uiStore'
import { call, IpcFailure } from '../lib/ipc'

/**
 * Gestes de mentalyas sur une action finale (spec 013) : accepter ou refuser la proposition de Claude, rétrograder
 * (annulables), lancer ou arrêter l'exécution. Des prérequis pas encore faits ouvrent le volet de l'action, qui
 * propose « Exécuter quand même ».
 */
export function useFinalDecide(): {
  readonly busy: boolean
  decide(neuronId: string, accept: boolean): Promise<void>
  demote(neuronId: string): Promise<void>
  execute(neuronId: string, force?: boolean): Promise<void>
  stop(neuronId: string): Promise<void>
} {
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  const openFinal = useUiStore((state) => state.openFinal)
  const openChat = useUiStore((state) => state.openChat)
  const [busy, setBusy] = useState(false)

  const run = useCallback(
    async (work: () => Promise<void>, failure: string): Promise<void> => {
      setBusy(true)
      try {
        await work()
      } catch (error) {
        showToast(error instanceof IpcFailure ? error.message : failure)
      } finally {
        setBusy(false)
        await Promise.all([
          client.invalidateQueries({ queryKey: ['canvas'] }),
          client.invalidateQueries({ queryKey: ['history'] })
        ])
      }
    },
    [client, showToast]
  )

  const decide = useCallback(
    (neuronId: string, accept: boolean) =>
      run(async () => {
        const result = await call<{ readonly batchId: string | null }>('final:decide', { neuronId, accept })
        if (result.batchId !== null) {
          showToast('Action finale prête : « Exécuter » la lancera.', {
            batchId: result.batchId,
            undoneText: 'Annulé : la proposition attend de nouveau ta décision.'
          })
        }
      }, 'La décision n’a pas pu être enregistrée.'),
    [run, showToast]
  )

  const demote = useCallback(
    (neuronId: string) =>
      run(async () => {
        const result = await call<{ readonly batchId: string }>('final:demote', { neuronId })
        showToast('L’étape redevient une étape ordinaire.', {
          batchId: result.batchId,
          undoneText: 'Annulé : l’action finale est rétablie.'
        })
      }, 'L’action n’a pas pu être rétrogradée.'),
    [run, showToast]
  )

  const execute = useCallback(
    async (neuronId: string, force = false): Promise<void> => {
      setBusy(true)
      try {
        await call('final:execute', force ? { neuronId, force } : { neuronId })
        // La conversation de l'action s'ouvre : on y suit Claude au travail.
        openChat(neuronId)
        showToast('Claude exécute l’action : son livrable apparaîtra sous elle.')
      } catch (error) {
        if (error instanceof IpcFailure && error.code === 'PREREQUISITES') openFinal(neuronId)
        showToast(error instanceof IpcFailure ? error.message : 'L’exécution n’a pas pu démarrer.')
      } finally {
        setBusy(false)
        await client.invalidateQueries({ queryKey: ['canvas'] })
      }
    },
    [client, openChat, openFinal, showToast]
  )

  const stop = useCallback(
    (neuronId: string) =>
      run(async () => {
        await call('final:stop', { neuronId })
      }, 'L’exécution n’a pas pu être arrêtée.'),
    [run]
  )

  return { busy, decide, demote, execute, stop }
}
