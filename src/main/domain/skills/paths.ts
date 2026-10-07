import { isAbsolute, relative } from 'node:path'
import { EXECUTABLE_EXTENSIONS, SKILL_NAME } from '@shared/skills/model'

/**
 * Noms et chemins des skills (spec 020) : fonctions pures qui gardent toute lecture et toute écriture dans les dossiers
 * de skills. Un chemin relatif valide n'est ni absolu, ni sur un lecteur, ni remontant (`..`), ni vide, et n'utilise
 * que `/` comme séparateur.
 */

export const isSkillName = (name: string): boolean => SKILL_NAME.test(name)

/** Chemin relatif d'un fichier annexe : sûr, normalisé, sans remontée ; `null` sinon. */
export function safeRelativePath(path: string): string | null {
  if (path === '' || path.length > 260 || [...path].some((char) => char.charCodeAt(0) < 32)) return null
  if (path.includes('\\') || path.startsWith('/') || /^[A-Za-z]:/.test(path) || isAbsolute(path)) return null
  const parts = path.split('/')
  if (parts.some((part) => part === '' || part === '.' || part === '..')) return null
  return parts.join('/')
}

/** Extension exécutable (repère ⚠, refus d'écriture depuis un brouillon de Claude). */
export function isExecutablePath(path: string): boolean {
  const name = path.slice(path.lastIndexOf('/') + 1).toLowerCase()
  const dot = name.lastIndexOf('.')
  return dot > 0 && EXECUTABLE_EXTENSIONS.has(name.slice(dot))
}

/** `child` est-il `parent` ou à l'intérieur (chemins réels, déjà résolus) ? */
export function isInside(child: string, parent: string): boolean {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/** Compare deux versions de plugin : semver si possible, sinon ordre lexical (research R3). */
export function compareVersions(a: string, b: string): number {
  const parse = (value: string): number[] | null => {
    const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(value)
    return match === null ? null : [Number(match[1]), Number(match[2]), Number(match[3])]
  }
  const left = parse(a)
  const right = parse(b)
  if (left !== null && right !== null) {
    for (let i = 0; i < 3; i += 1) {
      const diff = (left[i] as number) - (right[i] as number)
      if (diff !== 0) return diff
    }
    return 0
  }
  if (left !== null) return 1
  if (right !== null) return -1
  return a < b ? -1 : a > b ? 1 : 0
}
