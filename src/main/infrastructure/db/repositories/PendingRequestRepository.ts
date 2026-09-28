import { randomUUID } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import type { AppDatabase } from '../client'
import { aiPendingRequests } from '../schema'

export interface PendingRow {
  readonly requestId: string
  readonly kind: string
  readonly payload: string
  readonly attempts: number
}

/** File locale persistante (table `ai_pending_requests`), dans l'ordre d'arrivée. */
export class PendingRequestRepository {
  constructor(private readonly db: AppDatabase) {}

  add(requestId: string, kind: string, payload: string): void {
    this.db.insert(aiPendingRequests).values({ id: randomUUID(), requestId, kind, payload }).onConflictDoNothing().run()
  }

  list(): PendingRow[] {
    return (
      this.db
        .select({
          requestId: aiPendingRequests.requestId,
          kind: aiPendingRequests.kind,
          payload: aiPendingRequests.payload,
          attempts: aiPendingRequests.attempts
        })
        .from(aiPendingRequests)
        // `rowid` = ordre d'insertion réel ; l'horodatage peut être identique à la milliseconde près.
        .orderBy(sql`rowid`)
        .all()
    )
  }

  incrementAttempts(requestId: string, attempts: number): void {
    this.db.update(aiPendingRequests).set({ attempts }).where(eq(aiPendingRequests.requestId, requestId)).run()
  }

  remove(requestId: string): void {
    this.db.delete(aiPendingRequests).where(eq(aiPendingRequests.requestId, requestId)).run()
  }
}
