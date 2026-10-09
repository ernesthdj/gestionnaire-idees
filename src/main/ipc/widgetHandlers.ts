import { z } from 'zod'
import { WIDGET_BUILDS, WIDGET_PROMPT_MAX_CHARS } from '@shared/ipc/widgets'
import type { WidgetService } from '../application/widgets/WidgetService'
import { defineRoute, type IpcRoute } from './registry'

/** Canaux `widget:*` (spec 004, 026) : lecture, demande à Claude, construction prédéfinie, restauration d'une version. */
export function createWidgetRoutes(widgets: WidgetService): IpcRoute[] {
  return [
    defineRoute({
      channel: 'widget:get',
      input: z.object({ blockId: z.uuid() }).strict(),
      handler: async ({ blockId }) => widgets.get(blockId)
    }),
    defineRoute({
      channel: 'widget:prompt',
      input: z.object({ blockId: z.uuid(), text: z.string().trim().min(1).max(WIDGET_PROMPT_MAX_CHARS) }).strict(),
      handler: async (input) => widgets.prompt(input)
    }),
    defineRoute({
      channel: 'widget:build',
      input: z.object({ blockId: z.uuid(), action: z.enum(WIDGET_BUILDS) }).strict(),
      handler: async (input) => widgets.build(input)
    }),
    defineRoute({
      channel: 'widget:restore',
      input: z.object({ blockId: z.uuid(), versionId: z.uuid() }).strict(),
      handler: async (input) => widgets.restore(input)
    })
  ]
}
