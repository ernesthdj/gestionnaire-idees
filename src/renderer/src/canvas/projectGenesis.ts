import type { CanvasNeuronView } from '@shared/ipc/canvas'

/**
 * Genesis sur lequel « Recentrer » ramène la vue (spec 024 D20) : celui lié au dossier de projet, à défaut le premier
 * éclos, sinon le premier ; `null` sur une carte vide.
 */
export function projectGenesisOf(ideas: readonly CanvasNeuronView[]): CanvasNeuronView | null {
  return (
    ideas.find((idea) => idea.linkedProject === true) ??
    ideas.find((idea) => idea.state === 'hatched') ??
    ideas[0] ??
    null
  )
}
