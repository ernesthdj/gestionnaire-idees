import { z } from 'zod'
import { DOCUMENT_SIZE_LIMITS, type DocumentContentView } from '@shared/ipc/documents'
import { Coordinate } from './canvasHandlers'
import type { DocumentService } from '../application/documents/DocumentService'
import { defineRoute, type IpcRoute } from './registry'

export interface DocumentRouteDeps {
  readonly documents: Pick<DocumentService, 'read' | 'remove' | 'recreate' | 'pathOf' | 'move' | 'resize'>
  /** Montre le fichier dans l'Explorateur : chemin résolu par le main, jamais fourni par l'interface. */
  readonly reveal: (path: string) => void
}

/** Canaux `document:*` (spec 012) — chaque charge utile est validée. */
export function createDocumentRoutes(deps: DocumentRouteDeps): IpcRoute[] {
  const Input = z.object({ id: z.uuid() }).strict()
  return [
    defineRoute({
      channel: 'document:get',
      input: Input,
      handler: async ({ id }): Promise<DocumentContentView> => ({ id, ...deps.documents.read(id) })
    }),
    defineRoute({
      channel: 'document:remove',
      input: Input,
      handler: async ({ id }) => deps.documents.remove(id)
    }),
    defineRoute({
      channel: 'document:recreate',
      input: Input,
      handler: async ({ id }) => {
        deps.documents.recreate(id)
        return { ok: true }
      }
    }),
    defineRoute({
      channel: 'document:move',
      input: z.object({ id: z.uuid(), x: Coordinate, y: Coordinate }).strict(),
      handler: async ({ id, x, y }) => {
        deps.documents.move(id, x, y)
        return { ok: true }
      }
    }),
    defineRoute({
      channel: 'document:resize',
      input: z
        .object({
          id: z.uuid(),
          width: z.number().finite().min(DOCUMENT_SIZE_LIMITS.minWidth).max(DOCUMENT_SIZE_LIMITS.maxWidth),
          height: z.number().finite().min(DOCUMENT_SIZE_LIMITS.minHeight).max(DOCUMENT_SIZE_LIMITS.maxHeight)
        })
        .strict(),
      handler: async ({ id, width, height }) => {
        deps.documents.resize(id, width, height)
        return { ok: true }
      }
    }),
    defineRoute({
      channel: 'document:reveal',
      input: Input,
      handler: async ({ id }) => {
        deps.reveal(deps.documents.pathOf(id))
        return { ok: true }
      }
    })
  ]
}
