import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { call, IpcFailure } from '../lib/ipc'

export type UndoOutcome = { readonly ok: true } | { readonly ok: false; readonly message: string }

/** Données touchées par une annulation : carte, plongée, aperçus, historique, À valider. */
const AFFECTED = [['canvas'], ['dive'], ['synthesis'], ['history'], ['pending']]

/** Annule un lot d'historique (FR-024) et rafraîchit l'interface ; un conflit est expliqué. */
export function useUndo(): (batchId: string) => Promise<UndoOutcome> {
  const client = useQueryClient()
  return useCallback(
    async (batchId) => {
      try {
        await call('history:undo', { batchId })
        await Promise.all(AFFECTED.map((queryKey) => client.invalidateQueries({ queryKey })))
        return { ok: true }
      } catch (error) {
        if (error instanceof IpcFailure && error.code === 'UNDO_CONFLICT') {
          const conflicts = error.details?.['conflicts']
          const detail = Array.isArray(conflicts) ? ` ${conflicts.join(' ')}` : ''
          return { ok: false, message: `${error.message}${detail}` }
        }
        return { ok: false, message: error instanceof IpcFailure ? error.message : 'L’annulation a échoué.' }
      }
    },
    [client]
  )
}
