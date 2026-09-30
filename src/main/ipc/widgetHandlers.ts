import { z } from 'zod'
import { WIDGET_PROMPT_MAX_CHARS } from '@shared/ipc/widgets'
import type { ToolGeneration } from '../application/widgets/ToolGeneration'
import type { WidgetService } from '../application/widgets/WidgetService'
import { defineRoute, type IpcRoute } from './registry'

/** Canaux `widget:*` (spec 004) : lecture, demande à Claude, restauration d'une version ; outil proposé (spec 006). */
export function createWidgetRoutes(widgets: WidgetService, tools?: Pick<ToolGeneration, 'retry'>): IpcRoute[] {
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
      channel: 'widget:restore',
      input: z.object({ blockId: z.uuid(), versionId: z.uuid() }).strict(),
      handler: async (input) => widgets.restore(input)
    }),
    ...(tools === undefined
      ? []
      : [
          defineRoute({
            channel: 'widget:generate',
            input: z.object({ blockId: z.uuid() }).strict(),
            handler: async ({ blockId }) => tools.retry(blockId)
          })
        ])
  ]
}
