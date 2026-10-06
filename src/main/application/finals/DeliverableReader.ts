import type { DeliverableFileDetailView } from '@shared/ipc/finals'
import { languageOf } from '@shared/files/language'
import { AppError } from '../../domain/errors'
import type {
  DeliverableFileRow,
  FinalActionRow,
  FinalRepository
} from '../../infrastructure/db/repositories/FinalRepository'
import type { ProjectFiles } from '../../infrastructure/finals/ProjectFiles'
import { hashOf } from '../../infrastructure/documents/DocumentFiles'

/** Action et fichier de son livrable ; seuls les chemins du livrable sont acceptés (jamais un chemin quelconque). */
export function deliverableFile(
  repository: Pick<FinalRepository, 'get' | 'files'>,
  neuronId: string,
  path: string
): { readonly action: FinalActionRow; readonly row: DeliverableFileRow } {
  const action = repository.get(neuronId)
  if (action === undefined) throw new AppError('NOT_FOUND', 'Action finale introuvable.')
  const key = path.toLowerCase()
  const row = repository.files(neuronId).find((file) => file.pathKey === key)
  if (row === undefined) throw new AppError('NOT_FOUND', 'Ce fichier ne fait pas partie du livrable.')
  return { action, row }
}

export interface DeliverableReaderDeps {
  readonly repository: Pick<FinalRepository, 'get' | 'files'>
  readonly projectDir: (genesisId: string) => string | null
  readonly files: Pick<ProjectFiles, 'read'>
}

/**
 * Lecture seule d'un fichier du livrable (spec 013 D4, FR-019) : seuls les chemins du livrable de l'action sont
 * lisibles — jamais un chemin quelconque demandé par le renderer —, lus par le main sous le dossier lié (contrôles
 * de `ProjectFiles`).
 */
export class DeliverableReader {
  constructor(private readonly deps: DeliverableReaderDeps) {}

  file(neuronId: string, path: string): DeliverableFileDetailView {
    const { action, row } = deliverableFile(this.deps.repository, neuronId, path)
    const disk = this.readDisk(action.genesisId, row.path)
    return {
      path: row.path,
      status: row.beforeContent === null ? 'cree' : 'modifie',
      language: languageOf(row.path),
      before: row.beforeContent,
      after: row.afterContent,
      current: disk.current,
      missing: disk.missing,
      tooBig: disk.tooBig,
      binary: disk.binary,
      changedSince: disk.current !== null && hashOf(disk.current) !== row.afterHash
    }
  }

  private readDisk(
    genesisId: string,
    path: string
  ): { current: string | null; missing: boolean; tooBig: boolean; binary: boolean } {
    const none = { current: null, missing: false, tooBig: false, binary: false }
    const projectDir = this.deps.projectDir(genesisId)
    if (projectDir === null) return { ...none, missing: true }
    try {
      const file = this.deps.files.read(projectDir, path)
      return file === null ? { ...none, missing: true } : { ...none, current: file.content }
    } catch (error) {
      if (!(error instanceof AppError)) throw error
      if (error.code === 'TOO_LARGE') return { ...none, tooBig: true }
      if (error.code === 'INVALID_STATE') return { ...none, binary: true }
      if (error.code === 'FOLDER_MISSING') return { ...none, missing: true }
      throw error
    }
  }
}
