import { z } from 'zod'
import { IDEA_PARTS } from '@shared/ipc/widgetIo'
import type { WidgetIoService } from '../application/widgets/WidgetIoService'
import { defineRoute, type IpcRoute } from './registry'

const Id = z.uuid()

/** Canaux `widgetIo:*` (spec 005) : brancher, régler, autoriser, remettre les entrées d'un widget, recevoir sa sortie. */
export function createWidgetIoRoutes(io: WidgetIoService): IpcRoute[] {
  return [
    defineRoute({
      channel: 'widgetIo:state',
      input: z.object({ blockId: Id }).strict(),
      handler: async ({ blockId }) => io.state(blockId)
    }),
    defineRoute({
      channel: 'widgetIo:connect',
      input: z.object({ blockId: Id, sourceKind: z.enum(['idea', 'step']), sourceId: Id }).strict(),
      handler: async (input) => io.connect(input)
    }),
    defineRoute({
      channel: 'widgetIo:setParts',
      input: z.object({ inputId: Id, parts: z.array(z.enum(IDEA_PARTS)).max(IDEA_PARTS.length) }).strict(),
      handler: async (input) => io.setParts(input)
    }),
    defineRoute({
      channel: 'widgetIo:disconnect',
      input: z.object({ inputId: Id }).strict(),
      handler: async ({ inputId }) => io.disconnect(inputId)
    }),
    defineRoute({
      channel: 'widgetIo:approve',
      input: z.object({ blockId: Id }).strict(),
      handler: async ({ blockId }) => io.approve(blockId)
    }),
    defineRoute({
      channel: 'widgetIo:inputs',
      input: z.object({ blockId: Id, versionId: Id }).strict(),
      handler: async (input) => io.inputs(input)
    }),
    // Le résultat est une donnée libre : ses bornes (JSON seul, taille, profondeur) sont vérifiées par le service.
    defineRoute({
      channel: 'widgetIo:emit',
      input: z.object({ blockId: Id, versionId: Id, data: z.unknown() }).strict(),
      handler: async (input) => io.emit(input)
    }),
    defineRoute({
      channel: 'widgetIo:result',
      input: z.object({ blockId: Id }).strict(),
      handler: async ({ blockId }) => io.result(blockId)
    })
  ]
}
