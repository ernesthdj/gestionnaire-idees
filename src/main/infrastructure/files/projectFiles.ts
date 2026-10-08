import { readFileSync, realpathSync, statSync } from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'
import { AppError } from '../../domain/errors'
import { ANALYZED_FILE_MAX_BYTES, classifyFile } from '../../domain/reprise/fileFilter'

const MB = 1024 * 1024
const sizeLabel = (bytes: number): string =>
  bytes >= MB ? `${Math.round(bytes / MB)} Mo` : `${Math.round(bytes / 1024)} Ko`

export interface ReadProjectTextOptions {
  /** Taille maximale lue (octets) ; 1 Mo par défaut, comme les fichiers analysés (spec 017). */
  readonly maxBytes?: number
  /** Lecture du texte, remplaçable dans les tests. */
  readonly readText?: (path: string) => string
}

/**
 * Lit un fichier texte d'un projet lié, en lecture seule, sans jamais sortir de son dossier (specs 017 et 023) :
 * racine et cible résolues (liens symboliques compris) puis cible vérifiée sous la racine ; fichier sensible refusé ;
 * taille bornée ; un fichier binaire est refusé. `relPath` est relatif, séparé par `/`.
 */
export function readProjectText(root: string, relPath: string, options: ReadProjectTextOptions = {}): string {
  const normalized = relPath.replace(/\\/g, '/')
  if (classifyFile(normalized, 0, () => false).kind === 'sensitive') {
    throw new AppError('SECRET_FILE', 'Fichier sensible : jamais affiché.')
  }
  const maxBytes = options.maxBytes ?? ANALYZED_FILE_MAX_BYTES
  let text: string
  try {
    const real = realpathSync(root)
    const target = realpathSync(join(real, ...normalized.split('/')))
    const inside = relative(real, target)
    if (inside === '' || inside.startsWith('..') || isAbsolute(inside)) throw new Error('hors du projet')
    if (statSync(target).size > maxBytes) {
      throw new AppError('TOO_LARGE', `Fichier de plus de ${sizeLabel(maxBytes)} : pas affiché.`)
    }
    text = (options.readText ?? ((path: string) => readFileSync(path, 'utf8')))(target)
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError('NOT_FOUND', 'Fichier introuvable dans le dossier du projet.')
  }
  if (text.includes('\u0000')) throw new AppError('INVALID_STATE', 'Ce fichier n’est pas un fichier texte.')
  return text
}
