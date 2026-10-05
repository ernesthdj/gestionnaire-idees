/**
 * Nom du fichier d'un document (spec 012 FR-002) : dérivé du titre, assaini, borné, jamais un chemin. Fonction pure ;
 * le dossier est choisi ailleurs, par l'app.
 */

export const FILE_SLUG_MAX = 60

/** Noms de périphériques réservés par Windows (même avec une extension). */
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/

function slugify(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, FILE_SLUG_MAX)
    .replace(/-+$/g, '')
  if (slug === '') return 'document'
  return RESERVED.test(slug) ? `${slug}-doc` : slug
}

/** `<slug>.md`, ou `<slug>-2.md`, `-3`… si le nom est déjà pris dans le dossier (`taken` : noms en minuscules). */
export function documentFileName(title: string, taken: ReadonlySet<string>): string {
  const base = slugify(title)
  if (!taken.has(`${base}.md`)) return `${base}.md`
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}.md`
    if (!taken.has(candidate)) return candidate
  }
}
