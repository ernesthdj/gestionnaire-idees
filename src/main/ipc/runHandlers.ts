import { z } from 'zod'
import { ProjectTrustInput, RunFavoriteInput, RunGenesisInput, RunIdInput, RunStartInput } from '@shared/run/run'
import type { RunService } from '../application/run/RunService'
import { defineRoute, type IpcRoute } from './registry'

/**
 * Lancer un projet (spec 025) : le renderer ne donne qu'un genesis et un nom de script, revalidé contre le
 * `package.json` relu par le main ; jamais une commande ni un chemin.
 */
export function createRunRoutes(
  runs: Pick<RunService, 'scripts' | 'setFavorite' | 'trust' | 'list' | 'start' | 'stop' | 'dismiss'>
): IpcRoute[] {
  return [
    defineRoute({
      channel: 'run:scripts',
      input: RunGenesisInput,
      handler: async ({ genesisId }) => runs.scripts(genesisId)
    }),
    defineRoute({
      channel: 'run:setFavorite',
      input: RunFavoriteInput,
      handler: async ({ genesisId, script }) => runs.setFavorite(genesisId, script)
    }),
    defineRoute({
      channel: 'project:trust',
      input: ProjectTrustInput,
      handler: async ({ genesisId, trusted }) => runs.trust(genesisId, trusted)
    }),
    defineRoute({ channel: 'run:list', input: z.undefined(), handler: async () => runs.list() }),
    defineRoute({
      channel: 'run:start',
      input: RunStartInput,
      handler: async ({ genesisId, script }) => runs.start(genesisId, script)
    }),
    defineRoute({ channel: 'run:stop', input: RunIdInput, handler: async ({ runId }) => runs.stop(runId) }),
    defineRoute({ channel: 'run:dismiss', input: RunIdInput, handler: async ({ runId }) => runs.dismiss(runId) })
  ]
}
