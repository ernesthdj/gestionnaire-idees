import { z } from 'zod'
import type { ElementFilesService } from '../application/reprise/ElementFilesService'
import type { StructureService } from '../application/structure/StructureService'
import { defineRoute, type IpcRoute } from './registry'

/** Chemin relatif d'un fichier du projet : ni absolu, ni remontée (la lecture reste aussi gardée côté service). */
const ProjectFile = z
  .string()
  .min(1)
  .max(500)
  .refine((path) => !/^([a-zA-Z]:|[\\/])/.test(path) && !path.split(/[\\/]/).includes('..'), 'chemin relatif')

/**
 * Canaux de la carte de structure (spec 009) : déplier / replier un élément ; fichiers d'un élément et lecture seule
 * de l'un d'eux (spec 017 US7).
 */
export function createStructureRoutes(
  structure: Pick<StructureService, 'setCollapsed'>,
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
