import { createHash } from 'node:crypto'

/**
 * Liens entre idées de l'ancien moteur (`neuron_links`, archive depuis la spec 010) : l'Historique sait encore annuler
 * leurs anciens lots.
 */

/** Paire ordonnée (a < b) : un lien n'existe qu'une fois, quel que soit le sens. */
export function orderedPair(first: string, second: string): readonly [string, string] {
  return first < second ? [first, second] : [second, first]
}

function normalizeLabel(label: string): string {
  return label
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** Empreinte d'un lien (paire + libellé normalisé) : un lien refusé n'est jamais reproposé. */
export function linkFingerprint(first: string, second: string, label: string): string {
  const [a, b] = orderedPair(first, second)
  return createHash('sha256')
    .update(`${a}|${b}|${normalizeLabel(label)}`)
    .digest('hex')
}
