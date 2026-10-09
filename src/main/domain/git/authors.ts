import { createHmac } from 'node:crypto'
import type { AuthorView } from '@shared/git/model'

/**
 * Auteurs des commits (spec 021 research R13, FR-028) : une **clé** stable par e-mail (HMAC avec le secret de l'app,
 * jamais l'e-mail lui-même) ; le nom, l'e-mail et les initiales ne vont qu'au renderer, jamais en base ni vers Claude.
 * Pur (le secret est fourni).
 */

/** Clé d'un auteur : HMAC-SHA256 de l'e-mail normalisé, 16 caractères hexadécimaux. */
export function authorKey(secret: string, email: string): string {
  return createHmac('sha256', secret).update(email.trim().toLowerCase()).digest('hex').slice(0, 16)
}

/** Initiales d'un nom (« Alice Fictive » → « AF », « bob » → « B »). */
export function initialsOf(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word !== '')
  const letters = words
    .slice(0, 2)
    .map((word) => (word.normalize('NFD').replace(/\p{Diacritic}/gu, '')[0] ?? '').toUpperCase())
  return letters.join('') || '?'
}

/**
 * Palette des auteurs (spec 021 T040, GD-1) : 12 teintes distinctes, contraste ≥ 3:1 sur le fond clair, le sombre et le
 * carbone (vérifié par test). La couleur n'est jamais seule : les initiales l'accompagnent.
 */
export const AUTHOR_PALETTE = [
  '#2563eb',
  '#ea580c',
  '#16a34a',
  '#9333ea',
  '#e11d48',
  '#0891b2',
  '#b45309',
  '#4d7c0f',
  '#c026d3',
  '#0d9488',
  '#6366f1',
  '#db2777'
] as const

/** Couleur stable tirée de la clé. */
export function colorOf(key: string): string {
  return AUTHOR_PALETTE[Number.parseInt(key.slice(0, 4), 16) % AUTHOR_PALETTE.length] ?? AUTHOR_PALETTE[0]
}

/** Clé principale d'un auteur après fusion d'identités (`aliases` : clé secondaire → clé principale). */
export const mainKeyOf = (key: string, aliases: ReadonlyMap<string, string>): string => aliases.get(key) ?? key

/** Pseudonymes pour Claude (« Auteur A », « Auteur B »… dans l'ordre d'apparition), jamais un nom ni un e-mail. */
export function pseudonyms(keys: readonly string[]): Map<string, string> {
  const result = new Map<string, string>()
  for (const key of keys) {
    if (result.has(key)) continue
    const index = result.size
    const letters =
      index < 26
        ? String.fromCharCode(65 + index)
        : `${String.fromCharCode(65 + (index % 26))}${Math.floor(index / 26)}`
    result.set(key, `Auteur ${letters}`)
  }
  return result
}

/** Vues d'auteurs dédoublonnées par clé (la première identité rencontrée donne le nom affiché). */
export function authorViews(
  secret: string,
  authors: readonly { readonly name: string; readonly email: string }[]
): AuthorView[] {
  const byKey = new Map<string, AuthorView>()
  for (const author of authors) {
    const key = authorKey(secret, author.email)
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        name: author.name,
        email: author.email,
        initials: initialsOf(author.name),
        color: colorOf(key)
      })
    }
  }
  return [...byKey.values()]
}
