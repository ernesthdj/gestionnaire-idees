import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { useUiStore } from '../app/uiStore'
import { call, IpcFailure } from '../lib/ipc'
import { probeAction } from '../analyste/probe'
import { flushViewState } from '../home/useBrainstorms'

/**
 * Décision de mentalyas sur une couche proposée par Claude (spec 011) : valider ou refuser des fantômes. Valider
 * verrouille le parent et fait naître les étapes en un lot annulable (« Annuler » dans la notification).
 */
export function usePlanDecide(): {
  readonly busy: boolean
  decide(input: { proposalId: string; accept: readonly string[]; reject: readonly string[] }): Promise<void>
} {
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  const [busy, setBusy] = useState(false)
  const decide = useCallback(
    async (input: { proposalId: string; accept: readonly string[]; reject: readonly string[] }): Promise<void> => {
      setBusy(true)
      try {
        // La vue affichée de chaque carte est relue par le main : l'étape née y est rangée (spec 023 D19).
        await flushViewState()
        const result = await call<{ readonly batchId: string | null; readonly born: readonly string[] }>(
          'plan:decide',
          input
        )
        probeAction('plan.decide', 'step', 'souris', input.proposalId)
        if (result.batchId !== null) {
          const count = result.born.length
          showToast(`${count} étape${count > 1 ? 's' : ''} ajoutée${count > 1 ? 's' : ''} au plan.`, {
            batchId: result.batchId,
            undoneText: 'Annulé : les étapes et le verrou sont retirés.'
          })
        }
        await Promise.all([
          client.invalidateQueries({ queryKey: ['canvas'] }),
          client.invalidateQueries({ queryKey: ['history'] })
        ])
      } catch (error) {
        showToast(error instanceof IpcFailure ? error.message : 'La décision n’a pas pu être enregistrée.')
        await client.invalidateQueries({ queryKey: ['canvas'] })
      } finally {
        setBusy(false)
      }
    },
    [client, showToast]
  )
  return { busy, decide }
}
