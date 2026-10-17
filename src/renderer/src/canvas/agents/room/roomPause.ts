/**
 * Chambres de la carte figées en vue lointaine (demande de mentalyas, 2026-10-17) : elles gardent leur dernière image.
 * Module sans dépendance, pour que la carte le règle sans charger le moteur 3D (`roomStage`, chargé avec un agent).
 */
let paused = false
const listeners = new Set<(paused: boolean) => void>()

export const mapRoomsPaused = (): boolean => paused

export function pauseMapRooms(next: boolean): void {
  if (next === paused) return
  paused = next
  for (const listener of listeners) listener(next)
}

/** Prévenu à chaque changement ; rend la fonction qui se désabonne. */
export function onMapRoomsPause(listener: (paused: boolean) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
