import { isAbsolute, relative } from 'node:path'
import type { ChatToolFileView } from '@shared/ipc/chat'
import { languageOf } from '@shared/files/language'
import { AppError } from '../../domain/errors'
import { readToolPatch } from '../../domain/conversation/toolPatch'
import type { ProjectFiles } from '../../infrastructure/finals/ProjectFiles'

export interface ToolFileReaderDeps {
  /** Chemin et modification enregistrés d'un message d'outil ; `undefined` s'il n'est pas à ce neurone. */
  readonly message: (
    neuronId: string,
    messageId: string
  ) => { readonly path: string | null; readonly patch: string | null } | undefined
  /** Dossiers de la conversation (projet du canevas, dossier lié, sinon l'espace de travail). */
  readonly roots: (neuronId: string) => readonly string[]
  readonly files: Pick<ProjectFiles, 'read'>
}

/** Chemin relatif sous `root`, séparateurs `/` ; `null` s'il en sort. */
function inside(root: string, path: string): string | null {
  const rel = relative(root, path)
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) return null
  return rel.split(/[\\/]/).join('/')
}

/**
 * Fenêtre d'une pastille de fichier (spec 014 D9) : la modification enregistrée, et le fichier actuel s'il est dans
 * un dossier de la conversation (lu par `ProjectFiles` : liens qui sortent refusés, texte seulement, 1 Mo au plus).
 * Le renderer ne donne qu'un identifiant de message, jamais un chemin.
 */
export class ToolFileReader {
  constructor(private readonly deps: ToolFileReaderDeps) {}

  read(neuronId: string, messageId: string): ChatToolFileView {
    const message = this.deps.message(neuronId, messageId)
    if (message === undefined || message.path === null) throw new AppError('NOT_FOUND', 'Fichier introuvable.')
    const change = readToolPatch(message.patch)
    const name = message.path.split(/[\\/]/).pop() ?? message.path
    const base = { language: languageOf(name), change, missing: false, refused: false, tooBig: false, binary: false }
    for (const root of this.deps.roots(neuronId)) {
      const rel = inside(root, message.path)
      if (rel === null) continue
      try {
        const file = this.deps.files.read(root, rel)
        return { ...base, path: rel, current: file?.content ?? null, missing: file === null, outside: false }
      } catch (error) {
        const code = error instanceof AppError ? error.code : ''
        if (code === 'TOO_LARGE') return { ...base, path: rel, current: null, tooBig: true, outside: false }
        if (code === 'INVALID_STATE') return { ...base, path: rel, current: null, binary: true, outside: false }
        // Chemin refusé par `ProjectFiles` : fichier sensible ou binaire, lien qui sort, dossier. Jamais lu.
        return { ...base, path: rel, current: null, refused: true, outside: false }
      }
    }
    return { ...base, path: name, current: null, outside: true }
  }
}
