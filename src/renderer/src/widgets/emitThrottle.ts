/** Écart minimal entre deux écritures du résultat d'un widget (spec 005 : émissions en rafale regroupées). */
export const EMIT_INTERVAL_MS = 500

export interface Throttle<T> {
  push(value: T): void
  cancel(): void
  /** Envoie tout de suite la valeur en attente (fermeture du widget : rien n'est perdu). */
  flush(): void
}

/**
 * Regroupe des valeurs qui arrivent en rafale : la première part aussitôt, puis au plus une par intervalle — la
 * dernière reçue, les intermédiaires étant remplacées (seul le dernier résultat compte).
 */
export function createThrottle<T>(run: (value: T) => void, intervalMs: number = EMIT_INTERVAL_MS): Throttle<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: { readonly value: T } | null = null

  const open = (): void => {
    timer = setTimeout(() => {
      timer = null
      if (pending === null) return
      const { value } = pending
      pending = null
      open()
      run(value)
    }, intervalMs)
  }

  return {
    push(value) {
      if (timer !== null) {
        pending = { value }
        return
      }
      open()
      run(value)
    },
    cancel() {
      if (timer !== null) clearTimeout(timer)
      timer = null
      pending = null
    },
    flush() {
      const waiting = pending
      this.cancel()
      if (waiting !== null) run(waiting.value)
    }
  }
}
