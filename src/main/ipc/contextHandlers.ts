import { z } from 'zod'
import type { ContextListView, PendingImportView } from '@shared/ipc/context'
import type { ContextImportService } from '../application/ai/ContextImportService'
import type { ContextRepository } from '../infrastructure/db/repositories/ContextRepository'
import { defineRoute, type IpcRoute } from './registry'

const Id = z.object({ id: z.uuid() }).strict()

/** Canaux `context:*` : aperçu, application, refus et retour arrière des imports de contexte (US5). */
export function createContextRoutes(deps: {
  readonly service: ContextImportService
  readonly repository: ContextRepository
  readonly inboxPath: string
}): IpcRoute[] {
  const list = (): ContextListView => {
    const history = deps.service.history()
    const active = deps.repository.activeVersion()
    return {
      active:
        active === undefined
          ? null
          : {
              id: active.id,
              version: active.version,
              source: active.source,
              isActive: true,
              appliedAt: active.appliedAt,
              profile: active.profileMd,
              rules: active.rulesMd
            },
      versions: history.versions,
      imports: history.imports,
      inboxPath: deps.inboxPath
    }
  }

  return [
    defineRoute({ channel: 'context:list', input: z.undefined(), handler: async () => list() }),
    defineRoute({
      channel: 'context:pending',
      input: z.undefined(),
      handler: async (): Promise<PendingImportView[]> =>
        deps.service.pending().map(({ id, detectedAt, diff }) => ({ id, detectedAt, diff }))
    }),
    defineRoute({
      channel: 'context:apply',
      input: Id,
      handler: async ({ id }) => {
        deps.service.apply(id)
        return list()
      }
    }),
    defineRoute({
      channel: 'context:reject',
      input: Id,
      handler: async ({ id }) => {
        deps.service.reject(id)
        return list()
      }
    }),
    defineRoute({
      channel: 'context:rollback',
      input: Id,
      handler: async ({ id }) => {
        deps.service.rollback(id)
        return list()
      }
    })
  ]
}
