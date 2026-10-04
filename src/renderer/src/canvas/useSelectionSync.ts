import { useOnSelectionChange } from '@xyflow/react'
import { useCallback, useEffect, useRef } from 'react'
import { SELECTION_MAX } from '@shared/ipc/mcp'
import { call } from '../lib/ipc'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Regroupe les changements rapides (sélection au lasso) en un seul envoi. */
export const SELECTION_DEBOUNCE_MS = 150

/**
 * Tient le main informé de la sélection de la carte (spec 007 FR-006) : Claude la lit par `selection_lire`.
 * Seuls les éléments de la carte (idées, blocs) sont transmis — pas les étapes ni l'arbre d'une idée ouverte.
 */
export function useSelectionSync(): void {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const last = useRef('')

  const onChange = useCallback(({ nodes }: { nodes: readonly { readonly id: string }[] }) => {
    const ids = nodes
      .map((node) => node.id)
      .filter((id) => UUID.test(id))
      .slice(0, SELECTION_MAX)
    const signature = ids.join(',')
    if (signature === last.current) return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      last.current = signature
      call('map:selection', { ids }).catch(() => undefined)
    }, SELECTION_DEBOUNCE_MS)
  }, [])

  useOnSelectionChange({ onChange })
  useEffect(() => () => clearTimeout(timer.current), [])
}
