import { createHmac } from 'node:crypto'

/**
 * Empreintes et pseudonymes de la sonde (spec 019 R3) : HMAC-SHA256 à clé locale. Sans la clé, une empreinte ne
 * permet ni de relire ni de deviner par dictionnaire un texte court ; avec la même clé, la même entrée donne
 * toujours la même empreinte (repérer un travail d'IA refait).
 */

export const FINGERPRINT_LENGTH = 16
export const PSEUDONYM_LENGTH = 12

/** JSON canonique : clés triées à toute profondeur, chaînes sans espaces de bord. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value))
}

function normalize(value: unknown): unknown {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return value.map(normalize)
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return Object.fromEntries(entries.map(([key, item]) => [key, normalize(item)]))
  }
  return value
}

function hmac(key: string, text: string, length: number): string {
  return createHmac('sha256', key).update(text, 'utf8').digest('hex').slice(0, length)
}

/** Empreinte d'un travail d'IA : tâche, version de la consigne et entrée (le modèle n'en fait pas partie). */
export function fingerprint(key: string, kind: string, frameVersion: string, payload: unknown): string {
  return hmac(key, `${kind}\u0000${frameVersion}\u0000${canonicalJson(payload)}`, FINGERPRINT_LENGTH)
}

/** Pseudonyme stable d'un objet, sans lien calculable avec la base sans la clé. */
export function pseudonym(key: string, id: string): string {
  return hmac(key, `ref:${id}`, PSEUDONYM_LENGTH)
}
