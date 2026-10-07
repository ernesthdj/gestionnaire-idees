import { and, count, desc, eq, gt, gte, lt, lte, sql, sum, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import {
  PROBE_FAMILIES,
  PROBE_SCREENS,
  PROBE_STATUSES,
  PROBE_SUBJECT_KINDS,
  PROBE_VIA,
  type ObservationRecord,
  type ProbeFamily
} from '@shared/analyste/events'
import type { ObservationView } from '@shared/ipc/analyste'
import type { AppDatabase } from '../client'
import { observations } from '../schemaAnalyste'

export interface ObservationQuery {
  readonly family?: ProbeFamily
  readonly from?: number
  readonly to?: number
  /** Identifiant à partir duquel reprendre (exclu), du plus récent au plus ancien. */
  readonly cursor?: number
  readonly limit: number
}

const Frames = z.array(z.string()).max(5)
const enumOrNull = <T extends readonly [string, ...string[]]>(values: T, value: string | null): T[number] | null =>
  value !== null && (values as readonly string[]).includes(value) ? value : null

/** Observations de la sonde (spec 019 data-model) : écriture par lots, lecture paginée, purge par âge puis volume. */
export class ObservationRepository {
  constructor(private readonly db: AppDatabase) {}

  /** Écrit un lot en une seule transaction. */
  insertBatch(records: readonly ObservationRecord[]): void {
    if (records.length === 0) return
    this.db.transaction((tx) => {
      for (const record of records) {
        tx.insert(observations)
          .values({
            at: record.at,
            family: record.family,
            event: record.event,
            screen: record.screen ?? null,
            subjectKind: record.subjectKind ?? null,
            subjectRef: record.subjectRef ?? null,
            via: record.via ?? null,
            channel: record.channel ?? null,
            code: record.code ?? null,
            module: record.module ?? null,
            frames: record.frames === undefined ? null : JSON.stringify(record.frames),
            durationMs: record.durationMs ?? null,
            status: record.status ?? null,
            count: record.count ?? 1
          })
          .run()
      }
    })
  }

  page(query: ObservationQuery): { items: ObservationView[]; next: number | null } {
    const filters: SQL[] = []
    if (query.family !== undefined) filters.push(eq(observations.family, query.family))
    if (query.from !== undefined) filters.push(gte(observations.at, query.from))
    if (query.to !== undefined) filters.push(lte(observations.at, query.to))
    if (query.cursor !== undefined) filters.push(lt(observations.id, query.cursor))
    const rows = this.db
      .select()
      .from(observations)
      .where(filters.length === 0 ? undefined : and(...filters))
      .orderBy(desc(observations.id))
      .limit(query.limit + 1)
      .all()
    const items = rows.slice(0, query.limit).map((row) => this.view(row))
    return { items, next: rows.length > query.limit ? (items.at(-1)?.id ?? null) : null }
  }

  totals(): Record<ProbeFamily, number> {
    const totals = Object.fromEntries(PROBE_FAMILIES.map((family) => [family, 0])) as Record<ProbeFamily, number>
    const rows = this.db
      .select({ family: observations.family, n: count() })
      .from(observations)
      .groupBy(observations.family)
      .all()
    for (const row of rows) totals[row.family] = row.n
    return totals
  }

  count(): number {
    return this.db.select({ n: count() }).from(observations).get()?.n ?? 0
  }

  /** Toutes les observations, du plus ancien au plus récent (export local). */
  all(): ObservationView[] {
    return this.db
      .select()
      .from(observations)
      .orderBy(observations.id)
      .all()
      .map((row) => this.view(row))
  }

  /** Purge : plus anciennes que `olderThan`, puis au-delà de `maxEvents` (les plus anciennes d'abord). */
  purge(olderThan: number, maxEvents: number): number {
    return this.db.transaction((tx) => {
      const byAge = tx.delete(observations).where(lt(observations.at, olderThan)).run().changes
      const byVolume = tx.run(
        sql`DELETE FROM observations WHERE id <= (SELECT id FROM observations ORDER BY id DESC LIMIT 1 OFFSET ${maxEvents})`
      ).changes
      return byAge + byVolume
    })
  }

  /** Observations d'une fenêtre d'analyse `]from, to]`, dans l'ordre (spec 019 US2). */
  between(from: number, to: number): ObservationRecord[] {
    return this.db
      .select()
      .from(observations)
      .where(and(gt(observations.at, from), lte(observations.at, to)))
      .orderBy(observations.at, observations.id)
      .all()
      .map((row) => {
        const view = this.view(row)
        return {
          at: view.at,
          family: view.family,
          event: view.event,
          count: view.count,
          ...(view.screen === null ? {} : { screen: view.screen }),
          ...(view.subjectKind === null ? {} : { subjectKind: view.subjectKind }),
          ...(view.subjectRef === null ? {} : { subjectRef: view.subjectRef }),
          ...(view.via === null ? {} : { via: view.via }),
          ...(view.channel === null ? {} : { channel: view.channel }),
          ...(view.code === null ? {} : { code: view.code }),
          ...(view.module === null ? {} : { module: view.module }),
          ...(view.frames.length === 0 ? {} : { frames: view.frames }),
          ...(view.durationMs === null ? {} : { durationMs: view.durationMs }),
          ...(view.status === null ? {} : { status: view.status })
        }
      })
  }

  /** Nombre d'événements (rafales comprises) d'une fenêtre `]from, to]`. */
  countBetween(from: number, to: number): number {
    const row = this.db
      .select({ n: sum(observations.count) })
      .from(observations)
      .where(and(gt(observations.at, from), lte(observations.at, to)))
      .get()
    return Number(row?.n ?? 0)
  }

  clear(): number {
    return this.db.delete(observations).run().changes
  }

  private view(row: typeof observations.$inferSelect): ObservationView {
    let frames: string[] = []
    if (row.frames !== null) {
      try {
        const parsed = Frames.safeParse(JSON.parse(row.frames))
        frames = parsed.success ? parsed.data : []
      } catch {
        frames = []
      }
    }
    return {
      id: row.id,
      at: row.at,
      family: row.family,
      event: row.event,
      screen: enumOrNull(PROBE_SCREENS, row.screen),
      subjectKind: enumOrNull(PROBE_SUBJECT_KINDS, row.subjectKind),
      subjectRef: row.subjectRef,
      via: enumOrNull(PROBE_VIA, row.via),
      channel: row.channel,
      code: row.code,
      module: row.module,
      frames,
      durationMs: row.durationMs,
      status: enumOrNull(PROBE_STATUSES, row.status),
      count: row.count
    }
  }
}
