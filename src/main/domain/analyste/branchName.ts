/**
 * Nom de branche et dossier d'une mise à jour de l'Analyste (spec 019 T030, FR-029) : fonctions pures. Noms et chemins
 * viennent de l'app seulement : `analyste/<id8>-<titre court>`, copie de travail `<dépôt>/.analyste/worktrees/<id8>`.
 */

export const BRANCH_PREFIX = 'analyste/'
export const WORKTREES_DIR = '.analyste/worktrees'
const SLUG_MAX = 30

/** Huit premiers caractères hexadécimaux de l'identifiant (uuid). */
export function id8(updateId: string): string {
  const hex = updateId
    .toLowerCase()
    .replace(/[^0-9a-f]/g, '')
    .slice(0, 8)
  if (hex.length < 8) throw new Error('Identifiant de mise à jour invalide')
  return hex
}

/** Titre réduit à `[a-z0-9-]`, sans accent, 30 caractères au plus, jamais vide. */
export function slugOf(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '')
  return slug === '' ? 'proposition' : slug
}

export function branchName(updateId: string, title: string): string {
  return `${BRANCH_PREFIX}${id8(updateId)}-${slugOf(title)}`
}

/** Chemin relatif au dépôt de la copie de travail (séparateur `/`). */
export function worktreeRelPath(updateId: string): string {
  return `${WORKTREES_DIR}/${id8(updateId)}`
}

/** Une branche de l'Analyste (jamais une autre ne peut être supprimée par l'app). */
export function isAnalystBranch(name: string): boolean {
  return /^analyste\/[0-9a-f]{8}-[a-z0-9-]{1,30}$/.test(name)
}
