import { z } from 'zod'
import { LOCAL_TASK_KINDS, type TaskKind } from '../../domain/ai/types'
import type { PendingRequestRepository } from '../../infrastructure/db/repositories/PendingRequestRepository'
import type { AIGateway, AIResult } from './AIGateway'
import type { LocalQueuePort, PendingRequest } from './ports'

const MAX_ATTEMPTS = 5

const PayloadSchema = z.object({
  kind: z.enum(LOCAL_TASK_KINDS),
  input: z.string(),
  schemaName: z.string().min(1)
})

export interface LocalQueueDependencies {
  readonly repository: PendingRequestRepository
  readonly gateway: AIGateway
  readonly isLocalAvailable: () => Promise<boolean>
  /** Schémas de sortie rejouables, par nom. */
  readonly schemas: Readonly<Record<string, z.ZodType>>
  readonly onCompleted: (requestId: string, result: AIResult<unknown>) => void
  readonly onFailed: (requestId: string) => void
}

/**
 * File persistante des demandes locales en attente d'Ollama (spec 001 FR-013, analyse C1).
 * `tick()` est appelé périodiquement (sonde de 30 s) ; rejeu séquentiel dans l'ordre d'arrivée.
 */
export class LocalQueue implements LocalQueuePort {
  private running = false

  constructor(private readonly deps: LocalQueueDependencies) {}

  async enqueue(request: PendingRequest): Promise<void> {
    if (request.schemaName === undefined || !(request.schemaName in this.deps.schemas)) {
      throw new Error('Demande non rejouable : schéma de sortie inconnu')
    }
    const payload = { kind: request.kind, input: request.input, schemaName: request.schemaName }
    this.deps.repository.add(request.requestId, request.kind, JSON.stringify(payload))
  }

  async tick(): Promise<void> {
    if (this.running || !(await this.deps.isLocalAvailable())) return
    this.running = true
    try {
      for (const row of this.deps.repository.list()) {
        const payload = PayloadSchema.safeParse(JSON.parse(row.payload))
        const schema = payload.success ? this.deps.schemas[payload.data.schemaName] : undefined
        if (!payload.success || schema === undefined) {
          this.deps.repository.remove(row.requestId)
          this.deps.onFailed(row.requestId)
          continue
        }
        const result = await this.deps.gateway.run({
          kind: payload.data.kind as TaskKind,
          input: payload.data.input,
          schema,
          requestId: row.requestId,
          noQueue: true
        })
        if (result.ok) {
          this.deps.repository.remove(row.requestId)
          this.deps.onCompleted(row.requestId, result.value)
          continue
        }
        if (result.error.code === 'AI_UNAVAILABLE') return // Ollama est retombé : on reprendra au prochain passage.
        const attempts = row.attempts + 1
        if (attempts >= MAX_ATTEMPTS) {
          this.deps.repository.remove(row.requestId)
          this.deps.onFailed(row.requestId)
        } else {
          this.deps.repository.incrementAttempts(row.requestId, attempts)
        }
      }
    } finally {
      this.running = false
    }
  }
}
