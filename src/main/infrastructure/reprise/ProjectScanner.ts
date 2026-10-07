import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CodeLang } from '@shared/ipc/reprise'
import { classifyFile, gitignoreMatcher, isExcludedDir, RETAINED_FILES_MAX } from '../../domain/reprise/fileFilter'

export interface ScannedFile {
  /** Relatif à la racine, séparateur `/`. */
  readonly path: string
  readonly lang: CodeLang
  readonly size: number
}

export interface ProjectScan {
  readonly retained: readonly ScannedFile[]
  readonly ignored: number
  readonly sensitive: number
  readonly tooLargeFiles: number
  /** Plus de fichiers retenus que la limite : le parcours s'est arrêté (choisir un sous-dossier). */
  readonly overLimit: boolean
  readonly git: boolean
}

/** `.gitignore` de la racine, lu sans jamais suivre de lien ; vide s'il est absent ou trop gros. */
function rootGitignore(root: string): (path: string, isDirectory?: boolean) => boolean {
  const file = join(root, '.gitignore')
  try {
    const stat = lstatSync(file)
    if (!stat.isFile() || stat.size > 256 * 1024) return () => false
    return gitignoreMatcher(readFileSync(file, 'utf8'))
  } catch {
    return () => false
  }
}

/**
 * Parcours d'un projet repris (spec 017 R4) : itératif, sans jamais suivre un lien symbolique ni une jonction, sans
 * entrer dans les dossiers exclus ni dans un dépôt imbriqué (sous-dossier avec son `.git`) ; chaque fichier est classé (retenu, sensible, ignoré, trop gros). Aucun contenu
 * n'est lu ici, hors `.gitignore`. Au-delà de `limit` fichiers retenus, le parcours s'arrête.
 */
export function scanProject(root: string, limit = RETAINED_FILES_MAX): ProjectScan {
  const ignoredByGit = rootGitignore(root)
  const retained: ScannedFile[] = []
  let ignored = 0
  let sensitive = 0
  let tooLargeFiles = 0
  const pending: string[] = ['']
  while (pending.length > 0) {
    const relative = pending.pop() ?? ''
    let entries: string[]
    try {
      entries = readdirSync(join(root, relative))
    } catch {
      continue
    }
    for (const name of entries.sort()) {
      const path = relative === '' ? name : `${relative}/${name}`
      let stat: ReturnType<typeof lstatSync>
      try {
        stat = lstatSync(join(root, path))
      } catch {
        continue
      }
      if (stat.isSymbolicLink()) {
        ignored++
        continue
      }
      if (stat.isDirectory()) {
        // Un sous-dossier avec son propre `.git` est un worktree ou un dépôt imbriqué : une autre copie, pas ce projet.
        if (isExcludedDir(name) || ignoredByGit(path, true) || existsSync(join(root, path, '.git'))) ignored++
        else pending.push(path)
        continue
      }
      if (!stat.isFile()) continue
      const verdict = classifyFile(path, stat.size, ignoredByGit)
      if (verdict.kind === 'sensitive') sensitive++
      else if (verdict.kind === 'ignored') ignored++
      else if (verdict.kind === 'too_large') tooLargeFiles++
      else {
        if (retained.length >= limit) {
          return { retained, ignored, sensitive, tooLargeFiles, overLimit: true, git: existsSync(join(root, '.git')) }
        }
        retained.push({ path, lang: verdict.lang, size: stat.size })
      }
    }
  }
  retained.sort((a, b) => a.path.localeCompare(b.path))
  return { retained, ignored, sensitive, tooLargeFiles, overLimit: false, git: existsSync(join(root, '.git')) }
}
