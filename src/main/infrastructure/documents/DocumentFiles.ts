import { createHash, randomUUID } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'
import { AppError } from '../../domain/errors'

/** Taille maximale d'un document (spec 012 FR-010). */
export const DOCUMENT_MAX_BYTES = 500 * 1024

/** Seuls noms acceptés : ceux que produit `documentFileName` (jamais un chemin). */
const FILE_NAME = /^[a-z0-9][a-z0-9-]*\.md$/

export type DocumentFolderRef = { readonly kind: 'project'; readonly projectDir: string } | { readonly kind: 'profile' }

export function hashOf(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

/** `child` est-il strictement à l'intérieur de `parent` (chemins déjà résolus) ? */
function isInside(parent: string, child: string): boolean {
  const path = relative(parent, child)
  return path !== '' && !path.startsWith('..') && !isAbsolute(path)
}

/**
 * Fichiers `.md` des documents (spec 012 R3) : dossier choisi par l'app (`docs/brainstormer/` du projet lié, sinon
 * `documents/` du profil), noms assainis, écriture atomique, borne de taille, corbeille au lieu d'une suppression.
 */
export class DocumentFiles {
  constructor(private readonly options: { readonly profileDir: string; readonly now?: () => Date }) {}

  /** Dossier des documents, créé au besoin ; un dossier de projet qui mène hors du projet est refusé. */
  folder(ref: DocumentFolderRef): string {
    if (ref.kind === 'profile') {
      const dir = join(this.options.profileDir, 'documents')
      mkdirSync(dir, { recursive: true })
      return dir
    }
    if (!existsSync(ref.projectDir)) {
      throw new AppError(
        'FOLDER_MISSING',
        'Le dossier de projet lié est introuvable : relie-le dans le chat du genesis.'
      )
    }
    const dir = join(ref.projectDir, 'docs', 'brainstormer')
    mkdirSync(dir, { recursive: true })
    // Un lien symbolique (ou une jonction) `docs/brainstormer` pourrait faire écrire ailleurs : refusé.
    if (!isInside(realpathSync(ref.projectDir), realpathSync(dir))) {
      throw new AppError(
        'FOLDER_REFUSED',
        'Le dossier docs/brainstormer du projet mène hors du projet : rien n’est écrit.'
      )
    }
    return dir
  }

  /** Noms déjà présents dans le dossier, en minuscules (collisions, Windows ignore la casse). */
  takenNames(dir: string): Set<string> {
    return new Set(readdirSync(dir).map((name) => name.toLowerCase()))
  }

  /** Écrit (ou remplace) le fichier d'un coup : fichier temporaire du même dossier, puis renommage. */
  write(dir: string, fileName: string, content: string): string {
    const path = this.pathOf(dir, fileName)
    if (Buffer.byteLength(content, 'utf8') > DOCUMENT_MAX_BYTES) {
      throw new AppError('TOO_LARGE', 'Document trop volumineux : 500 Ko au plus.')
    }
    const temporary = join(dir, `.${fileName}.${randomUUID()}.tmp`)
    try {
      writeFileSync(temporary, content, 'utf8')
      renameSync(temporary, path)
    } finally {
      if (existsSync(temporary)) rmSync(temporary, { force: true })
    }
    return hashOf(content)
  }

  /** Contenu actuel et empreinte ; `null` si le fichier n'existe plus. */
  read(dir: string, fileName: string): { readonly content: string; readonly hash: string } | null {
    const path = this.pathOf(dir, fileName)
    if (!existsSync(path)) return null
    const content = readFileSync(path, 'utf8')
    return { content, hash: hashOf(content) }
  }

  /** Met le fichier dans la corbeille du profil (jamais d'effacement définitif) ; rien à faire s'il est absent. */
  trash(dir: string, fileName: string): void {
    const path = this.pathOf(dir, fileName)
    if (!existsSync(path)) return
    const trash = join(this.options.profileDir, 'documents', '.corbeille')
    mkdirSync(trash, { recursive: true })
    const stamp = (this.options.now?.() ?? new Date()).toISOString().replace(/[:.]/g, '-')
    const target = join(trash, `${stamp}-${fileName}`)
    try {
      renameSync(path, target)
    } catch {
      // Autre lecteur que le profil : copie puis retrait.
      copyFileSync(path, target)
      unlinkSync(path)
    }
  }

  /** Chemin complet d'un document : nom contrôlé, toujours dans `dir`. */
  pathOf(dir: string, fileName: string): string {
    if (!FILE_NAME.test(fileName)) throw new AppError('VALIDATION', 'Nom de fichier de document invalide')
    const path = join(dir, fileName)
    if (!isInside(dir, path)) {
      throw new AppError('VALIDATION', 'Nom de fichier de document invalide')
    }
    return path
  }
}
