import { create } from 'zustand'

/**
 * Conversations où une demande de permission attend ta réponse (audit 2026-10-11) : le nœud de la conversation le
 * montre sur la carte, même quand sa carte de conversation est fermée, petite ou hors de l'écran. Une demande sort de
 * l'attente quand elle est tranchée ; toutes sortent à la fin du tour, interrompu ou en erreur.
 */
interface WaitingChats {
  /** Demandes en attente, par neurone de conversation. */
  readonly waiting: ReadonlyMap<string, ReadonlySet<string>>
  add(neuronId: string, requestId: string): void
  resolve(neuronId: string, requestId: string): void
  clear(neuronId: string): void
}

export const useWaitingChats = create<WaitingChats>((set) => {
  const update = (neuronId: string, change: (ids: Set<string>) => void) =>
    set((state) => {
      const ids = new Set(state.waiting.get(neuronId))
      change(ids)
      const next = new Map(state.waiting)
      if (ids.size === 0) next.delete(neuronId)
      else next.set(neuronId, ids)
      return { waiting: next }
    })
  return {
    waiting: new Map(),
    add: (neuronId, requestId) => update(neuronId, (ids) => ids.add(requestId)),
    resolve: (neuronId, requestId) => update(neuronId, (ids) => ids.delete(requestId)),
    clear: (neuronId) => update(neuronId, (ids) => ids.clear())
  }
})

const field = (payload: unknown, key: string): string | null => {
  if (typeof payload !== 'object' || payload === null || !(key in payload)) return null
  const value = (payload as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : null
}

/** Suit les demandes de permission de toutes les conversations ; renvoie de quoi arrêter l'écoute. */
export function watchWaitingChats(): () => void {
  const { add, resolve, clear } = useWaitingChats.getState()
  const ended = (payload: unknown): void => {
    const neuronId = field(payload, 'neuronId')
    if (neuronId !== null) clear(neuronId)
  }
  const offs = [
    window.api.on('chat:permission', (payload) => {
      const neuronId = field(payload, 'neuronId')
      const requestId = field(payload, 'id')
      if (neuronId !== null && requestId !== null) add(neuronId, requestId)
    }),
    window.api.on('chat:permissionResolved', (payload) => {
      const neuronId = field(payload, 'neuronId')
      const requestId = field(payload, 'requestId')
      if (neuronId !== null && requestId !== null) resolve(neuronId, requestId)
    }),
    window.api.on('chat:turnEnd', ended),
    window.api.on('chat:error', ended)
  ]
  return () => {
    for (const off of offs) off()
  }
}
