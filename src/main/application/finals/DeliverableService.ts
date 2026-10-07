import { randomUUID } from 'node:crypto'
import type { DeliverableDetailFileView, DeliverableDetailView, ExecutionView } from '@shared/ipc/finals'
import { AppError } from '../../domain/errors'
import type {
  DeliverableFileRow,
  FinalActionRow,
  FinalRepository
} from '../../infrastructure/db/repositories/FinalRepository'
import type { ChangeEntry } from '../../infrastructure/db/repositories/changeLog'
import type { PlanRepository } from '../../infrastructure/db/repositories/PlanRepository'
import { hashOf } from '../../infrastructure/documents/DocumentFiles'
import type { ProjectFiles } from '../../infrastructure/finals/ProjectFiles'
import type { ExecutionService } from './ExecutionService'

/** Bornes de la revue : dernières exécutions et événements d'une exécution renvoyés au renderer. */
const EXECUTIONS_SHOWN = 5
const EVENTS_SHOWN = 200
/** Longueur maximale d'une phrase de correction (contrat `deliverable:correct`). */
export const CORRECTION_MAX = 4000

export interface DeliverableServiceDeps {
  readonly repository: Pick<
    FinalRepository,
    'transaction' | 'log' | 'active' | 'files' | 'setReverted' | 'executionsOf' | 'eventsOf' | 'openOf'
  >
  readonly plan: Pick<PlanRepository, 'steps' | 'setStatus'>
  /** Dossier de projet lié au genesis ; `null` : documents seulement. */
  readonly projectDir: (genesisId: string) => string | null
  readonly files: Pick<ProjectFiles, 'read' | 'write' | 'trash'>
  readonly executions: Pick<ExecutionService, 'execute'>
  /** Le livrable ou l'action a changé : la carte et la revue se rafraîchissent. */
  readonly emit: (neuronId: string) => void
  readonly now?: () => Date
}

/** Ce que le disque contient d'un fichier du livrable. */
type Disk =
  { readonly kind: 'text'; readonly content: string } | { readonly kind: 'missing' } | { readonly kind: 'unreadable' }

/**
 * Revue d'un livrable (spec 013 US3) : différences, acceptation (l'étape passe à « fait »), correction (nouvelle passe
 * de Claude) et retour en arrière (restaure ce que Claude a écrit, épargne ce qui a été retouché depuis). Chaque geste
 * de mentalyas est un lot `final` annulable de l'Historique.
 */
export class DeliverableService {
  constructor(private readonly deps: DeliverableServiceDeps) {}

  get(neuronId: string): DeliverableDetailView {
    const action = this.action(neuronId)
    const projectDir = this.deps.projectDir(action.genesisId)
    const { repository } = this.deps
    const executions = repository.executionsOf(neuronId).slice(0, EXECUTIONS_SHOWN)
    return {
      neuronId,
      state: action.state,
      accepted: this.stepStatus(action) === 'fait',
      files: repository.files(neuronId).map((row) => this.fileView(row, projectDir)),
      executions: executions.map((execution): ExecutionView => ({
        id: execution.id,
        startedAt: execution.startedAt,
        endedAt: execution.endedAt,
        outcome: execution.outcome,
        correction: execution.correction,
        filesWritten: execution.filesWritten,
        events: repository
          .eventsOf(execution.id)
          .slice(-EVENTS_SHOWN)
          .map((event) => ({ at: event.at, kind: event.kind, path: event.path, detail: event.detail }))
      }))
    }
  }

  /** Le livrable est accepté : l'étape passe à « fait » (lot annulable). */
  accept(neuronId: string): { readonly batchId: string } {
    const action = this.reviewable(neuronId)
    if (this.stepStatus(action) === 'fait') throw new AppError('INVALID_STATE', 'Ce livrable est déjà accepté.')
    const batchId = randomUUID()
    const { repository, plan } = this.deps
    const before = this.stepStatus(action)
    repository.transaction(() => {
      plan.setStatus(neuronId, 'fait')
      repository.log(
        batchId,
        [
          {
            kind: 'final',
            entity: 'step_status',
            entityId: neuronId,
            before: { status: before },
            after: { status: 'fait' }
          }
        ],
        'user'
      )
    })
    this.deps.emit(neuronId)
    return { batchId }
  }

  /** Une phrase de correction : Claude reprend une passe sur le livrable (le contenu d'avant reste celui d'origine). */
  async correct(neuronId: string, message: string): Promise<{ readonly executionId: string }> {
    const action = this.reviewable(neuronId)
    const text = message.trim()
    if (text === '' || text.length > CORRECTION_MAX) {
      throw new AppError('VALIDATION', `La correction tient en 1 à ${CORRECTION_MAX} caractères.`)
    }
    if (this.stepStatus(action) === 'fait') {
      throw new AppError('INVALID_STATE', 'Ce livrable est déjà accepté : annule l’acceptation dans l’Historique.')
    }
    return this.deps.executions.execute(neuronId, { correction: text })
  }

  /**
   * Restaure les fichiers au contenu d'avant Claude (les fichiers créés vont à la corbeille du profil). Un fichier
   * retouché depuis l'écriture de Claude n'est pas touché : il est signalé. Un lot annulable.
   */
  revert(neuronId: string): { readonly restored: string[]; readonly skipped: string[] } {
    const action = this.reviewable(neuronId)
    const projectDir = this.deps.projectDir(action.genesisId)
    if (projectDir === null) {
      throw new AppError('FOLDER_MISSING', 'Aucun dossier de projet lié : il n’y a pas de fichier à restaurer.')
    }
    const { repository, files } = this.deps
    const restored: DeliverableFileRow[] = []
    const skipped: string[] = []
    const entries: ChangeEntry[] = []
    for (const row of repository.files(neuronId)) {
      const disk = this.disk(projectDir, row.path)
      if (this.isBefore(row, disk)) continue
      if (disk.kind !== 'text' || hashOf(disk.content) !== row.afterHash) {
        skipped.push(row.path)
        continue
      }
      try {
        if (row.beforeContent === null) files.trash(projectDir, row.path)
        else files.write(projectDir, row.path, row.beforeContent)
      } catch (error) {
        if (!(error instanceof AppError)) throw error
        skipped.push(row.path)
        continue
      }
      restored.push(row)
      entries.push({
        kind: 'final',
        entity: 'project_file',
        entityId: `${neuronId}:${row.path}`,
        before: { path: row.path, content: disk.content },
        after: { path: row.path, content: row.beforeContent }
      })
    }
    if (restored.length > 0) {
      const at = this.now()
      repository.transaction(() => {
        for (const row of restored) repository.setReverted(row.id, at)
        repository.log(randomUUID(), entries, 'user')
      })
    }
    this.deps.emit(neuronId)
    return { restored: restored.map((row) => row.path), skipped }
  }

  private fileView(row: DeliverableFileRow, projectDir: string | null): DeliverableDetailFileView {
    const base = {
      path: row.path,
      status: row.beforeContent === null ? ('cree' as const) : ('modifie' as const),
      before: row.beforeContent,
      after: row.afterContent
    }
    if (projectDir === null) return { ...base, changedSince: false, current: null, reverted: false }
    const disk = this.disk(projectDir, row.path)
    const reverted = row.revertedAt !== null && this.isBefore(row, disk)
    if (reverted) return { ...base, changedSince: false, current: null, reverted: true }
    const same = disk.kind === 'text' && hashOf(disk.content) === row.afterHash
    return {
      ...base,
      changedSince: !same,
      current: !same && disk.kind === 'text' ? disk.content : null,
      reverted: false
    }
  }

  /** Le disque est-il déjà revenu à l'état d'avant Claude ? (créé : fichier absent ; modifié : même contenu) */
  private isBefore(row: DeliverableFileRow, disk: Disk): boolean {
    if (row.beforeContent === null) return disk.kind === 'missing'
    return disk.kind === 'text' && disk.content === row.beforeContent
  }

  private disk(projectDir: string, path: string): Disk {
    try {
      const file = this.deps.files.read(projectDir, path)
      return file === null ? { kind: 'missing' } : { kind: 'text', content: file.content }
    } catch (error) {
      if (!(error instanceof AppError)) throw error
      // Trop gros, binaire, lien qui sort du projet, dossier absent : le fichier n'est pas celui écrit par Claude.
      return { kind: 'unreadable' }
    }
  }

  /** Action acceptée par mentalyas (jamais une simple proposition). */
  private action(neuronId: string): FinalActionRow {
    const action = this.deps.repository.active(neuronId)
    if (action === undefined || action.state === 'proposee') {
      throw new AppError('NOT_FOUND', 'Action finale introuvable (ou pas encore acceptée).')
    }
    return action
  }

  /** Action dont le livrable peut être revu : exécutée, aucune exécution en cours. */
  private reviewable(neuronId: string): FinalActionRow {
    const action = this.action(neuronId)
    if (action.state === 'en_cours' || this.deps.repository.openOf(neuronId) !== undefined) {
      throw new AppError('INVALID_STATE', 'Claude exécute cette action : attends la fin ou arrête l’exécution.')
    }
    if (action.state !== 'a_revoir') {
      throw new AppError('INVALID_STATE', 'Cette action n’a pas encore de livrable à revoir.')
    }
    return action
  }

  private stepStatus(action: FinalActionRow): string | undefined {
    return this.deps.plan.steps(action.genesisId).find((step) => step.id === action.neuronId)?.status
  }

  private now(): string {
    return (this.deps.now?.() ?? new Date()).toISOString()
  }
}
