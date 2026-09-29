import { randomUUID } from 'node:crypto'
import { and, desc, eq, inArray, or, type SQL } from 'drizzle-orm'
import type { LinkStatus, LinkView, SeedStatus, SeedView, Source } from '@shared/ipc/neurons'
import type { Fiche } from '../../../domain/neurons/links'
import type { AppDatabase } from '../client'
import { linkSeeds, neuronLinks, neurons, planNodes, reflectionSummaries } from '../schemaNeurons'
import { writeChanges, type ChangeEntry } from './changeLog'

export interface LinkRow {
  readonly id: string
  readonly aRootId: string
  readonly bRootId: string
  readonly label: string
  readonly justification: string | null
  readonly origin: Source
  readonly status: LinkStatus
  readonly fingerprint: string
  readonly createdAt: string
}

const LINK_COLUMNS = {
  id: neuronLinks.id,
  aRootId: neuronLinks.aRootId,
  bRootId: neuronLinks.bRootId,
  label: neuronLinks.label,
  justification: neuronLinks.justification,
  origin: neuronLinks.origin,
  status: neuronLinks.status,
  fingerprint: neuronLinks.fingerprint,
  createdAt: neuronLinks.createdAt
}

function pointTexts(json: string): string[] {
  const parsed: unknown = JSON.parse(json)
  if (!Array.isArray(parsed)) return []
  return parsed.flatMap((point: unknown) =>
    typeof point === 'object' && point !== null && 'text' in point && typeof point.text === 'string' ? [point.text] : []
  )
}

export interface SeedRow {
  readonly id: string
  readonly linkId: string
  readonly title: string
  readonly why: string
  readonly status: SeedStatus
  readonly bornRootId: string | null
}

const SEED_COLUMNS = {
  id: linkSeeds.id,
  linkId: linkSeeds.linkId,
  title: linkSeeds.title,
  why: linkSeeds.why,
  status: linkSeeds.status,
  bornRootId: linkSeeds.bornRootId
}

/** Liens entre idées et fiches des idées écloses (spec 002 US4). */
export class LinkRepository {
  constructor(private readonly db: AppDatabase) {}

  transaction<T>(work: () => T): T {
    return this.db.transaction(() => work())
  }

  /** Fiches de toutes les idées écloses : titre, texte, points clés du plan ou de la synthèse en cours. */
  hatchedFiches(): Fiche[] {
    return this.fiches(eq(neurons.state, 'hatched'))
  }

  /** Fiches de quelques idées, quel que soit leur état (graine d'un lien créé à la main). */
  fichesOf(ids: readonly string[]): Fiche[] {
    return ids.length === 0 ? [] : this.fiches(inArray(neurons.id, [...ids]))
  }

  private fiches(where: SQL): Fiche[] {
    const roots = this.db
      .select({ id: neurons.id, title: neurons.title, content: neurons.content, categoryId: neurons.categoryId })
      .from(neurons)
      .where(and(eq(neurons.kind, 'root'), where))
      .all()
    if (roots.length === 0) return []
    const ids = roots.map((root) => root.id)
    const highlights = new Map<string, string[]>()
    const add = (rootId: string, texts: readonly string[]): void => {
      highlights.set(rootId, [...(highlights.get(rootId) ?? []), ...texts])
    }
    for (const node of this.db
      .select({ rootId: planNodes.rootId, title: planNodes.title })
      .from(planNodes)
      .where(and(inArray(planNodes.rootId, ids), eq(planNodes.isCurrent, true)))
      .all()) {
      add(node.rootId, [node.title])
    }
    for (const summary of this.db
      .select({
        rootId: reflectionSummaries.rootId,
        keyPointsJson: reflectionSummaries.keyPointsJson,
        decisionsJson: reflectionSummaries.decisionsJson
      })
      .from(reflectionSummaries)
      .where(and(inArray(reflectionSummaries.rootId, ids), eq(reflectionSummaries.isCurrent, true)))
      .all()) {
      add(summary.rootId, [...pointTexts(summary.keyPointsJson), ...pointTexts(summary.decisionsJson)])
    }
    return roots.map((root) => ({
      id: root.id,
      title: root.title,
      categoryId: root.categoryId,
      text: [root.title, root.content ?? '', ...(highlights.get(root.id) ?? [])]
        .filter((part) => part !== '')
        .join('. ')
    }))
  }

  rootTitle(id: string): string | undefined {
    return this.db
      .select({ title: neurons.title })
      .from(neurons)
      .where(and(eq(neurons.id, id), eq(neurons.kind, 'root')))
      .get()?.title
  }

  /** Empreintes déjà connues (proposées, acceptées ou refusées) : jamais reproposées. */
  fingerprints(): Map<string, LinkStatus> {
    return new Map(
      this.db
        .select({ fingerprint: neuronLinks.fingerprint, status: neuronLinks.status })
        .from(neuronLinks)
        .all()
        .map((row) => [row.fingerprint, row.status])
    )
  }

  insert(input: Omit<LinkRow, 'id' | 'createdAt'>): string {
    const id = randomUUID()
    this.db
      .insert(neuronLinks)
      .values({ id, ...input })
      .run()
    return id
  }

  link(id: string): LinkRow | undefined {
    return this.db.select(LINK_COLUMNS).from(neuronLinks).where(eq(neuronLinks.id, id)).get()
  }

  update(id: string, patch: { status?: LinkStatus; label?: string; fingerprint?: string }): void {
    this.db
      .update(neuronLinks)
      .set({ ...patch, ...(patch.status === undefined ? {} : { decidedAt: new Date().toISOString() }) })
      .where(eq(neuronLinks.id, id))
      .run()
  }

  delete(id: string): void {
    this.db.delete(neuronLinks).where(eq(neuronLinks.id, id)).run()
  }

  log(batchId: string, entries: readonly ChangeEntry[]): void {
    writeChanges(this.db, batchId, entries)
  }

  /** Liens (refusés exclus sauf demande), les plus récents d'abord, avec les titres des deux idées. */
  list(status?: LinkStatus): LinkView[] {
    const rows = this.db
      .select(LINK_COLUMNS)
      .from(neuronLinks)
      .where(
        status === undefined ? inArray(neuronLinks.status, ['suggested', 'accepted']) : eq(neuronLinks.status, status)
      )
      .orderBy(desc(neuronLinks.createdAt))
      .all()
    if (rows.length === 0) return []
    const titles = new Map(
      this.db
        .select({ id: neurons.id, title: neurons.title })
        .from(neurons)
        .where(inArray(neurons.id, [...new Set(rows.flatMap((row) => [row.aRootId, row.bRootId]))]))
        .all()
        .map((row) => [row.id, row.title])
    )
    return rows.map((row) => this.view(row, titles))
  }

  /** Une seule graine par lien : renvoie `false` si ce lien en a déjà eu une (même refusée). */
  insertSeed(input: { readonly linkId: string; readonly title: string; readonly why: string }): boolean {
    const result = this.db
      .insert(linkSeeds)
      .values({ id: randomUUID(), ...input, status: 'suggested' })
      .onConflictDoNothing({ target: linkSeeds.linkId })
      .run()
    return result.changes > 0
  }

  hasSeed(linkId: string): boolean {
    return this.db.select({ id: linkSeeds.id }).from(linkSeeds).where(eq(linkSeeds.linkId, linkId)).get() !== undefined
  }

  seed(id: string): SeedRow | undefined {
    return this.db.select(SEED_COLUMNS).from(linkSeeds).where(eq(linkSeeds.id, id)).get()
  }

  updateSeed(id: string, patch: { readonly status: SeedStatus; readonly bornRootId?: string | null }): void {
    this.db
      .update(linkSeeds)
      .set({ ...patch, decidedAt: patch.status === 'suggested' ? null : new Date().toISOString() })
      .where(eq(linkSeeds.id, id))
      .run()
  }

  /** Graines visibles : en attente sur un lien accepté (FR-028), ou acceptées (« née de A × B »). */
  seeds(): SeedView[] {
    const rows = this.db
      .select({ ...SEED_COLUMNS, aRootId: neuronLinks.aRootId, bRootId: neuronLinks.bRootId })
      .from(linkSeeds)
      .innerJoin(neuronLinks, eq(linkSeeds.linkId, neuronLinks.id))
      .where(
        or(and(eq(linkSeeds.status, 'suggested'), eq(neuronLinks.status, 'accepted')), eq(linkSeeds.status, 'accepted'))
      )
      .orderBy(desc(linkSeeds.createdAt))
      .all()
    return rows.map((row) => ({
      id: row.id,
      linkId: row.linkId,
      title: row.title,
      why: row.why,
      status: row.status,
      bornRootId: row.bornRootId,
      parents: [
        { id: row.aRootId, title: this.rootTitle(row.aRootId) ?? '' },
        { id: row.bRootId, title: this.rootTitle(row.bRootId) ?? '' }
      ]
    }))
  }

  /** Position mémorisée d'une idée sur la carte (placement d'une idée née entre ses parents). */
  position(rootId: string): { readonly x: number; readonly y: number } | undefined {
    const row = this.db.select({ x: neurons.posX, y: neurons.posY }).from(neurons).where(eq(neurons.id, rootId)).get()
    return row === undefined || row.x === null || row.y === null ? undefined : { x: row.x, y: row.y }
  }

  view(row: LinkRow, titles?: ReadonlyMap<string, string>): LinkView {
    const title = (id: string): string => titles?.get(id) ?? this.rootTitle(id) ?? ''
    return {
      id: row.id,
      a: { id: row.aRootId, title: title(row.aRootId) },
      b: { id: row.bRootId, title: title(row.bRootId) },
      label: row.label,
      justification: row.justification,
      origin: row.origin,
      status: row.status,
      createdAt: row.createdAt
    }
  }
}
