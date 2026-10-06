import { asc, desc, eq, inArray, sql } from 'drizzle-orm'
import type { AppDatabase } from '../client'
import { approvedCommands, commandRuns, executions } from '../schemaNeurons'

export interface ApprovedCommandRow {
  readonly genesisId: string
  readonly script: string
  readonly scriptText: string
  readonly approvedAt: string
}

export interface CommandRunRow {
  readonly id: string
  readonly executionId: string
  readonly script: string
  readonly exitCode: number | null
  readonly timedOut: boolean
  readonly durationMs: number
  readonly output: string
  readonly at: string
}

/** Scripts approuvés par projet et leurs lancements pendant les exécutions (spec 013 D2 bis). */
export class CommandRepository {
  constructor(private readonly db: AppDatabase) {}

  approved(genesisId: string): ApprovedCommandRow[] {
    return this.db
      .select()
      .from(approvedCommands)
      .where(eq(approvedCommands.genesisId, genesisId))
      .orderBy(asc(approvedCommands.script))
      .all()
  }

  /** Remplace la liste approuvée d'un projet (textes retenus tels qu'approuvés). */
  replaceApproved(genesisId: string, rows: readonly Omit<ApprovedCommandRow, 'genesisId'>[]): void {
    this.db.transaction(() => {
      this.db.delete(approvedCommands).where(eq(approvedCommands.genesisId, genesisId)).run()
      if (rows.length > 0) {
        this.db
          .insert(approvedCommands)
          .values(rows.map((row) => ({ ...row, genesisId })))
          .run()
      }
    })
  }

  insertRun(run: CommandRunRow): void {
    this.db.insert(commandRuns).values(run).run()
  }

  /** Lancements des exécutions d'une action, le plus récent d'abord. */
  runsOf(neuronId: string): CommandRunRow[] {
    const ids = this.db
      .select({ id: executions.id })
      .from(executions)
      .where(eq(executions.neuronId, neuronId))
      .all()
      .map((row) => row.id)
    if (ids.length === 0) return []
    return this.db
      .select()
      .from(commandRuns)
      .where(inArray(commandRuns.executionId, ids))
      .orderBy(desc(commandRuns.at), desc(sql`${commandRuns}.rowid`))
      .all()
  }
}
