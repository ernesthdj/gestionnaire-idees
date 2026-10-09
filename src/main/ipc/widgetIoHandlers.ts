import { z } from 'zod'
import { CONNECTABLE_SOURCES, INPUT_PARTS } from '@shared/ipc/widgetIo'
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
      input: z.object({ blockId: Id, sourceKind: z.enum(CONNECTABLE_SOURCES), sourceId: Id }).strict(),
      handler: async (input) => io.connect(input)
    }),
    defineRoute({
      channel: 'widgetIo:setParts',
      // Parties d'une idée ou d'une étape : le service ne garde que celles de la nature du branchement.
      input: z.object({ inputId: Id, parts: z.array(z.enum(INPUT_PARTS)).max(INPUT_PARTS.length) }).strict(),
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
    // État du widget (spec 026) : donnée libre aussi, bornée par le service (JSON seul, 64 Ko).
    defineRoute({
      channel: 'widgetIo:savedState',
      input: z.object({ blockId: Id }).strict(),
      handler: async ({ blockId }) => ({ state: io.savedState(blockId) })
    }),
    defineRoute({
      channel: 'widgetIo:saveState',
      input: z.object({ blockId: Id, data: z.unknown() }).strict(),
      handler: async (input) => io.saveState(input)
    }),
    // Réglages (spec 026 D7) : la déclaration et les valeurs sont validées par le service (Zod, bornes).
    defineRoute({
      channel: 'widgetIo:declareSettings',
      input: z.object({ blockId: Id, versionId: Id, fields: z.unknown() }).strict(),
      handler: async (input) => io.declareSettings(input)
    }),
    defineRoute({
      channel: 'widgetIo:settings',
      input: z.object({ blockId: Id }).strict(),
      handler: async ({ blockId }) => io.settingsPanel(blockId)
    }),
    defineRoute({
      channel: 'widgetIo:settingsValues',
      input: z.object({ blockId: Id }).strict(),
      handler: async ({ blockId }) => io.settingsValues(blockId)
    }),
    defineRoute({
      channel: 'widgetIo:setSettings',
      input: z.object({ blockId: Id, values: z.unknown() }).strict(),
      handler: async (input) => io.setSettings(input)
    }),
    defineRoute({
      channel: 'widgetIo:result',
      input: z.object({ blockId: Id }).strict(),
      handler: async ({ blockId }) => io.result(blockId)
    })
  ]
}
