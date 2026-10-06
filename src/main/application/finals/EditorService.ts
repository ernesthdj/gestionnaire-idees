import { existsSync } from 'node:fs'
import type { EditorChoice, EditorSettingsView } from '@shared/ipc/finals'
import { AppError } from '../../domain/errors'
import { editorArgs, isSafeToOpen } from '../../domain/finals/editor'
import type { AppSettingsRepository } from '../../infrastructure/db/repositories/AppSettingsRepository'
import type { FinalRepository } from '../../infrastructure/db/repositories/FinalRepository'
import type { ProjectFiles } from '../../infrastructure/finals/ProjectFiles'
import type { DetectedEditor } from '../../infrastructure/editor/EditorLauncher'
import { deliverableFile } from './DeliverableReader'

export interface EditorDeps {
  readonly settings: Pick<AppSettingsRepository, 'editor' | 'saveEditor'>
  readonly detect: () => readonly DetectedEditor[]
  /** Dialogue natif de choix d'un programme (`.exe`) ; `null` si mentalyas annule. */
  readonly chooseProgram: () => Promise<string | null>
  readonly isProgram: (path: string) => boolean
  readonly launch: (program: string, args: readonly string[]) => Promise<void>
  /** Application associée de Windows ; renvoie un message d'erreur, vide si tout va bien. */
  readonly openPath: (path: string) => Promise<string>
  readonly repository: Pick<FinalRepository, 'get' | 'files'>
  readonly projectDir: (genesisId: string) => string | null
  readonly files: Pick<ProjectFiles, 'resolve'>
}

/**
 * « Ouvrir dans l'éditeur » (spec 013 D4, FR-020) : le programme est toujours choisi par le main — éditeur connu à
 * son emplacement d'installation, ou `.exe` choisi dans un dialogue natif —, jamais une commande venue du renderer.
 */
export class EditorService {
  constructor(private readonly deps: EditorDeps) {}

  view(): EditorSettingsView {
    return {
      current: this.deps.settings.editor(),
      detected: this.deps.detect().map(({ kind, name }) => ({ kind, name }))
    }
  }

  async choose(choice: EditorChoice): Promise<EditorSettingsView> {
    if (choice === 'browse') {
      const program = await this.deps.chooseProgram()
      if (program === null) return this.view()
      if (!this.deps.isProgram(program)) {
        throw new AppError('VALIDATION', 'Choisis le programme de l’éditeur (un fichier .exe).')
      }
      this.deps.settings.saveEditor({ kind: 'other', program })
      return this.view()
    }
    const found = this.deps.detect().find((editor) => editor.kind === choice)
    if (found === undefined) throw new AppError('NOT_FOUND', 'Cet éditeur n’a pas été trouvé sur la machine.')
    this.deps.settings.saveEditor({ kind: found.kind, program: found.program })
    return this.view()
  }

  clear(): EditorSettingsView {
    this.deps.settings.saveEditor(null)
    return this.view()
  }

  async open(neuronId: string, path: string, line = 1): Promise<void> {
    const { action, row } = deliverableFile(this.deps.repository, neuronId, path)
    const projectDir = this.deps.projectDir(action.genesisId)
    if (projectDir === null) throw new AppError('FOLDER_MISSING', 'Aucun dossier de projet lié à ce genesis.')
    const target = this.deps.files.resolve(projectDir, row.path)
    if (!existsSync(target)) throw new AppError('NOT_FOUND', 'Ce fichier n’existe plus dans le projet.')
    const editor = this.deps.settings.editor()
    if (editor !== null) {
      await this.deps.launch(editor.program, editorArgs(editor.kind, target, line))
      return
    }
    if (!isSafeToOpen(target)) {
      throw new AppError(
        'NO_EDITOR',
        'Choisis un éditeur dans Réglages › Éditeur : ce type de fichier ne s’ouvre pas avec l’application de Windows.'
      )
    }
    const failure = await this.deps.openPath(target)
    if (failure !== '') throw new AppError('EDITOR_FAILED', 'Le fichier n’a pas pu être ouvert.')
  }
}
