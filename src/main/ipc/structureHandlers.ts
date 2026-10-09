import { z } from 'zod'
import type { ElementFilesService } from '../application/reprise/ElementFilesService'
import type { StructureService } from '../application/structure/StructureService'
import { ProjectFile } from '@shared/ipc/projectFile'
import { ARCHITECTURE_KINDS } from '@shared/structure/architecture'
import type { MapUpdateService } from '../application/structure/MapUpdateService'
import { defineRoute, type IpcRoute } from './registry'

/**
 * Canaux de la carte de structure (spec 009) : déplier / replier un élément ; fichiers d'un élément et lecture seule
 * de l'un d'eux (spec 017 US7) ; corriger l'architecture d'une carte et la couche d'un élément (D20), annulables.
 */
export function createStructureRoutes(
  structure: Pick<StructureService, 'setCollapsed' | 'setArchitecture' | 'setLayer'>,
  files: Pick<ElementFilesService, 'files' | 'file'>
): IpcRoute[] {
  return [
    defineRoute({
      channel: 'element:setCollapsed',
      input: z.strictObject({ elementId: z.uuid(), collapsed: z.boolean() }),
      handler: async ({ elementId, collapsed }) => {
        structure.setCollapsed(elementId, collapsed)
        return { ok: true }
      }
    }),
    defineRoute({
      channel: 'structure:setArchitecture',
      input: z.strictObject({ genesisId: z.uuid(), kind: z.enum(ARCHITECTURE_KINDS) }),
      handler: async ({ genesisId, kind }) => structure.setArchitecture(genesisId, kind)
    }),
    defineRoute({
      channel: 'element:setLayer',
      input: z.strictObject({
        elementId: z.uuid(),
        layer: z
          .string()
          .regex(/^[a-z_]{1,24}$/)
          .nullable()
      }),
      handler: async ({ elementId, layer }) => structure.setLayer(elementId, layer)
    }),
    defineRoute({
      channel: 'structure:files',
      input: z.strictObject({ elementId: z.uuid() }),
      handler: async ({ elementId }) => files.files(elementId)
    }),
    defineRoute({
      channel: 'structure:file',
      input: z.strictObject({ elementId: z.uuid(), path: ProjectFile }),
      handler: async ({ elementId, path }) => files.file(elementId, path)
    })
  ]
}

/** « Mettre à jour la carte » (spec 022) : le renderer ne donne que le genesis ; les changements sont lus par le main. */
export function createMapUpdateRoutes(maps: Pick<MapUpdateService, 'plan' | 'markMapped'>): IpcRoute[] {
  return [
    defineRoute({
      channel: 'structure:updatePlan',
      input: z.strictObject({ genesisId: z.uuid() }),
      handler: async ({ genesisId }) => maps.plan(genesisId)
    }),
    defineRoute({
      channel: 'structure:markMapped',
      input: z.strictObject({ genesisId: z.uuid() }),
      handler: async ({ genesisId }) => maps.markMapped(genesisId)
    })
  ]
}
