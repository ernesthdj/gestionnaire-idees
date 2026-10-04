import { randomUUID } from 'node:crypto'
import type { AppDatabase } from '../client'
import { changeLog } from '../schemaNeurons'

/** Entrée de l'historique append-only, regroupée par lot (annulation, spec 003). */
export interface ChangeEntry {
  readonly kind: 'confirm_synthesis' | 'manual_edit' | 'link' | 'seed' | 'delete' | 'promote' | 'mcp_write'
  readonly entity: string
  readonly entityId: string
  readonly before: unknown
  readonly after: unknown
}

export function writeChanges(
  db: AppDatabase,
  batchId: string,
  entries: readonly ChangeEntry[],
  actor: 'user' | 'claude' = 'user'
): void {
  if (entries.length === 0) return
  db.insert(changeLog)
    .values(
      entries.map((entry) => ({
        id: randomUUID(),
        batchId,
        actor,
        kind: entry.kind,
        entity: entry.entity,
        entityId: entry.entityId,
        beforeJson: entry.before === null ? null : JSON.stringify(entry.before),
        afterJson: entry.after === null ? null : JSON.stringify(entry.after)
      }))
    )
    .run()
}
