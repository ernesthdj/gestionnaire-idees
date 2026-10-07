import { z } from 'zod'
import type { ElementFilesService } from '../application/reprise/ElementFilesService'
import type { StructureService } from '../application/structure/StructureService'
import { ARCHITECTURE_KINDS } from '@shared/structure/architecture'
import { defineRoute, type IpcRoute } from './registry'

/** Chemin relatif d'un fichier du projet : ni absolu, ni remontée (la lecture reste aussi gardée côté service). */
const ProjectFile = z
  .string()
  .min(1)
  .max(500)
  .refine((path) => !/^([a-zA-Z]:|[\\/])/.test(path) && !path.split(/[\\/]/).includes('..'), 'chemin relatif')

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
