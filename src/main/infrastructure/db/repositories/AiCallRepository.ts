import { randomUUID } from 'node:crypto'
import { and, eq, gte, sum } from 'drizzle-orm'
import type { CallLog, CallRecord } from '../../../application/ai/ports'
import type { AppDatabase } from '../client'
import { aiCalls } from '../schema'

/** Journal des appels IA en base : métadonnées uniquement (spec 001 FR-007). */
export class AiCallRepository implements CallLog {
  constructor(private readonly db: AppDatabase) {}

  async record(call: CallRecord): Promise<void> {
    this.db
      .insert(aiCalls)
      .values({
        id: randomUUID(),
        requestId: call.requestId,
        kind: call.kind,
        engine: call.engine,
        model: call.model,
        inputTokens: call.usage.inputTokens,
        outputTokens: call.usage.outputTokens,
        cacheReadTokens: call.usage.cacheReadTokens,
        cacheWriteTokens: call.usage.cacheWriteTokens,
        costMillicents: call.costMillicents,
        status: call.status,
        errorCode: call.errorCode ?? null,
        durationMs: call.durationMs
      })
      .run()
  }

  /** Somme des coûts Claude (millicentimes) journalisés depuis `since`. */
  claudeSpentSince(since: Date): number {
    const row = this.db
      .select({ total: sum(aiCalls.costMillicents) })
      .from(aiCalls)
      .where(and(eq(aiCalls.engine, 'claude'), gte(aiCalls.createdAt, since.toISOString())))
      .get()
    return Number(row?.total ?? 0)
  }
}
