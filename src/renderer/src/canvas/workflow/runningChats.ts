import { create } from 'zustand'

/**
 * Conversations où Claude est en train de répondre (spec 023 D21) : une tâche Workflow dont la conversation de nœud
 * tourne s'allume « en cours » le temps du tour, sans rien écrire dans le projet. Un tour commence au premier texte ou
 * outil reçu ; il finit à sa fin, interrompue ou en erreur.
 */
interface RunningChats {
  readonly running: ReadonlySet<string>
  mark(neuronId: string, running: boolean): void
}

export const useRunningChats = create<RunningChats>((set) => ({
  running: new Set(),
  mark: (neuronId, running) =>
    set((state) => {
      if (state.running.has(neuronId) === running) return state
      const next = new Set(state.running)
      if (running) next.add(neuronId)
      else next.delete(neuronId)
      return { running: next }
    })
}))

const neuronOf = (payload: unknown): string | null =>
  typeof payload === 'object' && payload !== null && 'neuronId' in payload && typeof payload.neuronId === 'string'
    ? payload.neuronId
    : null

/** Suit les tours de toutes les conversations ; renvoie de quoi arrêter l'écoute. */
export function watchRunningChats(): () => void {
  const { mark } = useRunningChats.getState()
  const follow = (running: boolean) => (payload: unknown) => {
    const neuronId = neuronOf(payload)
    if (neuronId !== null) mark(neuronId, running)
  }
  const offs = [
    window.api.on('chat:delta', follow(true)),
    window.api.on('chat:tool', follow(true)),
    window.api.on('chat:turnEnd', follow(false)),
    window.api.on('chat:error', follow(false))
  ]
  return () => {
    for (const off of offs) off()
  }
}
