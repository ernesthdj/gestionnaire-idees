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

/** Teinte stable tirée de la clé : couleur de l'auteur (la couleur n'est jamais seule, les initiales l'accompagnent). */
export function colorOf(key: string): string {
  const hue = Number.parseInt(key.slice(0, 4), 16) % 360
  return `hsl(${hue} 55% 45%)`
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
