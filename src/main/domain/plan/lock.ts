import { AppError } from '../errors'

/** Raison donnée à mentalyas comme à Claude quand une écriture vise un nœud verrouillé (spec 011 FR-011). */
export const LOCKED_MESSAGE = 'Ce nœud est verrouillé : ses sous-nœuds s’appuient sur son contexte.'

/** Garde unique de tous les chemins d'écriture du contexte d'un nœud (fiche, titre, description, maturité). */
export function assertUnlocked(neuron: { readonly lockedAt: string | null }): void {
  if (neuron.lockedAt !== null) throw new AppError('LOCKED', LOCKED_MESSAGE)
}
