import { z } from 'zod'
import {
  BrainstormOpenInput,
  BrainstormScratchInput,
  BrainstormViewStateInput,
  SavePointCreateInput,
  SavePointIdInput,
  SavePointListInput,
  SavePointRenameInput,
  SavePointUndoInput
} from '@shared/ipc/brainstorms'
import type { BrainstormService } from '../application/brainstorms/BrainstormService'
import type { SavePointService } from '../application/brainstorms/SavePointService'
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

/** Points de sauvegarde (spec 024 US2) : identifiants et noms seulement. */
export function createSavePointRoutes(
  points: Pick<SavePointService, 'list' | 'create' | 'rename' | 'remove' | 'restore' | 'undoRestore'>
): IpcRoute[] {
  return [
    defineRoute({
      channel: 'savepoints:list',
      input: SavePointListInput,
      handler: async ({ brainstormId }) => points.list(brainstormId)
    }),
    defineRoute({
      channel: 'savepoints:create',
      input: SavePointCreateInput,
      handler: async ({ brainstormId, name }) => points.create(brainstormId, name)
    }),
    defineRoute({
      channel: 'savepoints:rename',
      input: SavePointRenameInput,
      handler: async ({ id, name }) => points.rename(id, name)
    }),
    defineRoute({
      channel: 'savepoints:delete',
      input: SavePointIdInput,
      handler: async ({ id }) => points.remove(id)
    }),
    defineRoute({
      channel: 'savepoints:restore',
      input: SavePointIdInput,
      handler: async ({ id }) => points.restore(id)
    }),
    defineRoute({
      channel: 'savepoints:undoRestore',
      input: SavePointUndoInput,
      handler: async ({ undoId }) => points.undoRestore(undoId)
    })
  ]
}
