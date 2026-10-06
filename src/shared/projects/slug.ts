// Nom de dossier d'un projet (spec 016 FR-002), partagé : le formulaire le propose, le main le revalide.

/** Mots réservés des commandes `/hub` : un slug ne peut pas les prendre (spec 016 FR-002). */
const RESERVED = new Set(['new', 'work', 'end', 'status', 'graphify', 'search', 'link', 'archive'])
const SLUG = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/

/** Raison pour laquelle un slug est refusé ; `null` s'il est valide. */
export function slugProblem(slug: string): string | null {
  if (slug.length < 2 || slug.length > 50) return 'Le nom de dossier doit faire de 2 à 50 caractères.'
  if (!SLUG.test(slug) || slug.includes('--')) {
    return 'Le nom de dossier : minuscules, chiffres et tirets simples, sans tiret au début ni à la fin.'
  }
  if (RESERVED.has(slug)) return `« ${slug} » est réservé aux commandes du hub.`
  return null
}

/** Slug proposé depuis un titre : accents retirés, minuscules, tirets ; tronqué à 50 caractères. */
export function slugify(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '')
}
