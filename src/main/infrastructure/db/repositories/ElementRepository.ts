import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm'
import {
  ELEMENT_STATUSES,
  type ElementStatus,
  type ElementType,
  type ElementView,
  type StructureArchitectureView
} from '@shared/ipc/canvas'
import { inferLayer, isArchitectureKind, layerOf } from '@shared/structure/architecture'
import type { AppDatabase } from '../client'
import { writeChanges, type ChangeEntry } from './changeLog'
import { neurons } from '../schemaNeurons'

export interface ElementRow {
  readonly id: string
  readonly genesisId: string
  readonly parentId: string
  readonly key: string
  readonly type: ElementType
  readonly title: string
  /** Résumé donné à la cartographie. */
  readonly content: string | null
  readonly status: ElementStatus | null
  readonly paths: readonly string[]
  readonly collapsed: boolean
  readonly sheetJson: string | null
  readonly depth: number
  /** Rang de progression parmi ses frères (D17) ; `null` : non donné. */
  readonly rank: number | null
  /** Couche d'architecture (D20) et qui l'a donnée ; `null` : aucune couche enregistrée. */
  readonly layer: string | null
  readonly layerSource: 'claude' | 'user' | null
}

export interface NewElement {
  readonly id: string
  readonly genesisId: string
  readonly parentId: string
  readonly depth: number
  readonly key: string
  readonly type: ElementType
  readonly title: string
  readonly content: string | null
  readonly status: ElementStatus | null
  readonly paths: readonly string[]
  readonly rank: number | null
  readonly layer: string | null
  readonly layerSource: 'claude' | 'user' | null
}

const parsePaths = (json: string | null): string[] => {
  if (json === null) return []
  try {
    const value: unknown = JSON.parse(json)
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

const statusOf = (value: string | null): ElementStatus | null =>
  value !== null && (ELEMENT_STATUSES as readonly string[]).includes(value) ? (value as ElementStatus) : null

/** Éléments des cartes de structure (spec 009) : des neurones `kind = 'element'`, rattachés à un genesis. */
export class ElementRepository {
  constructor(private readonly db: AppDatabase) {}

  transaction<T>(work: () => T): T {
    return this.db.transaction(() => work())
  }

  /** Éléments visibles (non archivés) d'un projet, ou de tous les projets. */
  list(genesisId?: string): ElementRow[] {
    const conditions = [eq(neurons.kind, 'element'), ne(neurons.state, 'archived')]
    if (genesisId !== undefined) conditions.push(eq(neurons.genesisId, genesisId))
    return this.db
      .select({
        id: neurons.id,
        genesisId: neurons.genesisId,
        parentId: neurons.parentId,
        key: neurons.elementKey,
        type: neurons.elementType,
        title: neurons.title,
        content: neurons.content,
        status: neurons.elementStatus,
        pathsJson: neurons.pathsJson,
        collapsed: neurons.collapsed,
        sheetJson: neurons.sheetJson,
        depth: neurons.depth,
        rank: neurons.rank,
        layer: neurons.layer,
        layerSource: neurons.layerSource
      })
      .from(neurons)
      .where(and(...conditions))
      .orderBy(asc(sql`${neurons}.rowid`))
      .all()
      .flatMap((row): ElementRow[] =>
        row.genesisId === null || row.key === null || row.type === null
          ? []
          : [
              {
                id: row.id,
                genesisId: row.genesisId,
                parentId: row.parentId ?? row.genesisId,
                key: row.key,
                type: row.type,
                title: row.title,
                content: row.content,
                status: statusOf(row.status),
                paths: parsePaths(row.pathsJson),
                collapsed: row.collapsed,
                sheetJson: row.sheetJson,
                depth: row.depth,
                rank: row.rank,
                layer: row.layer,
                layerSource: row.layerSource
              }
            ]
      )
  }

  /** Vues de la carte : avec le nombre d'enfants et le résumé (fiche, sinon résumé de cartographie). */
  views(): ElementView[] {
    const rows = this.list()
    const architectures = new Map(
      this.architectures([...new Set(rows.map((row) => row.genesisId))]).map((entry) => [entry.genesisId, entry.kind])
    )
    const children = new Map<string, number>()
    for (const row of rows) children.set(row.parentId, (children.get(row.parentId) ?? 0) + 1)
    return rows.map((row) => {
      let summary = row.content
      try {
        const resume = (JSON.parse(row.sheetJson ?? '{}') as { resume?: unknown }).resume
        if (typeof resume === 'string' && resume.trim() !== '') summary = resume.trim()
      } catch {
        // Fiche abîmée : on garde le résumé de cartographie.
      }
      return {
        id: row.id,
        genesisId: row.genesisId,
        parentId: row.parentId,
        key: row.key,
        type: row.type,
        title: row.title,
        status: row.status,
        summary,
        paths: row.paths,
        collapsed: row.collapsed,
        childCount: children.get(row.id) ?? 0,
        order: row.rank,
        ...this.layerView(row, architectures.get(row.genesisId) ?? null)
      }
    })
  }

  /** Couche affichée (D20) : celle enregistrée si elle appartient à l'architecture, sinon la déduction de l'app. */
  private layerView(
    row: ElementRow,
    kind: StructureArchitectureView['kind'] | null
  ): Pick<ElementView, 'layer' | 'layerSource'> {
    if (kind === null || kind === 'aucune') return { layer: null, layerSource: null }
    if (row.layer !== null && row.layerSource !== null && layerOf(kind, row.layer) !== null) {
      return { layer: row.layer, layerSource: row.layerSource }
    }
    const inferred = inferLayer(kind, row.paths)
    return inferred === null ? { layer: null, layerSource: null } : { layer: inferred, layerSource: 'deduite' }
  }

  /** Architecture des cartes données (D20) ; une valeur inconnue est ignorée. */
  architectures(genesisIds?: readonly string[]): StructureArchitectureView[] {
    if (genesisIds !== undefined && genesisIds.length === 0) return []
    return this.db
      .select({
        id: neurons.id,
        kind: neurons.architecture,
        reason: neurons.architectureReason,
        source: neurons.architectureSource
      })
      .from(neurons)
      .where(genesisIds === undefined ? sql`${neurons.architecture} IS NOT NULL` : inArray(neurons.id, [...genesisIds]))
      .all()
      .flatMap((row): StructureArchitectureView[] =>
        row.kind === null || !isArchitectureKind(row.kind) || row.source === null
          ? []
          : [{ genesisId: row.id, kind: row.kind, reason: row.reason, source: row.source }]
      )
  }

  setArchitecture(
    genesisId: string,
    value: { readonly kind: string; readonly reason: string | null; readonly source: 'claude' | 'user' } | null
  ): void {
    this.db
      .update(neurons)
      .set({
        architecture: value?.kind ?? null,
        architectureReason: value?.reason ?? null,
        architectureSource: value?.source ?? null
      })
      .where(eq(neurons.id, genesisId))
      .run()
  }

  setLayer(id: string, layer: string | null, source: 'claude' | 'user' | null): boolean {
    return (
      this.db
        .update(neurons)
        .set({ layer, layerSource: layer === null ? null : source })
        .where(and(eq(neurons.id, id), eq(neurons.kind, 'element')))
        .run().changes > 0
    )
  }

  insert(element: NewElement): void {
    this.db
      .insert(neurons)
      .values({
        id: element.id,
        rootId: element.id,
        parentId: element.parentId,
        depth: element.depth,
        kind: 'element',
        title: element.title,
        content: element.content,
        origin: 'claude',
        state: 'raw',
        genesisId: element.genesisId,
        elementType: element.type,
        elementKey: element.key,
        elementStatus: element.status,
        pathsJson: JSON.stringify(element.paths),
        rank: element.rank,
        layer: element.layer,
        layerSource: element.layerSource,
        collapsed: element.depth >= 1
      })
      .run()
  }

  update(
    id: string,
    patch: Pick<
      NewElement,
      'parentId' | 'depth' | 'type' | 'title' | 'content' | 'status' | 'paths' | 'rank' | 'layer' | 'layerSource'
    >
  ): void {
    this.db
      .update(neurons)
      .set({
        parentId: patch.parentId,
        depth: patch.depth,
        elementType: patch.type,
        title: patch.title,
        content: patch.content,
        elementStatus: patch.status,
        pathsJson: JSON.stringify(patch.paths),
        rank: patch.rank,
        layer: patch.layer,
        layerSource: patch.layerSource,
        state: 'raw',
        archivedAt: null,
        updatedAt: new Date().toISOString()
      })
      .where(and(eq(neurons.id, id), eq(neurons.kind, 'element')))
      .run()
  }

  archive(id: string): void {
    const now = new Date().toISOString()
    this.db
      .update(neurons)
      .set({ state: 'archived', archivedAt: now, updatedAt: now })
      .where(and(eq(neurons.id, id), eq(neurons.kind, 'element')))
      .run()
  }

  setCollapsed(id: string, collapsed: boolean): boolean {
    return (
      this.db
        .update(neurons)
        .set({ collapsed })
        .where(and(eq(neurons.id, id), eq(neurons.kind, 'element')))
        .run().changes > 0
    )
  }

  log(batchId: string, entries: readonly ChangeEntry[], actor: 'user' | 'claude'): void {
    writeChanges(this.db, batchId, entries, actor)
  }
}
