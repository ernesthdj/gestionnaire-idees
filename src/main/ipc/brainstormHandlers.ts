import { z } from 'zod'
import { BrainstormOpenInput, BrainstormScratchInput, BrainstormViewStateInput } from '@shared/ipc/brainstorms'
import type { BrainstormService } from '../application/brainstorms/BrainstormService'
import { defineRoute, type IpcRoute } from './registry'

/**
 * Canaux du Project Manager (spec 024 US1, US3 ; contracts/interfaces.md) : aucun chemin ne vient de l'interface,
 * seulement un identifiant, un slug du registre ou un formulaire revalidé.
 */
export function createBrainstormRoutes(
  brainstorms: Pick<BrainstormService, 'list' | 'active' | 'open' | 'close' | 'saveViewState' | 'createScratch'>
): IpcRoute[] {
  return [
    defineRoute({ channel: 'brainstorms:list', input: z.undefined(), handler: async () => brainstorms.list() }),
    defineRoute({ channel: 'brainstorms:active', input: z.undefined(), handler: async () => brainstorms.active() }),
    defineRoute({
      channel: 'brainstorms:open',
      input: BrainstormOpenInput,
      handler: async (target) => brainstorms.open(target)
    }),
    defineRoute({ channel: 'brainstorms:close', input: z.undefined(), handler: async () => brainstorms.close() }),
    defineRoute({
      channel: 'brainstorms:viewState',
      input: BrainstormViewStateInput,
      handler: async ({ id, state }) => brainstorms.saveViewState(id, state)
    }),
    defineRoute({
      channel: 'brainstorms:createScratch',
      input: BrainstormScratchInput,
      handler: async (input) => brainstorms.createScratch(input)
    })
  ]
}
