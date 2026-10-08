import { z } from 'zod'

/**
 * Chemin relatif d'un fichier d'un projet lié : ni absolu, ni remontée (la lecture reste aussi gardée côté service).
 * Partagé par les canaux de la carte de structure (spec 017) et de la vue Workflow (spec 023).
 */
export const ProjectFile = z
  .string()
  .min(1)
  .max(500)
  .refine((path) => !/^([a-zA-Z]:|[\\/])/.test(path) && !path.split(/[\\/]/).includes('..'), 'chemin relatif')
