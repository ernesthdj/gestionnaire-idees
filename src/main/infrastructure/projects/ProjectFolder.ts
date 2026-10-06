import { existsSync, mkdirSync, readdirSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, isAbsolute } from 'node:path'
import { AppError } from '../../domain/errors'
import type { ScaffoldFile } from '../../domain/projects/project'

/** Le dossier d'un projet : `racine/slug`, contrôlé pour rester sous la racine (spec 016 FR-001). */
export function projectPath(root: string, slug: string): string {
  const target = join(root, slug)
  const rel = relative(root, target)
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
    throw new AppError('VALIDATION', 'Le dossier du projet doit rester dans la racine des projets.')
  }
  return target
}

/**
 * Crée le dossier d'un projet et ses fichiers initiaux sans jamais rien écraser (spec 016 FR-003) : le dossier doit
 * être absent ou vide ; chaque fichier est écrit en `wx`.
 */
export function createProjectFolder(
  root: string,
  slug: string,
  content: { readonly files: readonly ScaffoldFile[]; readonly dirs: readonly string[] }
): string {
  if (!existsSync(root))
    throw new AppError('FOLDER_MISSING', 'La racine des projets n’existe plus : choisis-la de nouveau.')
  const target = projectPath(realpathSync(root), slug)
  if (existsSync(target) && readdirSync(target).length > 0) {
    throw new AppError('CONFLICT', `Le dossier « ${slug} » existe déjà dans la racine des projets.`)
  }
  mkdirSync(target, { recursive: true })
  for (const dir of content.dirs) mkdirSync(join(target, dir), { recursive: true })
  for (const file of content.files) {
    const path = join(target, ...file.path.split('/'))
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, file.content, { encoding: 'utf8', flag: 'wx' })
  }
  return target
}

/** Écrit un fichier seulement s'il n'existe pas ; `false` s'il était déjà là. */
export function writeIfAbsent(path: string, content: string): boolean {
  if (existsSync(path)) return false
  writeFileSync(path, content, { encoding: 'utf8', flag: 'wx' })
  return true
}
