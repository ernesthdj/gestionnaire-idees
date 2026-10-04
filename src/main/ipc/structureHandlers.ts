import { z } from 'zod'
import type { StructureService } from '../application/structure/StructureService'
import { defineRoute, type IpcRoute } from './registry'

/** Canaux de la carte de structure (spec 009) : déplier / replier un élément. */
export function createStructureRoutes(structure: Pick<StructureService, 'setCollapsed'>): IpcRoute[] {
  return [
    defineRoute({
      channel: 'element:setCollapsed',
      input: z.strictObject({ elementId: z.uuid(), collapsed: z.boolean() }),
      handler: async ({ elementId, collapsed }) => {
        structure.setCollapsed(elementId, collapsed)
        return { ok: true }
      }
    })
  ]
}
