import { z } from 'zod'
import { PROJECT_LIMITS, PROJECT_TYPES } from '@shared/ipc/projects'
import type { ProjectService } from '../application/projects/ProjectService'
import { defineRoute, type IpcRoute } from './registry'

/** Canaux `project:*` (spec 016) : aucun chemin ne vient de l'interface, seulement un nom de dossier validé ensuite. */
export function createProjectRoutes(
  projects: Pick<ProjectService, 'settings' | 'chooseRoot' | 'create' | 'initGit'>
): IpcRoute[] {
  return [
    defineRoute({ channel: 'project:settings', input: z.undefined(), handler: async () => projects.settings() }),
    defineRoute({ channel: 'project:chooseRoot', input: z.undefined(), handler: async () => projects.chooseRoot() }),
    defineRoute({
      channel: 'project:create',
      input: z.strictObject({
        neuronId: z.uuid(),
        name: z.string().min(1).max(PROJECT_LIMITS.name),
        slug: z.string().min(2).max(50),
        type: z.enum(PROJECT_TYPES),
        description: z.string().max(PROJECT_LIMITS.description)
      }),
      handler: async (input) => projects.create(input)
    }),
    defineRoute({
      channel: 'project:initGit',
      input: z.strictObject({ neuronId: z.uuid() }),
      handler: async ({ neuronId }) => projects.initGit(neuronId)
    })
  ]
}
