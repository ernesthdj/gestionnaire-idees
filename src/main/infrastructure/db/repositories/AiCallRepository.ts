import { randomUUID } from 'node:crypto'
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
}
