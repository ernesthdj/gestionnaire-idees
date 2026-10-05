import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm'
import type { AppDatabase } from '../client'
import { writeChanges, type ChangeEntry } from './changeLog'
import { neurons, planProposalItems, planProposals, stepDependencies } from '../schemaNeurons'

export type StepStatus = 'a_faire' | 'en_cours' | 'fait' | 'bloque'

/** Genesis ou étape d'un plan d'attaque, vivant (non archivé). */
export interface PlanNodeRow {
  readonly id: string
  readonly kind: string
  readonly rootId: string
  /** Genesis de l'arbre : lui-même pour un genesis. */
  readonly genesisId: string
  readonly parentId: string | null
  readonly depth: number
  readonly title: string
  readonly lockedAt: string | null
  readonly lockProposedAt: string | null
}

export interface StepRow extends PlanNodeRow {
  readonly parentId: string
  readonly rank: number
  readonly status: StepStatus
  readonly waitsFor: readonly string[]
  readonly sheetJson: string | null
}

export interface ProposalItemRow {
  readonly id: string
  readonly proposalId: string
  readonly key: string
  readonly title: string
  readonly why: string
  readonly rank: number
  readonly waitsFor: readonly string[]
  readonly status: 'en_attente' | 'valide' | 'refuse'
  readonly bornId: string | null
}

export interface ProposalRow {
  readonly id: string
  readonly parentId: string
  readonly status: 'en_attente' | 'decidee' | 'remplacee'
  readonly items: readonly ProposalItemRow[]
}

export interface NewStep {
  readonly id: string
  readonly genesisId: string
  readonly parentId: string
  readonly depth: number
  readonly rank: number
  readonly title: string
  /** « Pourquoi » de la proposition : description de l'étape. */
  readonly content: string
}

export interface NewProposalItem {
  readonly id: string
  readonly key: string
  readonly title: string
  readonly why: string
  readonly rank: number
  /** Clés locales ou identifiants d'étapes sœurs existantes. */
  readonly waitsFor: readonly string[]
}

const parseIds = (json: string): string[] => {
  try {
    const value: unknown = JSON.parse(json)
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

/** Titre comparable (mémoire des refus) : minuscules, sans accents ni ponctuation. */
export function normalizeTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

const STEP_STATUSES: readonly StepStatus[] = ['a_faire', 'en_cours', 'fait', 'bloque']
const statusOf = (value: string | null): StepStatus => STEP_STATUSES.find((status) => status === value) ?? 'a_faire'

const NODE_COLUMNS = {
  id: neurons.id,
  kind: neurons.kind,
  rootId: neurons.rootId,
  genesisId: neurons.genesisId,
  parentId: neurons.parentId,
  depth: neurons.depth,
  title: neurons.title,
  lockedAt: neurons.lockedAt,
  lockProposedAt: neurons.lockProposedAt,
  rank: neurons.rank,
  stepStatus: neurons.stepStatus,
  sheetJson: neurons.sheetJson
} as const

/** Plans d'attaque (spec 011) : étapes, dépendances, propositions de couche et verrous. */
export class PlanRepository {
  constructor(private readonly db: AppDatabase) {}

  transaction<T>(work: () => T): T {
    return this.db.transaction(() => work())
  }

  log(batchId: string, entries: readonly ChangeEntry[], actor: 'user' | 'claude' = 'user'): void {
    writeChanges(this.db, batchId, entries, actor)
  }

  /** Genesis ou étape vivants ; `undefined` sinon (élément de structure, idée archivée, inconnu). */
  node(id: string): PlanNodeRow | undefined {
    const row = this.db
      .select(NODE_COLUMNS)
      .from(neurons)
      .where(and(eq(neurons.id, id), ne(neurons.state, 'archived')))
      .get()
    if (row === undefined || (row.kind !== 'root' && row.kind !== 'step')) return undefined
    return {
      id: row.id,
      kind: row.kind,
      rootId: row.rootId,
      genesisId: row.genesisId ?? row.id,
      parentId: row.parentId,
      depth: row.depth,
      title: row.title,
      lockedAt: row.lockedAt,
      lockProposedAt: row.lockProposedAt
    }
  }

  /** Étapes vivantes, par parent puis par rang ; d'un seul genesis si fourni. */
  steps(genesisId?: string): StepRow[] {
    const conditions = [eq(neurons.kind, 'step'), ne(neurons.state, 'archived')]
    if (genesisId !== undefined) conditions.push(eq(neurons.genesisId, genesisId))
    const rows = this.db
      .select(NODE_COLUMNS)
      .from(neurons)
      .where(and(...conditions))
      .orderBy(asc(neurons.parentId), asc(neurons.rank))
      .all()
    const waits = this.dependenciesOf(rows.map((row) => row.id))
    return rows.flatMap((row): StepRow[] =>
      row.parentId === null || row.genesisId === null
        ? []
        : [
            {
              id: row.id,
              kind: row.kind,
              rootId: row.rootId,
              genesisId: row.genesisId,
              parentId: row.parentId,
              depth: row.depth,
              title: row.title,
              lockedAt: row.lockedAt,
              lockProposedAt: row.lockProposedAt,
              rank: row.rank ?? 0,
              status: statusOf(row.stepStatus),
              waitsFor: waits.get(row.id) ?? [],
              sheetJson: row.sheetJson
            }
          ]
    )
  }

  /** Étapes vivantes d'un parent, par rang. */
  children(parentId: string): StepRow[] {
    const genesisId = this.node(parentId)?.genesisId
    return genesisId === undefined ? [] : this.steps(genesisId).filter((row) => row.parentId === parentId)
  }

  insertStep(step: NewStep): void {
    this.db
      .insert(neurons)
      .values({
        id: step.id,
        rootId: step.genesisId,
        genesisId: step.genesisId,
        parentId: step.parentId,
        depth: step.depth,
        kind: 'step',
        title: step.title,
        content: step.content,
        origin: 'claude',
        state: 'raw',
        rank: step.rank,
        stepStatus: 'a_faire'
      })
      .run()
  }

  /** Archive (`true`) ou restaure (`false`) une étape. */
  setArchived(id: string, archived: boolean): void {
    this.db
      .update(neurons)
      .set({ state: archived ? 'archived' : 'raw', archivedAt: archived ? new Date().toISOString() : null })
      .where(eq(neurons.id, id))
      .run()
  }

  setRank(id: string, rank: number): void {
    this.db.update(neurons).set({ rank }).where(eq(neurons.id, id)).run()
  }

  setStatus(id: string, status: StepStatus): void {
    this.db.update(neurons).set({ stepStatus: status }).where(eq(neurons.id, id)).run()
  }

  dependenciesOf(stepIds: readonly string[]): Map<string, string[]> {
    const waits = new Map<string, string[]>()
    if (stepIds.length === 0) return waits
    const rows = this.db
      .select()
      .from(stepDependencies)
      .where(inArray(stepDependencies.stepId, [...stepIds]))
      .all()
    for (const row of rows) waits.set(row.stepId, [...(waits.get(row.stepId) ?? []), row.waitsForId])
    return waits
  }

  addDependency(stepId: string, waitsForId: string): void {
    this.db.insert(stepDependencies).values({ stepId, waitsForId }).onConflictDoNothing().run()
  }

  removeDependency(stepId: string, waitsForId: string): void {
    this.db
      .delete(stepDependencies)
      .where(and(eq(stepDependencies.stepId, stepId), eq(stepDependencies.waitsForId, waitsForId)))
      .run()
  }

  /** Dépendances qui touchent une étape (dans les deux sens). */
  dependenciesTouching(stepId: string): { readonly stepId: string; readonly waitsForId: string }[] {
    return this.db
      .select()
      .from(stepDependencies)
      .where(sql`${stepDependencies.stepId} = ${stepId} OR ${stepDependencies.waitsForId} = ${stepId}`)
      .all()
  }

  /** Verrous et propositions de verrou des genesis vivants. */
  rootLocks(): Map<string, { readonly locked: boolean; readonly lockProposed: boolean }> {
    return new Map(
      this.db
        .select({ id: neurons.id, lockedAt: neurons.lockedAt, lockProposedAt: neurons.lockProposedAt })
        .from(neurons)
        .where(and(eq(neurons.kind, 'root'), ne(neurons.state, 'archived')))
        .all()
        .map((row) => [row.id, { locked: row.lockedAt !== null, lockProposed: row.lockProposedAt !== null }] as const)
    )
  }

  setLock(id: string, lockedAt: string | null): void {
    this.db.update(neurons).set({ lockedAt, lockProposedAt: null }).where(eq(neurons.id, id)).run()
  }

  setLockProposal(id: string, proposedAt: string | null): void {
    this.db.update(neurons).set({ lockProposedAt: proposedAt }).where(eq(neurons.id, id)).run()
  }

  /** Remplace la proposition en attente du parent (ses items non décidés sont abandonnés, sans mémoire de refus). */
  createProposal(id: string, parentId: string, items: readonly NewProposalItem[]): void {
    this.db
      .update(planProposals)
      .set({ status: 'remplacee' })
      .where(and(eq(planProposals.parentId, parentId), eq(planProposals.status, 'en_attente')))
      .run()
    this.db.insert(planProposals).values({ id, parentId, status: 'en_attente' }).run()
    if (items.length === 0) return
    this.db
      .insert(planProposalItems)
      .values(
        items.map((item) => ({
          id: item.id,
          proposalId: id,
          key: item.key,
          title: item.title,
          why: item.why,
          rank: item.rank,
          waitsForJson: JSON.stringify(item.waitsFor),
          status: 'en_attente' as const
        }))
      )
      .run()
  }

  proposal(id: string): ProposalRow | undefined {
    const row = this.db.select().from(planProposals).where(eq(planProposals.id, id)).get()
    return row === undefined
      ? undefined
      : { id: row.id, parentId: row.parentId, status: row.status, items: this.items([id]) }
  }

  /** Propositions en attente (toutes, ou d'un parent), avec leurs items. */
  pendingProposals(parentId?: string): ProposalRow[] {
    const conditions = [eq(planProposals.status, 'en_attente')]
    if (parentId !== undefined) conditions.push(eq(planProposals.parentId, parentId))
    const rows = this.db
      .select()
      .from(planProposals)
      .where(and(...conditions))
      .orderBy(asc(sql`${planProposals}.rowid`))
      .all()
    const items = this.items(rows.map((row) => row.id))
    return rows.map((row) => ({
      id: row.id,
      parentId: row.parentId,
      status: row.status,
      items: items.filter((item) => item.proposalId === row.id)
    }))
  }

  /** Titres normalisés déjà refusés par mentalyas pour ce parent. */
  refusedTitles(parentId: string): Set<string> {
    const rows = this.db
      .select({ title: planProposalItems.title })
      .from(planProposalItems)
      .innerJoin(planProposals, eq(planProposals.id, planProposalItems.proposalId))
      .where(and(eq(planProposals.parentId, parentId), eq(planProposalItems.status, 'refuse')))
      .all()
    return new Set(rows.map((row) => normalizeTitle(row.title)))
  }

  decideItem(itemId: string, status: 'valide' | 'refuse', bornId: string | null = null): void {
    this.db.update(planProposalItems).set({ status, bornId }).where(eq(planProposalItems.id, itemId)).run()
  }

  /** Clôt la proposition quand plus aucun item n'attend. */
  closeIfDecided(proposalId: string): void {
    if (this.items([proposalId]).some((item) => item.status === 'en_attente')) return
    this.db.update(planProposals).set({ status: 'decidee' }).where(eq(planProposals.id, proposalId)).run()
  }

  private items(proposalIds: readonly string[]): ProposalItemRow[] {
    if (proposalIds.length === 0) return []
    return this.db
      .select()
      .from(planProposalItems)
      .where(inArray(planProposalItems.proposalId, [...proposalIds]))
      .orderBy(asc(planProposalItems.rank))
      .all()
      .map((row) => ({
        id: row.id,
        proposalId: row.proposalId,
        key: row.key,
        title: row.title,
        why: row.why,
        rank: row.rank,
        waitsFor: parseIds(row.waitsForJson),
        status: row.status,
        bornId: row.bornId
      }))
  }
}
