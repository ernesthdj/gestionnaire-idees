import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'
import type { FinalState } from '../../../domain/finals/state'
import type { AppDatabase } from '../client'
import { writeChanges, type ChangeEntry } from './changeLog'
import { deliverableFiles, executionEvents, executions, finalActions } from '../schemaNeurons'

export type { FinalState }
export type ExecutionOutcome = 'terminee' | 'arretee' | 'interrompue' | 'echouee'
export type ExecutionEventKind = 'lecture' | 'ecriture' | 'refus' | 'message' | 'commande'

export interface FinalActionRow {
  readonly neuronId: string
  readonly genesisId: string
  readonly deliverable: string
  readonly reason: string
  readonly state: FinalState
  readonly origin: 'user' | 'claude'
  readonly proposedAt: string
  readonly acceptedAt: string | null
  readonly archivedAt: string | null
  readonly offsetX: number
  readonly offsetY: number
  readonly width: number
  readonly height: number
}

export interface ExecutionRow {
  readonly id: string
  readonly neuronId: string
  readonly genesisId: string
  readonly startedAt: string
  readonly endedAt: string | null
  readonly outcome: ExecutionOutcome | null
  readonly correction: string | null
  readonly filesWritten: number
}

export interface ExecutionEventRow {
  readonly id: number
  readonly executionId: string
  readonly at: string
  readonly kind: ExecutionEventKind
  readonly path: string | null
  readonly detail: string | null
}

export interface DeliverableFileRow {
  readonly id: string
  readonly neuronId: string
  readonly path: string
  readonly pathKey: string
  readonly beforeContent: string | null
  readonly afterContent: string
  readonly afterHash: string
  readonly updatedAt: string
  readonly revertedAt: string | null
}

export type NewProposal = Pick<
  FinalActionRow,
  'neuronId' | 'genesisId' | 'deliverable' | 'reason' | 'origin' | 'proposedAt'
>

/** Actions finales, exécutions, leur fil et les fichiers de leur livrable (spec 013). */
export class FinalRepository {
  constructor(private readonly db: AppDatabase) {}

  transaction<T>(work: () => T): T {
    return this.db.transaction(() => work())
  }

  log(batchId: string, entries: readonly ChangeEntry[], actor: 'user' | 'claude'): void {
    writeChanges(this.db, batchId, entries, actor)
  }

  /** Ligne de l'action, archivée ou non. */
  get(neuronId: string): FinalActionRow | undefined {
    return this.db.select().from(finalActions).where(eq(finalActions.neuronId, neuronId)).get()
  }

  /** Action vivante (proposée ou acceptée, non archivée). */
  active(neuronId: string): FinalActionRow | undefined {
    const row = this.get(neuronId)
    return row?.archivedAt === null ? row : undefined
  }

  /** Actions vivantes, dans l'ordre de proposition. */
  list(): FinalActionRow[] {
    return this.db
      .select()
      .from(finalActions)
      .where(isNull(finalActions.archivedAt))
      .orderBy(asc(finalActions.proposedAt))
      .all()
  }

  /** Nouvelle proposition ; une ancienne ligne archivée de la même étape repart de zéro (place et taille gardées). */
  propose(proposal: NewProposal): void {
    const fresh = { ...proposal, state: 'proposee' as const, acceptedAt: null, archivedAt: null }
    this.db.insert(finalActions).values(fresh).onConflictDoUpdate({ target: finalActions.neuronId, set: fresh }).run()
  }

  /** Remet une ligne telle qu'elle était (Historique) ; `null` : la ligne n'existait pas → archivée. */
  restore(neuronId: string, row: FinalActionRow | null, archivedAt: string): void {
    if (row === null) this.setArchived(neuronId, archivedAt)
    else this.db.update(finalActions).set(row).where(eq(finalActions.neuronId, neuronId)).run()
  }

  setState(neuronId: string, state: FinalState, acceptedAt?: string): void {
    this.db
      .update(finalActions)
      .set(acceptedAt === undefined ? { state } : { state, acceptedAt })
      .where(eq(finalActions.neuronId, neuronId))
      .run()
  }

  setArchived(neuronId: string, archivedAt: string | null): void {
    this.db.update(finalActions).set({ archivedAt }).where(eq(finalActions.neuronId, neuronId)).run()
  }

  setOffset(neuronId: string, x: number, y: number): void {
    this.db.update(finalActions).set({ offsetX: x, offsetY: y }).where(eq(finalActions.neuronId, neuronId)).run()
  }

  setSize(neuronId: string, width: number, height: number): void {
    this.db.update(finalActions).set({ width, height }).where(eq(finalActions.neuronId, neuronId)).run()
  }

  startExecution(execution: Pick<ExecutionRow, 'id' | 'neuronId' | 'genesisId' | 'startedAt' | 'correction'>): void {
    this.db.insert(executions).values(execution).run()
  }

  execution(id: string): ExecutionRow | undefined {
    return this.db.select().from(executions).where(eq(executions.id, id)).get()
  }

  /** Exécution ouverte d'un genesis (au plus une, index unique partiel). */
  openOfGenesis(genesisId: string): ExecutionRow | undefined {
    return this.db
      .select()
      .from(executions)
      .where(and(eq(executions.genesisId, genesisId), isNull(executions.endedAt)))
      .get()
  }

  /** Exécution ouverte d'une action. */
  openOf(neuronId: string): ExecutionRow | undefined {
    return this.db
      .select()
      .from(executions)
      .where(and(eq(executions.neuronId, neuronId), isNull(executions.endedAt)))
      .get()
  }

  /** Toutes les exécutions restées ouvertes (au démarrage : l'app a été fermée pendant une exécution). */
  openExecutions(): ExecutionRow[] {
    return this.db.select().from(executions).where(isNull(executions.endedAt)).all()
  }

  /** Exécutions d'une action, la plus récente d'abord. */
  executionsOf(neuronId: string): ExecutionRow[] {
    return this.db
      .select()
      .from(executions)
      .where(eq(executions.neuronId, neuronId))
      .orderBy(desc(executions.startedAt), desc(sql`${executions}.rowid`))
      .all()
  }

  endExecution(id: string, endedAt: string, outcome: ExecutionOutcome): void {
    this.db.update(executions).set({ endedAt, outcome }).where(eq(executions.id, id)).run()
  }

  countWrite(id: string): void {
    this.db
      .update(executions)
      .set({ filesWritten: sql`${executions.filesWritten} + 1` })
      .where(eq(executions.id, id))
      .run()
  }

  addEvent(event: Omit<ExecutionEventRow, 'id'>): void {
    this.db.insert(executionEvents).values(event).run()
  }

  eventsOf(executionId: string): ExecutionEventRow[] {
    return this.db
      .select()
      .from(executionEvents)
      .where(eq(executionEvents.executionId, executionId))
      .orderBy(asc(executionEvents.id))
      .all()
  }

  file(neuronId: string, pathKey: string): DeliverableFileRow | undefined {
    return this.db
      .select()
      .from(deliverableFiles)
      .where(and(eq(deliverableFiles.neuronId, neuronId), eq(deliverableFiles.pathKey, pathKey)))
      .get()
  }

  /** Fichiers du livrable d'une action, dans l'ordre de première écriture. */
  files(neuronId: string): DeliverableFileRow[] {
    return this.db
      .select()
      .from(deliverableFiles)
      .where(eq(deliverableFiles.neuronId, neuronId))
      .orderBy(asc(sql`${deliverableFiles}.rowid`))
      .all()
  }

  insertFile(row: Omit<DeliverableFileRow, 'revertedAt'>): void {
    this.db.insert(deliverableFiles).values(row).run()
  }

  /** Nouveau contenu écrit ; le contenu d'avant la première écriture n'est jamais remplacé. */
  updateFile(
    id: string,
    patch: Pick<DeliverableFileRow, 'afterContent' | 'afterHash' | 'updatedAt'> & { revertedAt?: string | null }
  ): void {
    this.db.update(deliverableFiles).set(patch).where(eq(deliverableFiles.id, id)).run()
  }
}
