import { randomUUID } from 'node:crypto'
import { and, gte, isNotNull, lt } from 'drizzle-orm'
import type { CallLog, CallRecord } from '../../../application/ai/ports'
import type { AiCallFingerprint } from '../../../domain/analyste/aggregate'
import type { AppDatabase } from '../client'
import { aiCalls } from '../schema'

/** Journal des appels IA en base : métadonnées uniquement (spec 001 FR-007), empreintes de la sonde (spec 019). */
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
        durationMs: call.durationMs,
        inputFp: call.inputFp ?? null,
        outputFp: call.outputFp ?? null
      })
      .run()
  }

  /** Empreintes des appels d'une fenêtre (ms), pour repérer un travail d'IA refait (spec 019 FR-019). */
  fingerprints(from: number, to: number): AiCallFingerprint[] {
    return this.db
      .select({ kind: aiCalls.kind, inputFp: aiCalls.inputFp, outputFp: aiCalls.outputFp })
      .from(aiCalls)
      .where(
        and(
          isNotNull(aiCalls.inputFp),
          gte(aiCalls.createdAt, new Date(from).toISOString()),
          lt(aiCalls.createdAt, new Date(to).toISOString())
        )
      )
      .all()
      .flatMap((row) =>
        row.inputFp === null ? [] : [{ kind: row.kind, inputFp: row.inputFp, outputFp: row.outputFp }]
      )
  }
}
