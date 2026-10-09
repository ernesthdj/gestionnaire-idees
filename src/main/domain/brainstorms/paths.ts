import { isAbsolute, parse, relative } from 'node:path'

/** Dossiers que l'app ne prend jamais pour un projet (spec 024 contrats) : ses données, ceux du système. */
export interface FolderRules {
  readonly dataDir: string
  /** Dossier `projects/` du coffre ; un projet qui y est rangé s'ouvre depuis la liste. */
  readonly projectsRoot: string | null
  /** Dossiers système (Windows, Program Files…) et dossier personnel. */
  readonly systemDirs: readonly string[]
  readonly home: string
}

/** `child` est `parent` ou se trouve dedans (chemins déjà résolus). */
export function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

const same = (a: string, b: string): boolean => relative(a, b) === ''

/**
 * Raison pour laquelle un dossier ne peut pas devenir un projet en chantier (spec 024 US4) ; `null` s'il convient.
 * `dir` est un chemin absolu déjà résolu (`realpath`).
 */
export function existingFolderProblem(dir: string, rules: FolderRules): string | null {
  if (!isAbsolute(dir)) return 'Le dossier doit être un chemin complet.'
  if (parse(dir).root === dir || same(parse(dir).root, dir)) return 'La racine d’un disque ne peut pas être un projet.'
  if (isInside(rules.dataDir, dir) || isInside(dir, rules.dataDir)) {
    return 'Ce dossier contient les données de l’app : il ne peut pas être un projet.'
  }
  if (same(dir, rules.home))
    return 'Ton dossier personnel entier ne peut pas être un projet : choisis le dossier du projet.'
  if (rules.systemDirs.some((system) => isInside(system, dir))) return 'Un dossier système ne peut pas être un projet.'
  if (rules.projectsRoot !== null) {
    if (same(dir, rules.projectsRoot) || isInside(dir, rules.projectsRoot)) {
      return 'Ce dossier contient ton coffre : choisis le dossier d’un seul projet.'
    }
    if (isInside(rules.projectsRoot, dir)) {
      return 'Ce projet est rangé dans ton coffre : ouvre-le depuis « Charger un brainstorm existant ».'
    }
  }
  return null
}
