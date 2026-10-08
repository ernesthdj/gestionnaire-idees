import type { ChatMessageView } from '@shared/ipc/chat'

/**
 * Ce que Claude est en train de faire, tiré de ses dernières actions (pastilles d'outils) depuis le dernier message de
 * mentalyas : fonction pure. L'indicateur de réflexion affiche cette activité réelle plutôt qu'une suite de libellés
 * au hasard. `program` choisit le motif lumineux de l'orbe.
 */
export type ThinkingPhase = 'reflexion' | 'lecture' | 'recherche' | 'commande' | 'ecriture'

export const PHASE_LABELS: Readonly<Record<ThinkingPhase, string>> = {
  reflexion: 'Réflexion',
  lecture: 'Lecture',
  recherche: 'Recherche',
  commande: 'Commande',
  ecriture: 'Écriture'
}

/** Motif lumineux de l'orbe (0 : tête qui tourne, 1 : deux taches, 2 : bande, 3 : tête rapide). */
export const PHASE_PROGRAMS: Readonly<Record<ThinkingPhase, 0 | 1 | 2 | 3>> = {
  reflexion: 0,
  lecture: 1,
  recherche: 1,
  commande: 2,
  ecriture: 3
}

/** Début des libellés d'outils écrits par le main (`toolLabel`, streamEvents.ts). */
const RULES: readonly (readonly [RegExp, ThinkingPhase])[] = [
  [/^(recherche|page web lue)/, 'recherche'],
  [
    /^(fichier écrit|fichier modifié|carnet modifié|fiche mise à jour|a dessiné|élément modifié|lien créé|widget posé)/,
    'ecriture'
  ],
  [/^commande/, 'commande'],
  [/^(fichier lu|fichiers listés|graphe du code lu|élément lu|carte|contexte relu|sélection lue)/, 'lecture']
]

export function thinkingPhase(messages: readonly ChatMessageView[]): ThinkingPhase {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index] as ChatMessageView
    if (message.role === 'user') return 'reflexion'
    if (message.role !== 'tool') continue
    const text = message.text.toLowerCase()
    return RULES.find(([pattern]) => pattern.test(text))?.[1] ?? 'reflexion'
  }
  return 'reflexion'
}
