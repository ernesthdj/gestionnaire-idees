/**
 * Cycle de vie d'une action finale (spec 013 data-model) : proposée → prête → en cours ↔ à revoir ; « fait » se lit
 * dans le statut de l'étape. `archived` : la ligne quitte la carte (refus, rétrogradation). Fonction pure.
 */

import type { FinalState } from '@shared/ipc/finals'

export type { FinalState }
export type FinalCommand = 'accept' | 'refuse' | 'demote' | 'execute' | 'finish'

const TRANSITIONS: Readonly<Record<FinalState, Partial<Record<FinalCommand, FinalState | 'archived'>>>> = {
  proposee: { accept: 'prete', refuse: 'archived' },
  prete: { execute: 'en_cours', demote: 'archived' },
  en_cours: { finish: 'a_revoir' },
  a_revoir: { execute: 'en_cours', demote: 'archived' }
}

/** État suivant, ou `null` si la commande n'a pas de sens dans cet état. */
export function nextFinalState(state: FinalState, command: FinalCommand): FinalState | 'archived' | null {
  return TRANSITIONS[state][command] ?? null
}
