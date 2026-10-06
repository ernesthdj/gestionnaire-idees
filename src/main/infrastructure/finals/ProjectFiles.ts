import { randomUUID } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { basename, dirname, isAbsolute, join, relative } from 'node:path'
import { checkProjectPath } from '../../domain/finals/projectPath'
import { AppError } from '../../domain/errors'
import { hashOf } from '../documents/DocumentFiles'

/** Taille maximale d'un fichier écrit ou lu pour un livrable (spec 013 FR-013). */
export const PROJECT_FILE_MAX_BYTES = 1024 * 1024

/** `child` est-il `parent` ou à l'intérieur (chemins déjà résolus) ? */
function isWithin(parent: string, child: string): boolean {
  const path = relative(parent, child)
  return path === '' || (!path.startsWith('..') && !isAbsolute(path))
}

/**
 * Fichiers du dossier de projet lié, écrits par Claude pendant une exécution (spec 013 R2) : chemin contrôlé (pur),
 * puis résolu sur le disque — le chemin réel MUST rester sous le chemin réel du projet, un lien symbolique ou une
 * jonction qui sort est refusé — ; texte seulement, 1 Mo au plus, écriture atomique, corbeille au lieu d'un effacement.
 */
export class ProjectFiles {
  constructor(private readonly options: { readonly profileDir: string; readonly now?: () => Date }) {}

  /** Chemin absolu sûr d'un fichier du projet ; lève `VALIDATION` (chemin refusé) ou `FOLDER_*`. */
  resolve(projectDir: string, path: string): string {
    const check = checkProjectPath(path)
    if (!check.ok) throw new AppError('VALIDATION', `Chemin refusé : ${check.reason}.`)
    const root = this.root(projectDir)
    const target = join(root, ...check.path.split('/'))
    if (!isWithin(root, target)) throw new AppError('VALIDATION', 'Chemin refusé : hors du dossier du projet.')
    // Le plus proche dossier existant décide : s'il mène hors du projet (lien, jonction), rien n'est écrit.
    let existing = dirname(target)
    while (!existsSync(existing)) existing = dirname(existing)
    if (!isWithin(root, realpathSync(existing))) {
      throw new AppError('FOLDER_REFUSED', 'Chemin refusé : un dossier de ce chemin mène hors du projet.')
    }
    if (existsSync(target) || this.isLink(target)) {
      if (this.isLink(target) || !isWithin(root, realpathSync(target))) {
        throw new AppError('FOLDER_REFUSED', 'Chemin refusé : ce fichier est un lien.')
      }
      if (!statSync(target).isFile()) throw new AppError('VALIDATION', 'Chemin refusé : c’est un dossier.')
    }
    return target
  }

  /** Contenu texte actuel et empreinte ; `null` si le fichier n'existe pas. */
  read(projectDir: string, path: string): { readonly content: string; readonly hash: string } | null {
    const target = this.resolve(projectDir, path)
    if (!existsSync(target)) return null
    if (statSync(target).size > PROJECT_FILE_MAX_BYTES) {
      throw new AppError('TOO_LARGE', 'Fichier trop volumineux : 1 Mo au plus.')
    }
    const bytes = readFileSync(target)
    if (bytes.includes(0)) throw new AppError('INVALID_STATE', 'Ce fichier n’est pas un fichier texte.')
    const content = bytes.toString('utf8')
    return { content, hash: hashOf(content) }
  }

  /** Écrit (ou remplace) d'un coup : temporaire du même dossier, puis renommage ; dossiers créés au besoin. */
  write(projectDir: string, path: string, content: string): string {
    if (Buffer.byteLength(content, 'utf8') > PROJECT_FILE_MAX_BYTES) {
      throw new AppError('TOO_LARGE', 'Fichier trop volumineux : 1 Mo au plus.')
    }
    const target = this.resolve(projectDir, path)
    const folder = dirname(target)
    mkdirSync(folder, { recursive: true })
    // Contrôle après création : rien ne doit avoir changé de place entre-temps.
    if (!isWithin(this.root(projectDir), realpathSync(folder))) {
      throw new AppError('FOLDER_REFUSED', 'Chemin refusé : un dossier de ce chemin mène hors du projet.')
    }
    const temporary = join(folder, `.${basename(target)}.${randomUUID()}.tmp`)
    try {
      writeFileSync(temporary, content, 'utf8')
      renameSync(temporary, target)
    } finally {
      if (existsSync(temporary)) rmSync(temporary, { force: true })
    }
    return hashOf(content)
  }

  /** Met le fichier dans la corbeille du profil (jamais d'effacement définitif) ; rien à faire s'il est absent. */
  trash(projectDir: string, path: string): void {
    const target = this.resolve(projectDir, path)
    if (!existsSync(target)) return
    const trash = join(this.options.profileDir, 'documents', '.corbeille')
    mkdirSync(trash, { recursive: true })
    const stamp = (this.options.now?.() ?? new Date()).toISOString().replace(/[:.]/g, '-')
    const flat = (checkProjectPath(path).ok ? path.replace(/[\\/]/g, '__') : basename(target)).slice(-120)
    const destination = join(trash, `${stamp}-${flat}`)
    try {
      renameSync(target, destination)
    } catch {
      // Autre lecteur que le profil : copie puis retrait.
      copyFileSync(target, destination)
      unlinkSync(target)
    }
  }

  private root(projectDir: string): string {
    if (!existsSync(projectDir)) {
      throw new AppError(
        'FOLDER_MISSING',
        'Le dossier de projet lié est introuvable : relie-le dans le chat du genesis.'
      )
    }
    return realpathSync(projectDir)
  }

  private isLink(path: string): boolean {
    try {
      return lstatSync(path).isSymbolicLink()
    } catch {
      return false
    }
  }
}
