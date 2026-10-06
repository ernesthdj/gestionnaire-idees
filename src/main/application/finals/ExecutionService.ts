import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { basename } from 'node:path'
import { rankLabel } from '@shared/plan/rankLabel'
import { AppError } from '../../domain/errors'
import {
  correctionMessage,
  EXECUTE_MESSAGE,
  EXECUTION_LIMITS,
  executionBrief
} from '../../domain/finals/executionBrief'
import { checkProjectPath } from '../../domain/finals/projectPath'
import { nextFinalState } from '../../domain/finals/state'
import type {
  ExecutionEventKind,
  ExecutionOutcome,
  FinalActionRow,
  FinalRepository
} from '../../infrastructure/db/repositories/FinalRepository'
import type { PlanRepository, StepRow } from '../../infrastructure/db/repositories/PlanRepository'
import type { ProjectFiles } from '../../infrastructure/finals/ProjectFiles'
import { hashOf } from '../../infrastructure/documents/DocumentFiles'
import type { ChatEvent } from '../conversation/ConversationService'
import type { EntityHandler } from '../history/HistoryService'

/** Libellés de chat (spec 008) des outils de lecture : tracés comme lectures dans le fil de l'exécution. */
const READ_LABELS = new Set(['fichier lu', 'fichiers listés', 'recherche dans les fichiers', 'contexte relu'])

export interface ExecutionDeps {
  readonly repository: Pick<
    FinalRepository,
    | 'transaction'
    | 'log'
    | 'get'
    | 'active'
    | 'setState'
    | 'startExecution'
    | 'openOfGenesis'
    | 'openOf'
    | 'openExecutions'
    | 'endExecution'
    | 'countWrite'
    | 'addEvent'
    | 'eventsOf'
    | 'file'
    | 'files'
    | 'insertFile'
    | 'updateFile'
  >
  readonly plan: Pick<PlanRepository, 'node' | 'steps'>
  /** Dossier de projet lié au genesis ; `null` : documents seulement (FR-011). */
  readonly projectDir: (genesisId: string) => string | null
  /** Documents rattachés à ces neurones (spec 012), pour le dossier d'exécution. */
  readonly documents: (
    neuronIds: ReadonlySet<string>
  ) => readonly { readonly id: string; readonly title: string; readonly fileLabel: string }[]
  readonly files: Pick<ProjectFiles, 'read' | 'write' | 'trash'>
  /** Scripts approuvés et lançables du projet (spec 013 D2 bis), annoncés dans le dossier d'exécution. */
  readonly scripts?: (genesisId: string) => readonly string[]
  readonly conversations: {
    send(neuronId: string, text: string, data?: string): Promise<void>
    stop(neuronId: string): void
    isBusy(neuronId: string): boolean
  }
  /** Début, fin, écriture : la carte et le livrable se rafraîchissent. */
  readonly emit: (neuronId: string) => void
  readonly folderExists?: (path: string) => boolean
  readonly now?: () => Date
  /** Durée maximale d'une passe (15 min). */
  readonly maxMs?: number
}

export interface WrittenFile {
  readonly path: string
  readonly status: 'cree' | 'modifie'
}

/**
 * Exécutions des actions finales (spec 013 US2) : une passe = un tour de la conversation de l'action, précédé du
 * dossier d'exécution. Pendant ce tour SEULEMENT, Claude écrit dans le dossier du projet lié par `fichier_ecrire` et
 * `fichier_modifier` : chemin contrôlé, contenu d'avant gardé, trace, Historique. Aucune commande, aucun effacement.
 */
export class ExecutionService {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(private readonly deps: ExecutionDeps) {}

  async execute(
    neuronId: string,
    options: { readonly force?: boolean; readonly correction?: string } = {}
  ): Promise<{ readonly executionId: string }> {
    const { repository } = this.deps
    const action = repository.active(neuronId)
    if (action === undefined || action.state === 'proposee') {
      throw new AppError('NOT_FOUND', 'Action finale introuvable (ou pas encore acceptée).')
    }
    if (nextFinalState(action.state, 'execute') === null) {
      throw new AppError('BUSY', 'Claude exécute déjà cette action.')
    }
    const steps = this.deps.plan.steps(action.genesisId)
    const step = steps.find((entry) => entry.id === neuronId)
    if (step === undefined) throw new AppError('NOT_FOUND', 'Étape introuvable')
    const pending = step.waitsFor
      .map((id) => steps.find((entry) => entry.id === id))
      .filter((entry): entry is StepRow => entry !== undefined && entry.status !== 'fait')
    if (pending.length > 0 && options.force !== true) {
      throw new AppError(
        'PREREQUISITES',
        `Prérequis pas encore faits : ${pending.map((entry) => `« ${entry.title} »`).join(', ')}.`,
        { pending: pending.map((entry) => entry.title) }
      )
    }
    const projectDir = this.deps.projectDir(action.genesisId)
    if (projectDir !== null && !(this.deps.folderExists ?? existsSync)(projectDir)) {
      throw new AppError(
        'FOLDER_MISSING',
        'Le dossier de projet lié est introuvable : relie-le dans le chat du genesis.'
      )
    }
    if (repository.openOfGenesis(action.genesisId) !== undefined) {
      throw new AppError('BUSY', 'Une autre action de ce projet est en cours d’exécution : attends sa fin.')
    }
    if (this.deps.conversations.isBusy(neuronId)) {
      throw new AppError('BUSY', 'Claude répond encore dans cette conversation : attends la fin du tour.')
    }

    const executionId = randomUUID()
    const correction = options.correction?.trim() ?? null
    repository.transaction(() => {
      repository.startExecution({
        id: executionId,
        neuronId,
        genesisId: action.genesisId,
        startedAt: this.now(),
        correction
      })
      repository.setState(neuronId, 'en_cours')
    })
    this.deps.emit(neuronId)
    const brief = this.brief(action, steps, step, projectDir, correction)
    try {
      await this.deps.conversations.send(
        neuronId,
        correction === null ? EXECUTE_MESSAGE : correctionMessage(correction),
        brief
      )
    } catch (error) {
      this.finish(executionId, 'echouee', error instanceof Error ? error.message : null)
      throw error
    }
    this.timers.set(
      neuronId,
      setTimeout(
        () => {
          this.event(executionId, 'refus', null, `Durée maximale atteinte (${EXECUTION_LIMITS.minutes} minutes).`)
          this.stop(neuronId)
        },
        this.deps.maxMs ?? EXECUTION_LIMITS.minutes * 60_000
      )
    )
    return { executionId }
  }

  /** Arrêt demandé par mentalyas : ce qui est déjà écrit reste au livrable. */
  stop(neuronId: string): void {
    const open = this.deps.repository.openOf(neuronId)
    if (open === undefined) return
    if (this.deps.conversations.isBusy(neuronId)) this.deps.conversations.stop(neuronId)
    else this.finish(open.id, 'arretee', null)
  }

  /** Flux des conversations : fin de tour, erreur, outils lus pendant une exécution. */
  onChatEvent(event: ChatEvent): void {
    const open = this.deps.repository.openOf(event.payload.neuronId)
    if (open === undefined) return
    switch (event.type) {
      case 'chat:turnEnd':
        this.finish(open.id, event.payload.interrupted ? 'arretee' : 'terminee', null)
        return
      case 'chat:error':
        this.finish(open.id, 'echouee', event.payload.message.text)
        return
      case 'chat:tool': {
        const label = event.payload.message.text
        if (label.startsWith('fichier_') || label === 'fichier écrit' || label === 'fichier modifié') return
        this.event(open.id, READ_LABELS.has(label) ? 'lecture' : 'message', null, label)
        return
      }
      default:
    }
  }

  /** Au démarrage : une exécution restée ouverte a été interrompue par la fermeture de l'app. */
  recover(): void {
    for (const open of this.deps.repository.openExecutions()) {
      this.finish(open.id, 'interrompue', 'L’app a été fermée pendant l’exécution.')
    }
  }

  /** `fichier_ecrire` : crée ou remplace un fichier du projet lié. */
  write(callerNeuronId: string | null, path: string, content: string): WrittenFile {
    return this.apply(callerNeuronId, path, () => content)
  }

  /** `fichier_modifier` : remplacement exact d'un passage qui apparaît une seule fois. */
  modify(callerNeuronId: string | null, path: string, previous: string, next: string): WrittenFile {
    return this.apply(callerNeuronId, path, (before) => {
      if (before === null) throw new AppError('NOT_FOUND', 'Fichier introuvable : crée-le avec fichier_ecrire.')
      const at = before.indexOf(previous)
      if (at < 0) throw new AppError('NOT_FOUND', 'Passage introuvable dans le fichier : relis-le (Read).')
      if (before.indexOf(previous, at + 1) >= 0) {
        throw new AppError('NOT_FOUND', 'Passage présent plusieurs fois : donne un extrait plus long, unique.')
      }
      return before.slice(0, at) + next + before.slice(at + previous.length)
    })
  }

  /** Entité `project_file` de l'Historique : contenu d'un fichier du projet (`null` = absent → corbeille). */
  historyHandlers(): Readonly<Record<string, EntityHandler>> {
    return {
      project_file: {
        snapshot: (id) => {
          const target = this.fileTarget(id)
          if (target === null) return null
          return { path: target.path, content: this.deps.files.read(target.projectDir, target.path)?.content ?? null }
        },
        apply: (id, target) => {
          const file = this.fileTarget(id)
          if (file === null) return
          const content = target?.['content']
          if (typeof content === 'string') this.deps.files.write(file.projectDir, file.path, content)
          else this.deps.files.trash(file.projectDir, file.path)
          this.deps.emit(file.neuronId)
        }
      }
    }
  }

  private apply(callerNeuronId: string | null, path: string, produce: (before: string | null) => string): WrittenFile {
    const { repository } = this.deps
    const open = callerNeuronId === null ? undefined : repository.openOf(callerNeuronId)
    if (open === undefined) {
      throw new AppError(
        'INVALID_STATE',
        'Aucune exécution en cours pour cette conversation : propose d’abord l’action finale, mentalyas la lancera.'
      )
    }
    const action = repository.get(open.neuronId) as FinalActionRow
    const projectDir = this.deps.projectDir(action.genesisId)
    if (projectDir === null) {
      throw new AppError(
        'INVALID_STATE',
        'Aucun dossier de projet lié : produis le livrable en documents avec document_ecrire.'
      )
    }
    let relative = path
    let before: string | null
    let next: string
    try {
      const check = checkProjectPath(path)
      if (!check.ok) throw new AppError('VALIDATION', `Chemin refusé : ${check.reason}.`)
      relative = check.path
      const written = new Set(
        repository
          .eventsOf(open.id)
          .filter((event) => event.kind === 'ecriture' && event.path !== null)
          .map((event) => (event.path ?? '').toLowerCase())
      )
      if (!written.has(check.key) && written.size >= EXECUTION_LIMITS.files) {
        throw new AppError('TOO_LARGE', `Au plus ${EXECUTION_LIMITS.files} fichiers par passe : arrête-toi là.`)
      }
      before = this.deps.files.read(projectDir, relative)?.content ?? null
      next = produce(before)
      this.deps.files.write(projectDir, relative, next)
    } catch (error) {
      this.event(open.id, 'refus', relative.slice(0, 260), error instanceof Error ? error.message : 'refusé')
      this.deps.emit(open.neuronId)
      throw error
    }
    const key = relative.toLowerCase()
    repository.transaction(() => {
      const existing = repository.file(open.neuronId, key)
      const firstThisPass = !repository
        .eventsOf(open.id)
        .some((event) => event.kind === 'ecriture' && event.path?.toLowerCase() === key)
      if (existing === undefined) {
        repository.insertFile({
          id: randomUUID(),
          neuronId: open.neuronId,
          path: relative,
          pathKey: key,
          beforeContent: before,
          afterContent: next,
          afterHash: hashOf(next),
          updatedAt: this.now()
        })
      } else {
        repository.updateFile(existing.id, {
          afterContent: next,
          afterHash: hashOf(next),
          updatedAt: this.now(),
          revertedAt: null
        })
      }
      repository.addEvent({ executionId: open.id, at: this.now(), kind: 'ecriture', path: relative, detail: null })
      if (firstThisPass) repository.countWrite(open.id)
      repository.log(
        randomUUID(),
        [
          {
            kind: 'mcp_write',
            entity: 'project_file',
            entityId: `${open.neuronId}:${relative}`,
            before: { path: relative, content: before },
            after: { path: relative, content: next }
          }
        ],
        'claude'
      )
    })
    this.deps.emit(open.neuronId)
    const original = repository.file(open.neuronId, key)
    return { path: relative, status: original?.beforeContent === null ? 'cree' : 'modifie' }
  }

  private finish(executionId: string, outcome: ExecutionOutcome, detail: string | null): void {
    const { repository } = this.deps
    const execution = repository.openExecutions().find((open) => open.id === executionId)
    if (execution === undefined) return
    clearTimeout(this.timers.get(execution.neuronId))
    this.timers.delete(execution.neuronId)
    const hasFiles = repository.files(execution.neuronId).length > 0
    repository.transaction(() => {
      repository.endExecution(executionId, this.now(), outcome)
      if (detail !== null) repository.addEvent({ executionId, at: this.now(), kind: 'message', path: null, detail })
      repository.setState(execution.neuronId, outcome === 'terminee' || hasFiles ? 'a_revoir' : 'prete')
    })
    this.deps.emit(execution.neuronId)
  }

  private event(executionId: string, kind: ExecutionEventKind, path: string | null, detail: string | null): void {
    this.deps.repository.addEvent({ executionId, at: this.now(), kind, path, detail: detail?.slice(0, 500) ?? null })
  }

  private brief(
    action: FinalActionRow,
    steps: readonly StepRow[],
    step: StepRow,
    projectDir: string | null,
    correction: string | null
  ): string {
    const byId = new Map(steps.map((entry) => [entry.id, entry] as const))
    const ranksOf = (row: StepRow): number[] => {
      const ranks = [row.rank]
      let parent = byId.get(row.parentId)
      for (let guard = 0; parent !== undefined && guard < 10; guard++) {
        ranks.unshift(parent.rank)
        parent = byId.get(parent.parentId)
      }
      return ranks
    }
    const ranks = ranksOf(step)
    const ancestors: { title: string; label: string | null; id: string }[] = []
    let parentId: string | null = step.parentId
    for (let guard = 0; parentId !== null && guard < 10; guard++) {
      const parent = byId.get(parentId)
      if (parent === undefined) {
        const genesis = this.deps.plan.node(parentId)
        if (genesis !== undefined) ancestors.unshift({ id: genesis.id, title: genesis.title, label: null })
        break
      }
      ancestors.unshift({ id: parent.id, title: parent.title, label: rankLabel(ranksOf(parent)) })
      parentId = parent.parentId
    }
    const pathIds = new Set([...ancestors.map((node) => node.id), step.id])
    return executionBrief({
      title: step.title,
      label: rankLabel(ranks),
      deliverable: action.deliverable,
      reason: action.reason,
      path: ancestors,
      prerequisites: step.waitsFor
        .map((id) => byId.get(id))
        .filter((entry): entry is StepRow => entry !== undefined)
        .map((entry) => ({
          title: entry.title,
          label: rankLabel(ranksOf(entry)),
          done: entry.status === 'fait',
          files: this.deps.repository.files(entry.id).map((file) => file.path)
        })),
      documents: this.deps.documents(pathIds),
      folder: projectDir === null ? null : basename(projectDir),
      currentFiles: this.deps.repository.files(step.id).map((file) => file.path),
      correction,
      scripts: this.deps.scripts?.(action.genesisId) ?? []
    })
  }

  private fileTarget(
    id: string
  ): { readonly neuronId: string; readonly projectDir: string; readonly path: string } | null {
    const at = id.indexOf(':')
    if (at < 0) return null
    const neuronId = id.slice(0, at)
    const action = this.deps.repository.get(neuronId)
    const projectDir = action === undefined ? null : this.deps.projectDir(action.genesisId)
    return projectDir === null ? null : { neuronId, projectDir, path: id.slice(at + 1) }
  }

  private now(): string {
    return (this.deps.now?.() ?? new Date()).toISOString()
  }
}
