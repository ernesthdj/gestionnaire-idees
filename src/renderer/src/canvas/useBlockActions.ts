import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import type { BlockKind } from '@shared/ipc/canvas'
import { useUiStore } from '../app/uiStore'
import { call, IpcFailure } from '../lib/ipc'

export interface Box {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface BlockActions {
  /** Enregistre la place, la taille et, pour une note, le texte ; la carte se rafraîchit. */
  save(id: string, box: Box, text?: string): Promise<boolean>
  /** Supprime le bloc et propose « Annuler » (l'historique le restaure avec son contenu). */
  remove(id: string, kind: BlockKind): Promise<void>
}

const NAMES: Readonly<Record<BlockKind, { readonly removed: string; readonly restored: string }>> = {
  empty: { removed: 'Bloc supprimé.', restored: 'Bloc restauré.' },
  label: { removed: 'Note supprimée.', restored: 'Note restaurée.' },
  widget: { removed: 'Widget supprimé.', restored: 'Widget restauré, avec ses versions.' },
  result: { removed: 'Cadre résultat supprimé.', restored: 'Cadre résultat restauré.' },
  note: { removed: 'Note supprimée.', restored: 'Note restaurée.' },
  frame: { removed: 'Cadre supprimé.', restored: 'Cadre restauré.' }
}

/** Actions communes aux blocs de la carte : bloc vide, note, widget (spec 004), cadre résultat (spec 005). */
export function useBlockActions(): BlockActions {
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)

  const save = useCallback(
    async (id: string, box: Box, text?: string): Promise<boolean> => {
      try {
        await call('canvas:updateBlock', {
          id,
          x: Math.round(box.x),
          y: Math.round(box.y),
          width: Math.round(box.width),
          height: Math.round(box.height),
          ...(text === undefined ? {} : { text })
        })
        await client.invalidateQueries({ queryKey: ['canvas'] })
        return true
      } catch (error) {
        showToast(error instanceof IpcFailure ? error.message : 'La modification n’a pas pu être enregistrée.')
        return false
      }
    },
    [client, showToast]
  )

  const remove = useCallback(
    async (id: string, kind: BlockKind): Promise<void> => {
      try {
        const { batchId } = await call<{ readonly batchId: string }>('canvas:deleteBlock', { id })
        showToast(NAMES[kind].removed, { batchId, undoneText: NAMES[kind].restored })
        await Promise.all([
          client.invalidateQueries({ queryKey: ['canvas'] }),
          client.invalidateQueries({ queryKey: ['history'] })
        ])
      } catch (error) {
        showToast(error instanceof IpcFailure ? error.message : 'Le bloc n’a pas pu être supprimé.')
      }
    },
    [client, showToast]
  )

  return useMemo(() => ({ save, remove }), [save, remove])
}
